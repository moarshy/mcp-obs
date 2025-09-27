# MCP Authentication Tables Documentation

## Overview

The MCP authentication system follows the **MCPlatform dual-schema pattern** with two distinct user models:
- **Better Auth Integration**: Standard OAuth/OIDC authentication using Better Auth framework
- **User Capture System**: Business intelligence and analytics tracking

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

### Key Differences: mcp_end_user vs mcp_server_user

| Aspect | mcp_end_user | mcp_server_user |
|--------|--------------|-----------------|
| **Purpose** | Authentication identity | Analytics/business intelligence |
| **Created When** | User registers/signs in | User interacts with MCP servers |
| **Primary Use** | Better Auth sessions | Usage tracking, billing |
| **Data Type** | Identity data (email, name) | Behavioral data (tools, metrics) |
| **Lifecycle** | Long-lived (user account) | Activity-based (per interaction) |
| **Privacy Level** | PII (personally identifiable) | Pseudonymized analytics |

## Security Considerations

1. **Token Encryption**: All OAuth tokens should be encrypted at rest
2. **PII Handling**: `mcp_end_user` contains PII, `mcp_server_user` can be pseudonymized
3. **Session Security**: IP address and user agent tracking for security
4. **Data Retention**: Different retention policies for auth vs analytics data

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

This dual-schema approach provides both robust authentication and detailed business intelligence while maintaining clear separation of concerns.