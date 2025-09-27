# MCPlatform MCP Authentication Guide

## Overview

MCPlatform implements a comprehensive MCP authentication system that follows the dual-schema pattern with Better Auth integration and user capture analytics. This guide covers the complete authentication architecture including OAuth 2.1 server functionality and user capture system.

## Table Categories

### 1. Better Auth Core Tables (Authentication)

These tables handle the actual authentication flow and are mapped to Better Auth's expected schema:

#### `mcp_end_user`
**Purpose**: Primary user authentication table for Better Auth
**Usage**: Stores authenticated users who access MCP servers
**Key Fields**:
- `id` (UUID): Primary key
- `email`, `emailVerified`: User identity
- `name`, `image`: Profile information
- `passwordHash`: Encrypted password (if using email/password auth)
- `googleId`, `githubId`: Social OAuth identifiers

**Better Auth Mapping**: Maps to Better Auth's `user` table

#### `mcp_session`
**Purpose**: User session management
**Usage**: Tracks active user sessions with Better Auth
**Key Fields**:
- `token`: Session token (unique)
- `userId`: References `mcp_end_user.id`
- `expiresAt`: Session expiration
- `ipAddress`, `userAgent`: Security tracking
- `activeOrganizationId`: Organization context
- `mcpServerId`: MCP server context

**Better Auth Mapping**: Maps to Better Auth's `session` table

#### `mcp_account`
**Purpose**: Social OAuth account linking
**Usage**: Links users to their social providers (Google, GitHub, etc.)
**Key Fields**:
- `accountId`: Provider-specific user ID
- `providerId`: OAuth provider ('google', 'github')
- `userId`: References `mcp_end_user.id`
- `accessToken`, `refreshToken`: OAuth tokens
- `scope`: Granted permissions

**Better Auth Mapping**: Maps to Better Auth's `account` table

#### `mcp_verification`
**Purpose**: Email verification and password reset
**Usage**: Temporary verification codes for security flows
**Key Fields**:
- `identifier`: Email or user identifier
- `value`: Verification code/token
- `expiresAt`: Code expiration

**Better Auth Mapping**: Maps to Better Auth's `verification` table

### 2. OAuth 2.1 Server Tables

These tables implement the OAuth 2.1 authorization server functionality:

#### `mcp_oauth_client`
**Purpose**: Registered OAuth clients
**Usage**: Stores dynamically registered OAuth clients (RFC 7591)
**Key Fields**:
- `clientId`: OAuth client identifier
- `clientSecret`: Client secret (nullable for PKCE-only)
- `clientName`: Human-readable client name
- `redirectUris`: Allowed callback URLs
- `mcpServerId`: Associated MCP server

#### `mcp_oauth_code`
**Purpose**: Temporary authorization codes
**Usage**: PKCE authorization codes (short-lived, 10 minutes)
**Key Fields**:
- `authorizationCode`: The authorization code
- `codeChallenge`, `codeChallengeMethod`: PKCE challenge
- `clientId`: OAuth client
- `userId`: References `mcp_end_user.id`
- `expiresAt`: Code expiration
- `usedAt`: Tracks if code was exchanged

#### `mcp_oauth_token`
**Purpose**: OAuth access and refresh tokens
**Usage**: Long-lived tokens for API access
**Key Fields**:
- `accessToken`: Bearer token for API calls
- `refreshToken`: Token for refreshing access
- `clientId`: OAuth client
- `userId`: References `mcp_end_user.id`
- `mcpServerId`: Server context
- `expiresAt`: Token expiration

#### `mcp_oauth_consent`
**Purpose**: User consent records
**Usage**: Tracks what permissions users granted to clients
**Key Fields**:
- `userId`: References `mcp_end_user.id`
- `clientId`: OAuth client
- `scope`: Granted permissions
- `granted`: Consent status

### 3. User Capture System (Analytics)

These tables bridge authentication to business intelligence:

#### `mcp_server_user`
**Purpose**: User capture and analytics tracking
**Usage**: Deduplicates and tracks users across MCP servers for business intelligence
**Key Fields**:
- `id`: Analytics user ID (format: `mcpu_*`)
- `trackingId`: Unique analytics identifier
- `email`: User email (may be normalized)
- `upstreamSub`: OAuth provider's subject claim
- `profileData`: Full OAuth profile response (JSONB)
- `firstSeenAt`: First interaction timestamp

**Relationship to `mcp_end_user`**:
- Different purpose: `mcp_end_user` = authentication, `mcp_server_user` = analytics
- Created when a user interacts with MCP servers
- Links authentication identity to business metrics

#### `mcp_server_session`
**Purpose**: Server-specific user sessions
**Usage**: Tracks user activity per MCP server
**Key Fields**:
- `mcpServerSlug`: Server identifier
- `mcpServerUserId`: References `mcp_server_user.id`
- `sessionData`: Server-specific session info
- `connectionTimestamp`: Session start time

#### `mcp_tool_calls`
**Purpose**: MCP tool usage analytics
**Usage**: Tracks every tool call for usage metrics and billing
**Key Fields**:
- `mcpServerUserId`: References `mcp_server_user.id`
- `mcpServerSlug`: Server context
- `toolName`: Called tool name
- `input`, `output`: Tool parameters and results
- `executionTimeMs`: Performance metrics
- `success`: Success/failure tracking

#### `upstream_oauth_tokens`
**Purpose**: External OAuth tokens storage
**Usage**: Stores tokens from upstream OAuth providers
**Key Fields**:
- `mcpServerUserId`: References `mcp_server_user.id`
- `oauthConfigId`: OAuth provider configuration
- `accessToken`, `refreshToken`: Encrypted tokens
- `expiresAt`: Token expiration

## Data Flow

### Authentication Flow
1. User visits MCP server → OAuth authorization request
2. User authenticates → `mcp_end_user` record created/updated
3. Session established → `mcp_session` record created
4. Authorization granted → `mcp_oauth_code` created
5. Code exchanged → `mcp_oauth_token` created

### User Capture Flow
1. Authenticated user interacts with MCP server
2. `mcp_server_user` record created (if first time)
3. `mcp_server_session` tracks server-specific activity
4. Tool calls logged in `mcp_tool_calls`

## Key Differences: mcp_end_user vs mcp_server_user

| Aspect | mcp_end_user | mcp_server_user |
|--------|--------------|-----------------|
| **Purpose** | Authentication identity | Analytics/business intelligence |
| **Created When** | User registers/signs in | User interacts with MCP servers |
| **Primary Use** | Better Auth sessions | Usage tracking, billing |
| **Data Type** | Identity data (email, name) | Behavioral data (tools, metrics) |
| **Lifecycle** | Long-lived (user account) | Activity-based (per interaction) |
| **Privacy Level** | PII (personally identifiable) | Pseudonymized analytics |

## Complete Schema Implementation

```typescript
// packages/database/src/mcp-auth-schema.ts

// Better Auth compatible tables
export const mcpEndUser = pgTable('mcp_end_user', {
  id: text('id').primaryKey().$defaultFn(() => `mcpeu_${nanoid(12)}`),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  image: text('image'),
  passwordHash: text('password_hash'),
  googleId: text('google_id'),
  githubId: text('github_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const mcpSession = pgTable('mcp_session', {
  id: text('id').primaryKey().$defaultFn(() => `mcps_${nanoid(12)}`),
  token: text('token').notNull().unique(),
  userId: text('user_id').notNull().references(() => mcpEndUser.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  activeOrganizationId: text('active_organization_id'),
  mcpServerId: text('mcp_server_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const mcpAccount = pgTable('mcp_account', {
  id: text('id').primaryKey().$defaultFn(() => `mcpa_${nanoid(12)}`),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => mcpEndUser.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const mcpVerification = pgTable('mcp_verification', {
  id: text('id').primaryKey().$defaultFn(() => `mcpv_${nanoid(12)}`),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// OAuth 2.1 Server tables
export const mcpOAuthClient = pgTable('mcp_oauth_client', {
  id: text('id').primaryKey().$defaultFn(() => `mcpoc_${nanoid(12)}`),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret'), // Nullable for PKCE-only clients
  clientName: text('client_name').notNull(),
  redirectUris: json('redirect_uris').$type<string[]>().notNull(),
  mcpServerId: text('mcp_server_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const mcpOAuthCode = pgTable('mcp_oauth_code', {
  id: text('id').primaryKey().$defaultFn(() => `mcpoc_${nanoid(12)}`),
  authorizationCode: text('authorization_code').notNull().unique(),
  codeChallenge: text('code_challenge'),
  codeChallengeMethod: text('code_challenge_method'),
  clientId: text('client_id').notNull(),
  userId: text('user_id').notNull().references(() => mcpEndUser.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  scope: text('scope'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const mcpOAuthToken = pgTable('mcp_oauth_token', {
  id: text('id').primaryKey().$defaultFn(() => `mcpot_${nanoid(12)}`),
  accessToken: text('access_token').notNull().unique(),
  refreshToken: text('refresh_token'),
  tokenType: text('token_type').notNull().default('Bearer'),
  clientId: text('client_id').notNull(),
  userId: text('user_id').notNull().references(() => mcpEndUser.id, { onDelete: 'cascade' }),
  mcpServerId: text('mcp_server_id').notNull(),
  scope: text('scope'),
  expiresAt: timestamp('expires_at').notNull(),
  refreshExpiresAt: timestamp('refresh_expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const mcpOAuthConsent = pgTable('mcp_oauth_consent', {
  id: text('id').primaryKey().$defaultFn(() => `mcpoc_${nanoid(12)}`),
  userId: text('user_id').notNull().references(() => mcpEndUser.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull(),
  scope: text('scope').notNull(),
  granted: boolean('granted').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// User capture and analytics tables
export const mcpServerUser = pgTable('mcp_server_user', {
  id: text('id').primaryKey().$defaultFn(() => `mcpu_${nanoid(12)}`),
  trackingId: text('tracking_id').unique().$defaultFn(() => `track_${nanoid(16)}`),
  email: text('email'),
  upstreamSub: text('upstream_sub'),
  profileData: json('profile_data').$type<{
    name?: string;
    image?: string;
    emailVerified?: boolean;
    [key: string]: any;
  }>(),
  firstSeenAt: bigint('first_seen_at', { mode: 'number' }).notNull().$defaultFn(() => Date.now()),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const mcpServerSession = pgTable('mcp_server_session', {
  id: text('id').primaryKey().$defaultFn(() => `mcpss_${nanoid(12)}`),
  mcpServerSlug: text('mcp_server_slug').notNull(),
  mcpServerUserId: text('mcp_server_user_id').notNull().references(() => mcpServerUser.id, { onDelete: 'cascade' }),
  sessionData: json('session_data').$type<{
    betterAuthUserId?: string;
    organizationId?: string;
    [key: string]: any;
  }>(),
  connectionTimestamp: bigint('connection_timestamp', { mode: 'number' }).notNull().$defaultFn(() => Date.now()),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const mcpToolCalls = pgTable('mcp_tool_calls', {
  id: text('id').primaryKey().$defaultFn(() => `mcptc_${nanoid(12)}`),
  mcpServerUserId: text('mcp_server_user_id').notNull().references(() => mcpServerUser.id, { onDelete: 'cascade' }),
  mcpServerSlug: text('mcp_server_slug').notNull(),
  toolName: text('tool_name').notNull(),
  input: json('input'),
  output: json('output'),
  executionTimeMs: integer('execution_time_ms'),
  success: boolean('success').notNull().default(true),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull().$defaultFn(() => Date.now()),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const upstreamOAuthTokens = pgTable('upstream_oauth_tokens', {
  id: text('id').primaryKey().$defaultFn(() => `uot_${nanoid(12)}`),
  mcpServerUserId: text('mcp_server_user_id').notNull().references(() => mcpServerUser.id, { onDelete: 'cascade' }),
  oauthConfigId: text('oauth_config_id').notNull(),
  provider: text('provider').notNull(),
  accessToken: text('access_token').notNull(), // Should be encrypted
  refreshToken: text('refresh_token'), // Should be encrypted
  idToken: text('id_token'),
  scope: text('scope'),
  expiresAt: timestamp('expires_at'),
  refreshExpiresAt: timestamp('refresh_expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

## Authentication Integration Points

### Server/Client Boundary Management

```typescript
// /lib/auth/session.ts - Server-only utilities
import 'server-only'
import { headers } from 'next/headers'

export const requireMcpSession = async () => {
  const headersList = await headers()

  try {
    const session = await mcpAuth.api.getSession({ headers: headersList })

    if (!session || !session.user) {
      throw new Error('Authentication required')
    }

    return session
  } catch (error) {
    throw new Error('Failed to get session')
  }
}

// /lib/auth/server.ts - Server utilities
export const getMcpServerSession = async () => {
  const headersList = await headers()

  try {
    const session = await mcpAuth.api.getSession({ headers: headersList })
    return {
      user: session?.user || null,
      session: session?.session || null,
    }
  } catch (error) {
    return { user: null, session: null }
  }
}
```

### Organization-Scoped Security

```typescript
// Always verify user has access to organization
export async function verifyOrganizationAccess(userId: string, organizationId: string) {
  const userMemberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))

  return userMemberships.some(m => m.organizationId === organizationId)
}

// Scope all queries to user's accessible organizations
export async function getUserOrganizations(userId: string) {
  return await db
    .select()
    .from(organization)
    .innerJoin(member, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId))
}
```

## Security Considerations

1. **Token Encryption**: All OAuth tokens should be encrypted at rest
2. **PII Handling**: `mcp_end_user` contains PII, `mcp_server_user` can be pseudonymized
3. **Session Security**: IP address and user agent tracking for security
4. **Data Retention**: Different retention policies for auth vs analytics data
5. **Organization Boundaries**: All database operations must respect organization scoping

## Integration Points

- **Better Auth**: Maps core auth tables (`user`, `session`, `account`, `verification`)
- **OAuth 2.1**: Implements RFC 6749, RFC 7636 (PKCE), RFC 7591 (Dynamic Registration)
- **MCP Servers**: User capture bridges authentication to server-specific analytics
- **Business Intelligence**: Analytics tables feed into usage reporting and billing

## Migration Strategy

When deploying:

1. Run migrations for all auth tables
2. Ensure Better Auth schema mapping is correct
3. Set up proper foreign key constraints
4. Configure token encryption for production
5. Set up data retention policies
6. Configure organization-scoped access controls
7. Set up analytics data collection and reporting

This dual-schema approach provides both robust authentication and detailed business intelligence while maintaining clear separation of concerns and full Better Auth compatibility.