# 👥 MCP User Capture and Database Persistence System

Complete implementation guide for capturing, deduplicating, and storing MCP server end-users during OAuth authentication flows.

## 🎯 System Overview

The MCP User Capture System is the critical component that transforms anonymous OAuth flows into persistent, trackable user relationships. This system enables:

- **User De-anonymization**: Link OAuth sessions to persistent user identities
- **Organization-Scoped Deduplication**: Prevent cross-organization data leakage
- **Multi-Provider Consolidation**: Unify users across different OAuth providers
- **Analytics Foundation**: Enable user behavior tracking and engagement metrics
- **Privacy Compliance**: Maintain strict organization boundaries

## 🗄️ Database Schema Design

### Core User Table

The `mcp_server_user` table stores end-users of MCP servers (distinct from dashboard/platform users):

```sql
-- MCP Server Users (NOT dashboard users)
CREATE TABLE mcp_server_user (
    id TEXT PRIMARY KEY DEFAULT 'mcpu_' || nanoid(12),
    tracking_id TEXT UNIQUE,                    -- For analytics tracking
    email TEXT,                                 -- From OAuth provider
    upstream_sub TEXT,                          -- OAuth provider's sub claim
    profile_data JSONB,                         -- Full OAuth profile response
    first_seen_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- Indexes for efficient lookups
CREATE INDEX mcp_server_user_email_idx ON mcp_server_user(email);
CREATE INDEX mcp_server_user_upstream_sub_idx ON mcp_server_user(upstream_sub);
CREATE INDEX mcp_server_user_tracking_id_idx ON mcp_server_user(tracking_id);
```

### Related Tables

```sql
-- Links users to their OAuth tokens across providers
CREATE TABLE upstream_oauth_tokens (
    id TEXT PRIMARY KEY DEFAULT 'uot_' || nanoid(12),
    mcp_server_user_id TEXT REFERENCES mcp_server_user(id) ON DELETE CASCADE,
    oauth_config_id TEXT NOT NULL,             -- Links to OAuth provider config
    access_token TEXT,                         -- TODO: Encrypt in production
    refresh_token TEXT,                        -- TODO: Encrypt in production
    expires_at BIGINT,                         -- Token expiration timestamp
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    updated_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- MCP Server Sessions link users to specific servers
CREATE TABLE mcp_server_session (
    mcp_server_session_id TEXT PRIMARY KEY DEFAULT 'mcps_' || nanoid(12),
    mcp_server_slug TEXT NOT NULL,
    mcp_server_user_id TEXT REFERENCES mcp_server_user(id) ON DELETE CASCADE,
    connection_date DATE DEFAULT CURRENT_DATE,
    connection_timestamp BIGINT DEFAULT extract(epoch from now()) * 1000,
    session_data JSONB,                        -- Additional session metadata
    expires_at BIGINT,                         -- Session expiration
    revoked_at BIGINT                          -- Manual session revocation
);

-- Analytics tables that reference captured users
CREATE TABLE mcp_tool_calls (
    id TEXT PRIMARY KEY DEFAULT 'mtc_' || nanoid(12),
    mcp_server_user_id TEXT REFERENCES mcp_server_user(id) ON DELETE CASCADE,
    mcp_server_slug TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    input JSONB,
    output JSONB,
    execution_time_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

CREATE TABLE walkthrough_progress (
    id TEXT PRIMARY KEY DEFAULT 'wtp_' || nanoid(12),
    mcp_server_user_id TEXT REFERENCES mcp_server_user(id) ON DELETE CASCADE,
    walkthrough_id TEXT NOT NULL,
    completed_steps JSONB DEFAULT '[]'::jsonb,
    current_step INTEGER DEFAULT 0,
    started_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    last_activity_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    completed_at BIGINT
);
```

## 🔄 User Capture Flow Implementation

### Step 1: OAuth Token Exchange

Located in `/oauth/callback/route.ts`:

```typescript
// Exchange authorization code for access token with upstream OAuth provider
const tokenResponse = await fetch(customOAuthConfig.tokenUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
            `${customOAuthConfig.clientId}:${customOAuthConfig.clientSecret}`
        ).toString('base64')}`
    },
    body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: callbackUrl,
        client_id: customOAuthConfig.clientId,
        client_secret: customOAuthConfig.clientSecret
    })
})

if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed: ${tokenResponse.status}`)
}

const tokenData = await tokenResponse.json()
// Result: { access_token, refresh_token, expires_in, token_type }
```

### Step 2: User Profile Retrieval

```typescript
// Fetch user profile from OAuth provider's userinfo endpoint
const userinfoResponse = await fetch(customOAuthConfig.userinfoUrl, {
    headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
    }
})

if (!userinfoResponse.ok) {
    throw new Error(`Userinfo fetch failed: ${userinfoResponse.status}`)
}

const profileData = await userinfoResponse.json()

// Extract standardized fields
const email = profileData.email
const upstreamSub = profileData.sub  // OAuth provider's unique user identifier
const name = profileData.name || profileData.preferred_username
const picture = profileData.picture

console.log('OAuth Profile Data:', {
    sub: upstreamSub,
    email,
    name,
    provider: customOAuthConfig.provider
})
```

### Step 3: Organization-Scoped User Deduplication

This is the most sophisticated part - deduplicating users within organization boundaries:

```typescript
/**
 * Find existing user within the same organization
 * Matches by email OR upstream_sub to handle provider switches
 * Organization boundary ensures privacy isolation
 */
const existingUserQuery = db
    .selectDistinct({ userId: schema.mcpServerUser.id })
    .from(schema.mcpServerUser)
    .leftJoin(
        schema.mcpServerSession,
        eq(schema.mcpServerSession.mcpServerUserId, schema.mcpServerUser.id)
    )
    .leftJoin(
        schema.mcpServers,
        eq(schema.mcpServers.slug, schema.mcpServerSession.mcpServerSlug)
    )
    .where(
        and(
            // CRITICAL: Organization boundary enforcement
            eq(schema.mcpServers.organizationId, customOAuthConfig.organizationId),

            // Flexible user matching - email OR upstream_sub
            email && upstreamSub
                ? sql`(${schema.mcpServerUser.email} = ${email} OR ${schema.mcpServerUser.upstreamSub} = ${upstreamSub})`
                : email
                    ? eq(schema.mcpServerUser.email, email)
                    : eq(schema.mcpServerUser.upstreamSub, upstreamSub)
        )
    )
    .limit(1)

const [existingUser] = await existingUserQuery
let mcpServerUserId: string
```

### Step 4A: Update Existing User

```typescript
if (existingUser) {
    mcpServerUserId = existingUser.userId
    console.log('Found existing MCP user:', mcpServerUserId)

    // Update user profile with latest OAuth provider data
    await db
        .update(schema.mcpServerUser)
        .set({
            email: email || undefined,              // Update if provided
            upstreamSub: upstreamSub || undefined,  // Update if provided
            profileData: profileData,               // Always update full profile
            // Preserve first_seen_at and other creation fields
        })
        .where(eq(schema.mcpServerUser.id, mcpServerUserId))

    console.log('Updated existing user profile')
}
```

### Step 4B: Create New User

```typescript
if (!mcpServerUserId) {
    console.log('Creating new MCP user:', { email, upstreamSub, provider: customOAuthConfig.provider })

    const [newUser] = await db
        .insert(schema.mcpServerUser)
        .values({
            // id is auto-generated with 'mcpu_' prefix
            trackingId: nanoid(16),  // For analytics correlation
            email: email,
            upstreamSub: upstreamSub,
            profileData: profileData,  // Store complete OAuth response
            // first_seen_at is auto-generated
        })
        .returning()

    mcpServerUserId = newUser.id
    console.log('Created new MCP user:', mcpServerUserId)
}
```

### Step 5: Store Upstream OAuth Tokens

```typescript
// Store the upstream OAuth tokens for future API calls
const [upstreamToken] = await db
    .insert(schema.upstreamOAuthTokens)
    .values({
        mcpServerUserId: mcpServerUserId,
        oauthConfigId: customOAuthConfig.id,
        accessToken: tokenData.access_token,    // TODO: Encrypt in production
        refreshToken: tokenData.refresh_token,  // TODO: Encrypt in production
        expiresAt: tokenData.expires_in
            ? Date.now() + tokenData.expires_in * 1000
            : null,
        // created_at and updated_at are auto-generated
    })
    .onConflictDoUpdate({
        target: [schema.upstreamOAuthTokens.mcpServerUserId, schema.upstreamOAuthTokens.oauthConfigId],
        set: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: tokenData.expires_in
                ? Date.now() + tokenData.expires_in * 1000
                : null,
            updatedAt: Date.now()
        }
    })
    .returning()

console.log('Stored/updated upstream OAuth tokens')
```

### Step 6: Create MCP Server Session

```typescript
// Link the captured user to the specific MCP server
const [mcpServerSession] = await db
    .insert(schema.mcpServerSession)
    .values({
        mcpServerSlug: mcpServerSlug,           // From subdomain resolution
        mcpServerUserId: mcpServerUserId,       // Captured/found user
        sessionData: {
            oauthProvider: customOAuthConfig.provider,
            loginMethod: 'oauth_callback',
            userAgent: request.headers.get('user-agent'),
            ipAddress: getClientIP(request),     // For security logging
            oauthConfigId: customOAuthConfig.id
        },
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
        // connection_date, connection_timestamp auto-generated
    })
    .returning()

console.log('Created MCP server session:', mcpServerSession.mcpServerSessionId)
```

## 🎯 Key Features and Benefits

### 1. Organization-Scoped Deduplication

**Problem Solved**: Prevent cross-organization user data leakage while allowing proper deduplication within organization boundaries.

**Implementation**:
```typescript
// ALWAYS include organization boundary in user queries
and(
    eq(schema.mcpServers.organizationId, customOAuthConfig.organizationId),
    // ... other conditions
)
```

**Benefit**: Same email address creates separate users across different organizations, maintaining privacy isolation.

### 2. Multi-Field User Matching

**Problem Solved**: Handle cases where users change email addresses or switch OAuth providers while maintaining the same identity.

**Implementation**:
```typescript
// Match by email OR upstream_sub
sql`(${schema.mcpServerUser.email} = ${email} OR ${schema.mcpServerUser.upstreamSub} = ${upstreamSub})`
```

**Scenarios Handled**:
- User changes email in Google but keeps same Google account → Matched by `upstream_sub`
- User switches from Google to GitHub OAuth → Matched by `email`
- User uses same email across multiple OAuth providers → Consolidated to single user

### 3. Complete Profile Data Storage

**Problem Solved**: Preserve all OAuth provider data for future analytics and user experience features.

**Implementation**:
```typescript
profileData: {
    "sub": "12345",
    "email": "user@company.com",
    "name": "John Doe",
    "picture": "https://...",
    "email_verified": true,
    "locale": "en",
    "given_name": "John",
    "family_name": "Doe",
    // ... any other OAuth claims from provider
}
```

**Benefits**:
- Rich user profiles for personalization
- Audit trail of OAuth provider changes
- Support for future features requiring additional claims

### 4. Token Relationship Management

**Problem Solved**: Enable future API calls to OAuth providers on behalf of users.

**Use Cases**:
- Refresh expired tokens
- Make API calls to user's Google Drive, GitHub repos, etc.
- Implement "Connect with [Provider]" features for MCP tools

## 📊 Analytics Integration

The captured user data integrates seamlessly with analytics:

### Tool Usage Tracking
```typescript
// Every MCP tool call references the captured user
await db.insert(schema.mcpToolCalls).values({
    mcpServerUserId: session.mcpServerUserId,  // From captured user system
    mcpServerSlug: mcpServerSlug,
    toolName: toolName,
    input: toolInput,
    output: toolOutput,
    executionTimeMs: executionTime,
    success: success
})
```

### User Journey Analytics
```typescript
// Track user progress through onboarding flows
await db.insert(schema.walkthroughProgress).values({
    mcpServerUserId: session.mcpServerUserId,  // From captured user system
    walkthroughId: walkthroughId,
    completedSteps: [...completedSteps, currentStep],
    lastActivityAt: Date.now()
})
```

### Engagement Metrics
- **First-time vs Returning Users**: Based on `first_seen_at`
- **Cross-Session Activity**: Via `mcp_server_session` table
- **Tool Usage Patterns**: Via `mcp_tool_calls` linked to users
- **Onboarding Completion**: Via `walkthrough_progress` tracking

## 🛡️ Security and Privacy Considerations

### 1. Data Encryption
```typescript
// TODO: Production implementation should encrypt sensitive tokens
const encryptedAccessToken = await encrypt(tokenData.access_token, process.env.TOKEN_ENCRYPTION_KEY)
const encryptedRefreshToken = await encrypt(tokenData.refresh_token, process.env.TOKEN_ENCRYPTION_KEY)
```

### 2. Organization Isolation
```typescript
// CRITICAL: Every query must include organization boundary
const userQuery = db.select()
    .from(schema.mcpServerUser)
    .where(and(
        // Always filter by organization
        eq(schema.mcpServers.organizationId, currentOrganizationId),
        // ... other conditions
    ))
```

### 3. Data Retention
```typescript
// Implement automatic cleanup of old sessions and tokens
const cleanupOldSessions = async () => {
    await db.delete(schema.mcpServerSession)
        .where(lt(schema.mcpServerSession.expiresAt, Date.now()))

    await db.delete(schema.upstreamOAuthTokens)
        .where(lt(schema.upstreamOAuthTokens.expiresAt, Date.now()))
}
```

### 4. Audit Logging
```typescript
// Log all user creation and updates for security auditing
console.log('User Capture Event:', {
    action: existingUser ? 'user_updated' : 'user_created',
    mcpServerUserId: mcpServerUserId,
    organizationId: customOAuthConfig.organizationId,
    oauthProvider: customOAuthConfig.provider,
    timestamp: Date.now(),
    sessionId: mcpServerSession.mcpServerSessionId
})
```

## 🚀 Implementation Checklist

### Database Schema
- [ ] Create `mcp_server_user` table with proper indexes
- [ ] Create `upstream_oauth_tokens` table
- [ ] Create `mcp_server_session` table
- [ ] Create analytics tables (`mcp_tool_calls`, `walkthrough_progress`)
- [ ] Set up foreign key constraints and cascade deletes

### OAuth Callback Handler
- [ ] Implement token exchange with upstream OAuth providers
- [ ] Implement userinfo profile fetching
- [ ] Implement organization-scoped user deduplication logic
- [ ] Implement user creation/update flow
- [ ] Implement upstream token storage
- [ ] Implement MCP server session creation

### Security Implementation
- [ ] Add token encryption for production
- [ ] Implement organization boundary enforcement in all queries
- [ ] Add audit logging for user capture events
- [ ] Implement data retention and cleanup jobs
- [ ] Add rate limiting on OAuth endpoints

### Analytics Integration
- [ ] Update all tool call logging to reference captured users
- [ ] Update walkthrough tracking to reference captured users
- [ ] Implement user engagement metrics calculation
- [ ] Create user analytics dashboard queries

### Testing
- [ ] Test user deduplication across OAuth providers
- [ ] Test organization isolation (cross-org user separation)
- [ ] Test token refresh and expiration handling
- [ ] Test session management and cleanup
- [ ] Test analytics data flow

## 📈 Business Value

This user capture system transforms MCP-obs from an anonymous OAuth proxy into a comprehensive user analytics platform:

1. **Customer Insights**: Organizations can see who uses their MCP servers and how
2. **Usage Analytics**: Track tool adoption, user engagement, and feature utilization
3. **User Experience**: Enable personalized experiences and user-specific optimizations
4. **Business Intelligence**: Understand user behavior patterns and optimize product-market fit
5. **Compliance**: Maintain proper data boundaries while enabling rich analytics

The captured user data becomes the foundation for all advanced analytics, personalization, and business intelligence features that differentiate MCP-obs from basic OAuth proxy solutions.