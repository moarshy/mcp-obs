# Complete OAuth Flow for MCP Servers

## Overview

This document provides a comprehensive overview of how OAuth 2.1 authentication works in the mcp-obs ecosystem, from initial client discovery through authenticated tool execution. The implementation follows industry standards (RFC 6749, RFC 7662, RFC 8628) while providing seamless integration with the Model Context Protocol.

## System Architecture

### Components Overview

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   MCP Client    │    │   MCP Server with    │    │  mcp-obs Platform   │
│  (Cursor, etc)  │    │     SDK OAuth        │    │  (Authentication)   │
│                 │    │                      │    │                     │
│  ┌───────────┐  │    │  ┌────────────────┐  │    │  ┌───────────────┐  │
│  │OAuth Flow │◄─┼────┼─►│OAuth Proxy     │◄─┼────┼─►│OAuth Server   │  │
│  │Discovery  │  │    │  │Endpoints       │  │    │  │& User DB      │  │
│  └───────────┘  │    │  └────────────────┘  │    │  └───────────────┘  │
│                 │    │                      │    │                     │
│  ┌───────────┐  │    │  ┌────────────────┐  │    │  ┌───────────────┐  │
│  │MCP        │◄─┼────┼─►│OAuth           │◄─┼────┼─►│Token          │  │
│  │Requests   │  │    │  │Middleware      │  │    │  │Validation     │  │
│  └───────────┘  │    │  └────────────────┘  │    │  └───────────────┘  │
└─────────────────┘    └──────────────────────┘    └─────────────────────┘
```

### Key Participants

1. **MCP Client** (Cursor, Claude Desktop, etc.)
   - Discovers OAuth capabilities
   - Performs OAuth 2.1 PKCE flow
   - Makes authenticated MCP requests

2. **MCP Server + SDK** (Customer's server)
   - Provides OAuth discovery endpoints
   - Validates tokens via mcp-obs platform
   - Executes MCP tools with user context

3. **mcp-obs Platform** (Authentication provider)
   - Manages OAuth clients and users
   - Issues and validates tokens
   - Provides user management interface

## Complete OAuth 2.1 PKCE Flow

### Phase 1: Discovery & Registration

#### Step 1: OAuth Capability Discovery

```http
GET http://localhost:3005/.well-known/oauth-authorization-server
```

**Response:**
```json
{
  "issuer": "http://localhost:3005",
  "authorization_endpoint": "http://localhost:3005/authorize",
  "token_endpoint": "http://localhost:3005/token",
  "registration_endpoint": "http://localhost:3005/register",
  "introspection_endpoint": "http://localhost:3005/introspect",
  "scopes_supported": ["read", "write", "admin"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none", "client_secret_basic"]
}
```

**Implementation (Automatic via SDK):**
```typescript
// SDK automatically creates this endpoint
oauthAdapter.createOAuthProxyEndpoints(app);

// Proxies discovery to mcp-obs platform
GET /.well-known/oauth-authorization-server
  → GET https://mycompany.mcp-obs.com/.well-known/oauth-authorization-server
```

#### Step 2: Dynamic Client Registration (RFC 7591)

```http
POST http://localhost:3005/register
Content-Type: application/json

{
  "client_name": "Cursor",
  "redirect_uris": [
    "cursor://anysphere.cursor-retrieval/oauth/project-0-mcp-obs-demo-mcp-obs-oauth15/callback"
  ],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "application_type": "native"
}
```

**Response:**
```json
{
  "client_id": "mcp_test_1758958391917_ro7v19j7728",
  "client_name": "Cursor",
  "redirect_uris": [
    "cursor://anysphere.cursor-retrieval/oauth/project-0-mcp-obs-demo-mcp-obs-oauth15/callback"
  ],
  "scope": "read,write",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "client_id_issued_at": 1758958391,
  "mcp:server_id": "5decf338-7c1a-4ac0-bb2d-26cd25732721",
  "mcp:server_name": "test",
  "mcp:organization_id": "WNfKPX8f9had6a9gH00EMaUO3cZFLair"
}
```

**Implementation:**
```typescript
// SDK proxy handles registration
app.post('/register', async (req, res) => {
  const registrationData = {
    ...req.body,
    server_slug: this.config.serverSlug,
    organization_id: this.config.organizationId
  };

  // Proxy to mcp-obs platform
  const response = await fetch(`${this.config.platformUrl}/api/oauth/${this.config.serverSlug}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registrationData)
  });

  const result = await response.json();
  res.status(response.status).json(result);
});
```

### Phase 2: Authorization Flow (PKCE)

#### Step 3: Authorization Request with PKCE

Client generates PKCE parameters:
```typescript
// Client-side PKCE generation
const codeVerifier = generateRandomString(128); // Base64URL, 43-128 chars
const codeChallenge = base64URLEncode(sha256(codeVerifier));
const state = generateRandomString(32);
```

Authorization URL:
```http
GET http://localhost:3005/authorize?
    client_id=mcp_test_1758958391917_ro7v19j7728&
    response_type=code&
    redirect_uri=cursor://anysphere.cursor-retrieval/oauth/callback&
    scope=read,write&
    state=xyz123&
    code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
    code_challenge_method=S256
```

**Implementation (Proxy to Platform):**
```typescript
app.get('/authorize', async (req, res) => {
  // Build platform authorization URL
  const platformAuthUrl = new URL(`${this.config.platformUrl}/api/oauth/${this.config.serverSlug}/authorize`);

  // Forward all query parameters
  Object.entries(req.query).forEach(([key, value]) => {
    platformAuthUrl.searchParams.set(key, value as string);
  });

  // Redirect to platform for user authentication
  res.redirect(platformAuthUrl.toString());
});
```

#### Step 4: User Authentication (Platform UI)

User is redirected to mcp-obs platform for authentication:
```
https://mycompany.mcp-obs.com/login?
  client_id=mcp_test_1758958391917_ro7v19j7728&
  server_name=test&
  ...oauth_params
```

Platform shows user:
- Server requesting access: **"test"** by **MyCompany**
- Requested permissions: **Read and Write access**
- Login form or social OAuth options

#### Step 5: Authorization Code Response

After successful authentication, platform redirects:
```http
HTTP/1.1 302 Found
Location: cursor://anysphere.cursor-retrieval/oauth/callback?
    code=2-M6DnpPP7p15ncYVKP1FQK3WCBFn0mXU8qidty0rpBqHWEJWJDh7YuzH4Dat7uE&
    state=xyz123
```

### Phase 3: Token Exchange

#### Step 6: Authorization Code Exchange

```http
POST http://localhost:3005/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=2-M6DnpPP7p15ncYVKP1FQK3WCBFn0mXU8qidty0rpBqHWEJWJDh7YuzH4Dat7uE&
code_verifier=HIcfTbgvAublC5Qddon-.V9Wi4r-XHDd0nOMfZv~DKE&
redirect_uri=cursor://anysphere.cursor-retrieval/oauth/callback&
client_id=mcp_test_1758958391917_ro7v19j7728
```

**Response:**
```json
{
  "access_token": "mcp_at_eeJk17Y8jU0iQnrAaR4_5d7G-ZLOhIDUwuxIS3qIF5Q_VJS7pOfTIU3pRtDw1pjO",
  "token_type": "Bearer",
  "expires_in": 7200,
  "refresh_token": "mcp_rt_0aX2FoZfYnH2yT7qynJ1W7s7GWMuLZb1k9VTykUjLQQRf_6bMemkOW43a0jxk-XJ",
  "scope": "read,write",
  "mcp:server_id": "5decf338-7c1a-4ac0-bb2d-26cd25732721",
  "mcp:server_name": "test"
}
```

**Implementation:**
```typescript
app.post('/token', async (req, res) => {
  try {
    // Parse form data
    const tokenRequest = parseFormData(req.body);

    // Proxy to platform with server context
    const response = await fetch(`${this.config.platformUrl}/api/oauth/${this.config.serverSlug}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formatFormData(tokenRequest)
    });

    const tokenResponse = await response.json();
    res.status(response.status).json(tokenResponse);
  } catch (error) {
    res.status(400).json({
      error: 'invalid_request',
      error_description: error.message
    });
  }
});
```

### Phase 4: Authenticated MCP Requests

#### Step 7: MCP Session Initialization with OAuth

```http
POST http://localhost:3005/mcp
Authorization: Bearer mcp_at_eeJk17Y8jU0iQnrAaR4_5d7G-ZLOhIDUwuxIS3qIF5Q_VJS7pOfTIU3pRtDw1pjO
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "initialize",
  "id": 1,
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {}
    },
    "clientInfo": {
      "name": "Cursor",
      "version": "0.42.0"
    }
  }
}
```

**Server Processing Flow:**

1. **OAuth Middleware Validation:**
```typescript
async function oauthMiddleware(req, res, next) {
  // 1. Extract Bearer token
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Authentication required" },
      id: null
    });
  }

  // 2. Validate token with platform (with caching)
  const authContext = await validator.validateToken(token);

  if (!authContext) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Invalid token" },
      id: null
    });
  }

  // 3. Buffer request body for MCP transport
  if (req.method === 'POST') {
    const bodyBuffer = await bufferRequestBody(req);
    (req as any)._mcpOAuthBufferedBody = bodyBuffer;
  }

  // 4. Set auth context for MCP handlers
  req.authContext = authContext;
  next();
}
```

2. **MCP Session Creation:**
```typescript
app.post('/mcp', async (req, res) => {
  const authContext = (req as any).authContext;
  const sessionId = req.headers['mcp-session-id'];

  if (!sessionId && isInitializeRequest(req.body)) {
    // Create new authenticated session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId: string) => {
        // Store transport with OAuth context
        transports[sessionId] = transport;
        sessionAuthContexts[sessionId] = authContext;
        console.log(`✅ Session ${sessionId} initialized for ${authContext.user.email}`);
      }
    });

    // Create OAuth-aware MCP server
    const server = createOAuthAwareMCPServer(authContext);
    await server.connect(transport);

    // Handle request with stream reconstruction
    const bufferedBody = (req as any)._mcpOAuthBufferedBody;
    const streamableReq = recreateStreamFromBuffer(req, bufferedBody);

    await transport.handleRequest(streamableReq, res, req.body);
  }
});
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "logging": {},
      "tools": { "listChanged": true }
    },
    "serverInfo": {
      "name": "oauth-protected-server",
      "version": "1.0.0"
    }
  },
  "id": 1
}
```

**Headers:**
```http
HTTP/1.1 200 OK
mcp-session-id: 82bb1817-5aa2-4110-ae9d-33c92b2741d7
Content-Type: application/json
```

#### Step 8: Authenticated Tool Execution

```http
POST http://localhost:3005/mcp
Authorization: Bearer mcp_at_...
mcp-session-id: 82bb1817-5aa2-4110-ae9d-33c92b2741d7
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 2,
  "params": {
    "name": "search",
    "arguments": {
      "query": "user documents"
    }
  }
}
```

**Server Tool Handler:**
```typescript
function createOAuthAwareMCPServer(authContext: AuthContext): Server {
  const server = new Server({
    name: "oauth-protected-server",
    version: "1.0.0"
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Every tool has access to authenticated user
    switch (name) {
      case "search":
        return {
          content: [{
            type: "text",
            text: `Searching for "${args.query}" as ${authContext.user.email}...
                   Found 5 documents accessible to user ${authContext.user.id}.
                   User has scopes: ${authContext.scopes.join(', ')}`
          }]
        };

      case "upload":
        if (!authContext.scopes.includes('write')) {
          throw new Error('Insufficient permissions: write scope required');
        }
        return uploadFile(args, authContext);

      case "admin":
        if (!authContext.scopes.includes('admin')) {
          throw new Error('Admin access required');
        }
        return adminAction(args, authContext);
    }
  });

  return server;
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "Searching for \"user documents\" as arshy@arshy.com...\nFound 5 documents accessible to user usr_123.\nUser has scopes: read, write"
    }]
  },
  "id": 2
}
```

## Token Validation & Introspection

### Token Introspection (RFC 7662)

The SDK validates tokens using HTTP requests to the mcp-obs platform:

```http
POST https://mycompany.mcp-obs.com/api/oauth/introspect
Content-Type: application/json
Authorization: Bearer <server_api_key>

{
  "token": "mcp_at_eeJk17Y8jU0iQnrAaR4_5d7G-ZLOhIDUwuxIS3qIF5Q_VJS7pOfTIU3pRtDw1pjO",
  "server_slug": "test"
}
```

**Response (Valid Token):**
```json
{
  "active": true,
  "user": {
    "id": "usr_2Nf8K3mBwChv5a9gH00EM",
    "email": "arshy@arshy.com",
    "name": "Arshy Gill"
  },
  "scopes": ["read", "write"],
  "expires_at": 1703097600,
  "server_slug": "test",
  "client_id": "mcp_test_1758958391917_ro7v19j7728",
  "organization_id": "WNfKPX8f9had6a9gH00EMaUO3cZFLair"
}
```

**Response (Invalid Token):**
```json
{
  "active": false
}
```

### Caching Strategy

```typescript
class TokenCache {
  private cache = new Map<string, CachedToken>();
  private readonly DEFAULT_TTL = 300000; // 5 minutes
  private readonly MAX_SIZE = 1000;

  async get(token: string): Promise<AuthContext | null> {
    const cached = this.cache.get(token);

    if (cached) {
      if (cached.expiresAt > Date.now()) {
        return cached.authContext;
      }
      this.cache.delete(token);
    }

    // Cache miss - validate with platform
    const authContext = await this.validateWithPlatform(token);

    if (authContext) {
      this.set(token, authContext);
    }

    return authContext;
  }

  private set(token: string, authContext: AuthContext): void {
    // Respect token expiry with buffer
    const tokenTTL = (authContext.expiresAt * 1000) - Date.now() - 30000;
    const ttl = Math.min(Math.max(tokenTTL, 0), this.DEFAULT_TTL);

    this.cache.set(token, {
      authContext,
      expiresAt: Date.now() + ttl
    });

    // LRU eviction
    if (this.cache.size > this.MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    // Auto-cleanup
    setTimeout(() => this.cache.delete(token), ttl);
  }
}
```

## Token Refresh Flow

### Refresh Token Request

```http
POST http://localhost:3005/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
refresh_token=mcp_rt_0aX2FoZfYnH2yT7qynJ1W7s7GWMuLZb1k9VTykUjLQQRf_6bMemkOW43a0jxk-XJ&
client_id=mcp_test_1758958391917_ro7v19j7728
```

**Response:**
```json
{
  "access_token": "mcp_at_newtoken...",
  "token_type": "Bearer",
  "expires_in": 7200,
  "refresh_token": "mcp_rt_newrefreshtoken...",
  "scope": "read,write"
}
```

### Automatic Token Refresh (Client-Side)

```typescript
class OAuthMCPClient {
  private accessToken: string;
  private refreshToken: string;
  private tokenExpiryTime: number;

  async makeRequest(request: any): Promise<any> {
    // Check if token needs refresh
    if (this.tokenExpiryTime - Date.now() < 300000) { // 5 min buffer
      await this.refreshTokens();
    }

    return this.authenticatedRequest(request);
  }

  private async refreshTokens(): Promise<void> {
    const response = await fetch(`${this.serverUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId
      })
    });

    if (response.ok) {
      const tokens = await response.json();
      this.accessToken = tokens.access_token;
      this.refreshToken = tokens.refresh_token;
      this.tokenExpiryTime = Date.now() + (tokens.expires_in * 1000);
    }
  }
}
```

## Error Handling

### OAuth Error Responses

```json
{
  "error": "invalid_token",
  "error_description": "The access token provided is expired, revoked, or invalid",
  "error_uri": "https://docs.mcp-obs.com/errors#invalid_token"
}
```

### MCP Error Integration

OAuth errors are properly formatted as JSON-RPC errors:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Authentication required",
    "data": {
      "oauth_error": "invalid_token",
      "oauth_error_description": "Token has expired",
      "auth_url": "http://localhost:3005/authorize?..."
    }
  },
  "id": 1
}
```

### Session Expiry Handling

```typescript
// Automatic cleanup of expired sessions
setInterval(() => {
  const now = Date.now();

  for (const [sessionId, authContext] of Object.entries(sessionAuthContexts)) {
    if (authContext.expiresAt * 1000 < now) {
      console.log(`🧹 Cleaning up expired session ${sessionId} for ${authContext.user.email}`);
      cleanupSession(sessionId);
    }
  }
}, 300000); // Every 5 minutes

function cleanupSession(sessionId: string) {
  // Close MCP server
  if (servers[sessionId]) {
    servers[sessionId].close();
    delete servers[sessionId];
  }

  // Clean up transport
  if (transports[sessionId]) {
    delete transports[sessionId];
  }

  // Remove auth context
  delete sessionAuthContexts[sessionId];
}
```

## Security Considerations

### 1. **PKCE (RFC 7636)**
- Prevents authorization code interception attacks
- Required for public clients (native apps like Cursor)
- Uses SHA256 code challenge/verifier pairs

### 2. **Token Security**
- Access tokens are opaque, server-validated
- Short expiration times (2 hours default)
- Secure storage in client applications
- Automatic rotation via refresh tokens

### 3. **Request Validation**
- All OAuth endpoints validate client registration
- HTTPS required in production
- Rate limiting on token endpoints
- Request size limits to prevent DoS

### 4. **Multi-Tenant Isolation**
- Each server slug gets isolated OAuth configuration
- Users are scoped per organization
- No cross-tenant data access possible

## Deployment Considerations

### Development Setup
```typescript
const mcpObs = new McpObsSDK({
  serverName: "dev-server",
  version: "1.0.0",
  oauthConfig: {
    serverSlug: "mycompany-dev",
    platformUrl: "http://localhost:3000", // Local platform
    debug: true
  }
});
```

### Production Setup
```typescript
const mcpObs = new McpObsSDK({
  serverName: "prod-server",
  version: "1.0.0",
  oauthConfig: {
    serverSlug: "mycompany",
    platformUrl: "https://app.mcp-obs.com", // Hosted platform
    debug: false
  }
});
```

### Environment Variables
```bash
# Server configuration
MCP_OBS_SERVER_SLUG=mycompany
MCP_OBS_PLATFORM_URL=https://app.mcp-obs.com

# Optional overrides
MCP_OBS_DEBUG=false
MCP_OBS_CACHE_TTL=300000
MCP_OBS_MAX_CACHE_SIZE=1000
```

## Summary

The mcp-obs OAuth implementation provides:

1. **Standards Compliant**: Full OAuth 2.1 with PKCE, RFC 7662 token introspection
2. **Seamless Integration**: 2-3 lines of code to add OAuth to existing MCP servers
3. **Production Ready**: Caching, error handling, token refresh, session management
4. **Multi-Tenant**: Isolated configuration per customer organization
5. **Client Compatible**: Works with any OAuth 2.1 capable MCP client
6. **Secure by Design**: Modern security practices, short-lived tokens, HTTPS enforcement

The result is **enterprise-grade authentication** for MCP servers with **minimal complexity** for server developers and **seamless experience** for end users.