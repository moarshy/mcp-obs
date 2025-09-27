# 🔐 MCP OAuth Authentication: Complete Implementation Guide

Based on MCPlatform's proven architecture for subdomain-scoped OAuth authentication.

## 🏗️ System Architecture

MCPlatform implements a sophisticated dual authentication system with subdomain-scoped OAuth that supports both platform OAuth and custom third-party OAuth providers.

### Core Components

1. **Platform Authentication**: Dashboard users (Better Auth primary instance)
2. **MCP Authentication**: End-users accessing MCP servers (Better Auth secondary instance with MCP plugin)
3. **Subdomain Resolution**: Each MCP server gets its own subdomain and OAuth configuration
4. **Proxy OAuth**: Centralized handling of third-party OAuth providers per MCP server

## 🔍 1. OAuth Discovery Implementation

**Route**: `/.well-known/oauth-authorization-server`

### Key Features
- **Subdomain Detection**: Extracts subdomain from Host header to identify MCP server
- **Multi-Provider Support**: Supports both platform OAuth and custom OAuth configurations
- **Dynamic Metadata**: Returns OAuth endpoints tailored to each MCP server's configuration

```typescript
// Extract subdomain from request host
const subdomain = host.split('.')[0]

// Look up MCP server configuration by subdomain slug
const [mcpServerConfig] = await db
    .select()
    .from(schema.mcpServers)
    .where(eq(schema.mcpServers.slug, subdomain))
```

### Authentication Types Supported

1. **Platform OAuth** (`platform_oauth`):
   - Uses MCPlatform's Better Auth MCP instance
   - Endpoints: `/mcp-oidc/auth/mcp/*`

2. **Custom OAuth** (`custom_oauth`):
   - Proxy endpoints for third-party OAuth providers
   - Endpoints: `/oauth/*` (subdomain-scoped)

## 🏷️ 2. Database Schema for MCP Authentication

**MCP OAuth Tables (Separate from Platform)**:

```sql
-- End-users of MCP servers (NOT dashboard users)
mcp_oauth_user (id, name, email, email_verified, image)
mcp_oauth_session (id, expires_at, token, user_id)
mcp_oauth_account (id, provider_id, user_id, access_token, refresh_token)
mcp_oauth_application (id, name, client_id, client_secret, redirect_urls)
mcp_oauth_access_token (id, access_token, refresh_token, expires_at)
mcp_oauth_consent (id, scope, client_id, user_id)

-- Registration and authorization sessions
mcp_client_registrations (id, mcp_server_id, client_id, client_secret, redirect_uris)
mcp_authorization_sessions (id, state, client_state, redirect_uri, expires_at)
```

## 📝 3. Client Registration Flow

**Route**: `/oauth/register` (on each subdomain)

### Registration Process
1. **Subdomain Resolution**: Identifies MCP server from subdomain
2. **Client Validation**: Validates registration request parameters
3. **Credential Generation**: Creates unique client_id and client_secret per registration
4. **Database Storage**: Stores client registration linked to MCP server

```typescript
// Generate unique credentials
const clientId = `client_${nanoid(24)}`
const clientSecret = nanoid(64)

// Store client registration
await db.insert(schema.mcpClientRegistrations).values({
    mcpServerId: mcpServer.id,
    clientId,
    clientSecret,
    redirectUris: redirect_uris
})
```

## 🔐 4. Authorization Code Flow with Subdomain Handling

**Route**: `/oauth/authorize` (on each subdomain)

### Authorization Flow
1. **Parameter Validation**: RFC 6749 compliant with PKCE support
2. **Subdomain Resolution**: Extracts MCP server from host header
3. **Client Registration Validation**: Verifies client is registered for this MCP server
4. **Redirect URI Validation**: Ensures redirect_uri matches registered URIs
5. **Session Storage**: Creates temporary authorization session
6. **Upstream Redirect**: Redirects to configured OAuth provider

```typescript
// Subdomain extraction and MCP server lookup
const subdomain = host.split('.')[0]
const [mcpServer] = await db.select().from(schema.mcpServers)
    .where(eq(schema.mcpServers.slug, subdomain))

// Validate client registration
const [clientReg] = await db.select().from(schema.mcpClientRegistrations)
    .where(and(
        eq(schema.mcpClientRegistrations.mcpServerId, mcpServer.id),
        eq(schema.mcpClientRegistrations.clientId, client_id)
    ))

// Store authorization session
await db.insert(schema.mcpAuthorizationSessions).values({
    mcpClientRegistrationId: clientReg.id,
    state: oauthState,
    clientState: state,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
})
```

## ↩️ 5. OAuth Callback Handling

**Route**: `/oauth/callback` (centralized, not subdomain-scoped)

### Callback Process
1. **Authorization Session Lookup**: Finds session by state parameter
2. **Upstream Token Exchange**: Exchanges authorization code for access token
3. **User Info Retrieval**: Fetches user information from OAuth provider
4. **User Creation/Update**: Creates or updates MCP OAuth user
5. **Authorization Code Generation**: Creates code for client application
6. **Final Redirect**: Redirects back to client application with authorization code

```typescript
// Look up authorization session
const [session] = await db.select().from(schema.mcpAuthorizationSessions)
    .where(and(
        eq(schema.mcpAuthorizationSessions.state, state),
        gt(schema.mcpAuthorizationSessions.expiresAt, Date.now())
    ))

// Exchange code for token with upstream OAuth provider
const tokenResponse = await fetch(customOAuthConfig.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: upstreamCode,
        redirect_uri: callbackUrl,
        client_id: customOAuthConfig.clientId,
        client_secret: customOAuthConfig.clientSecret
    })
})
```

## 🎫 6. Token Exchange Implementation

**Route**: `/oauth/token` (on each subdomain)

### Token Exchange Process
1. **Grant Type Support**: authorization_code and refresh_token
2. **PKCE Verification**: Validates code_verifier against stored code_challenge
3. **Client Authentication**: Basic auth or form-based client credentials
4. **Token Generation**: Creates access_token and refresh_token
5. **JWT/Opaque Tokens**: Configurable token format

```typescript
// PKCE verification
if (authCode.codeChallenge && !body.code_verifier) {
    return errorResponse('invalid_request', 'code_verifier required')
}
if (authCode.codeChallenge) {
    const isValidChallenge = verifyPKCEChallenge(
        body.code_verifier,
        authCode.codeChallenge
    )
    if (!isValidChallenge) {
        return errorResponse('invalid_grant', 'Invalid code_verifier')
    }
}

// Generate tokens
const accessToken = nanoid(64)
const refreshToken = nanoid(64)
const expiresIn = 3600 // 1 hour

await db.insert(schema.mcpOAuthAccessToken).values({
    accessToken,
    refreshToken,
    userId: user.id,
    clientId: client_id,
    scope: authCode.scope,
    accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000)
})
```

## 🌐 7. Subdomain Resolution Integration

### Host Header Processing

```typescript
// Extract subdomain from host header
function extractSubdomain(host: string): string {
    const parts = host.split('.')
    if (host.includes('localhost') && parts.length >= 2) {
        return parts[0] // localhost:3000 -> takes first part
    }
    if (!host.includes('localhost') && parts.length >= 3) {
        return parts[0] // subdomain.domain.com -> 'subdomain'
    }
    throw new Error('Invalid host format')
}
```

### MCP Server Resolution

```typescript
// Every OAuth endpoint starts with subdomain resolution
const subdomain = extractSubdomain(request.headers.get('host'))
const [mcpServer] = await db.select().from(schema.mcpServers)
    .where(eq(schema.mcpServers.slug, subdomain))

if (!mcpServer) {
    return new Response('MCP server not found', { status: 404 })
}
```

## 🔄 8. Complete OAuth Flow Example

### Step-by-Step Flow
1. **Discovery**: `GET https://acme.mcplatform.com/.well-known/oauth-authorization-server`
2. **Registration**: `POST https://acme.mcplatform.com/oauth/register`
3. **Authorization**: `GET https://acme.mcplatform.com/oauth/authorize?client_id=xxx&redirect_uri=xxx`
4. **Callback**: `GET https://mcplatform.com/oauth/callback?code=xxx&state=xxx` (centralized)
5. **Token Exchange**: `POST https://acme.mcplatform.com/oauth/token`
6. **User Info**: `GET https://acme.mcplatform.com/oauth/userinfo`

### Authentication Flow for End Users
1. **Login Page**: `/mcp-oidc/login` - Email/password + social providers
2. **Better Auth MCP**: Secondary Better Auth instance handles MCP users
3. **Session Management**: Separate session tables for MCP users
4. **Cross-Subdomain Cookies**: Configured for `*.domain.com` access

## 🛠️ 9. Implementation Setup Guide

### Environment Variables

```bash
# Platform Base URL (used for callback URLs)
NEXT_PUBLIC_BETTER_AUTH_URL=https://mcplatform.com

# OAuth Provider Credentials (per MCP server)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

### Better Auth Configuration

```typescript
// Secondary Better Auth instance for MCP
export const auth = betterAuth({
    basePath: '/mcp-oidc/auth',
    database: drizzleAdapter(db, {
        schema: {
            user: mcpOAuthUser,
            session: mcpOAuthSession,
            account: mcpOAuthAccount,
            // ... other MCP schema
        }
    }),
    plugins: [mcp({ loginPage: '/mcp-oidc/login' })],
    trustedOrigins: [`*.${baseDomain}`],
    advanced: {
        crossSubDomainCookies: { enabled: true }
    }
})
```

## 🎯 Key Implementation Details

- **Dual Authentication**: Completely separate user bases and sessions
- **Subdomain Routing**: Every OAuth endpoint resolves MCP server first
- **Centralized Callback**: Single callback endpoint handles all providers
- **PKCE Support**: Full RFC 7636 implementation for security
- **Token Management**: Both access and refresh tokens with proper expiration
- **Error Handling**: RFC 6749 compliant error responses with proper redirects

## 📋 Implementation Checklist

### Database Schema
- [ ] Create MCP OAuth user tables (separate from platform users)
- [ ] Create client registration tables
- [ ] Create authorization session tables
- [ ] Create access token tables
- [ ] Create consent tables

### Better Auth Setup
- [ ] Configure secondary Better Auth instance for MCP
- [ ] Set up cross-subdomain cookie support
- [ ] Configure MCP-specific login pages
- [ ] Set up social OAuth providers per MCP server

### OAuth Endpoints
- [ ] Implement subdomain-aware `/oauth/authorize`
- [ ] Implement `/oauth/token` with PKCE support
- [ ] Implement centralized `/oauth/callback`
- [ ] Implement `/oauth/userinfo`
- [ ] Implement `/oauth/revoke`
- [ ] Implement `/oauth/introspect`

### Login Flow
- [ ] Create MCP login pages (`/mcp-oidc/login`)
- [ ] Implement email/password authentication
- [ ] Implement social OAuth (Google, GitHub)
- [ ] Handle authentication errors and redirects
- [ ] Implement session management

### Security & Compliance
- [ ] Implement PKCE verification
- [ ] Validate redirect URIs
- [ ] Implement rate limiting
- [ ] Add CSRF protection
- [ ] Implement proper error handling

This architecture allows mcp-obs to provide OAuth services for unlimited MCP servers, each with their own subdomain and OAuth configuration, while maintaining complete isolation between different servers and their users.