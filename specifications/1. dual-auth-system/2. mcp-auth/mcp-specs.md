# MCP Server OAuth Specifications

## Overview

This document outlines the official OAuth specifications for MCP (Model Context Protocol) servers, based on comprehensive research of the official MCP authorization specification and related standards. This information will guide the implementation of our Better Auth-based OAuth server for MCP servers.

## Official MCP Authorization Specification

**Source**: [Model Context Protocol Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)

### Key Principles
- MCP authorization is based on **OAuth 2.1** draft specifications with additional security requirements
- Authorization is **optional** for MCP implementations but follows strict standards when implemented
- MCP servers act as **OAuth 2.1 resource servers**, not authorization servers
- Supports both confidential and public clients with appropriate security measures

## Discovery Endpoints

### Resource Metadata Discovery
MCP servers MUST implement OAuth 2.0 Protected Resource Metadata (RFC 9728) using two mechanisms:

#### 1. WWW-Authenticate Header Discovery (Primary)
```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://resource.example.com/.well-known/oauth-protected-resource"
```

#### 2. Well-Known URI Discovery (Fallback)
```
GET /.well-known/oauth-protected-resource
```

**Response Format**:
```json
{
  "authorization_servers": ["https://auth.example.com"],
  "resource": "https://mcp-server.example.com",
  "scopes_supported": ["mcp:read", "mcp:write"],
  "bearer_methods_supported": ["header", "body", "query"]
}
```

### Discovery Priority
- MCP clients MUST support both discovery mechanisms
- Header-based discovery takes priority over well-known URI
- Clients should attempt well-known URI if header discovery fails

## Authentication Detection Mechanisms

### How MCP Clients Detect Auth Requirements

1. **Initial Request**: MCP client makes request to protected resource
2. **401 Response**: Server returns `HTTP 401 Unauthorized` for protected resources
3. **Header Parsing**: Client parses `WWW-Authenticate` header for resource metadata URL
4. **Metadata Retrieval**: Client fetches OAuth resource metadata
5. **Authorization Server Discovery**: Client identifies authorization server from metadata
6. **OAuth Flow Initiation**: Client begins OAuth authorization code flow

### Example Flow
```http
# Step 1: Client requests protected MCP resource
GET /mcp/tools HTTP/1.1
Host: api.example.com

# Step 2: Server responds with 401 and discovery info
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://api.example.com/.well-known/oauth-protected-resource"

# Step 3: Client fetches resource metadata
GET /.well-known/oauth-protected-resource HTTP/1.1
Host: api.example.com

# Step 4: Server returns authorization server info
{
  "authorization_servers": ["https://auth.example.com"],
  "resource": "https://api.example.com"
}
```

## Dynamic Client Registration

### RFC 7591 Implementation
MCP clients and servers **SHOULD** support OAuth 2.0 Dynamic Client Registration Protocol (RFC 7591):

#### Benefits
- Enables fully self-serve, zero-touch client registration for AI agents
- Allows MCP clients to obtain OAuth client IDs without user interaction
- Critical for many-to-many AI agent ecosystems where clients discover servers at runtime
- Eliminates manual client configuration overhead

#### Registration Endpoint Discovery
```json
{
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "registration_endpoint": "https://auth.example.com/register",
  "code_challenge_methods_supported": ["S256"]
}
```

#### Registration Request
```http
POST /register HTTP/1.1
Host: auth.example.com
Content-Type: application/json

{
  "client_name": "MCP Client Example",
  "client_uri": "https://client.example.com",
  "redirect_uris": ["https://client.example.com/oauth/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

#### Registration Response
```json
{
  "client_id": "s6BhdRkqt3",
  "client_id_issued_at": 1577836800,
  "registration_access_token": "this.is.an.access.token.value.ffx83",
  "registration_client_uri": "https://auth.example.com/register/s6BhdRkqt3"
}
```

## PKCE Requirements

### Mandatory PKCE Implementation
- **PKCE is mandatory** for all MCP clients, using **S256** code challenge method
- OAuth 2.1 compliance requires PKCE even for trusted clients
- MCP clients MUST verify `code_challenge_methods_supported` includes "S256" in provider metadata
- Built-in security baseline through mandatory PKCE protects against authorization code interception attacks

### PKCE Flow Implementation
```javascript
// 1. Generate code verifier and challenge
const codeVerifier = generateRandomString(128);
const codeChallenge = base64URLEncode(sha256(codeVerifier));

// 2. Authorization request with PKCE
const authUrl = `https://auth.example.com/authorize?` +
  `client_id=${clientId}&` +
  `response_type=code&` +
  `redirect_uri=${redirectUri}&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256&` +
  `resource=${mcpServerUrl}&` +
  `state=${state}`;

// 3. Token exchange with code verifier
const tokenResponse = await fetch('https://auth.example.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
    resource: mcpServerUrl
  })
});
```

## Complete OAuth Flow Implementation

### Authorization Code Flow Process

1. **Protected Resource Request**
   ```http
   GET /mcp/tools HTTP/1.1
   Host: api.example.com
   ```

2. **401 Unauthorized Response**
   ```http
   HTTP/1.1 401 Unauthorized
   WWW-Authenticate: Bearer resource_metadata="https://api.example.com/.well-known/oauth-protected-resource"
   ```

3. **Resource Metadata Discovery**
   ```http
   GET /.well-known/oauth-protected-resource HTTP/1.1
   Host: api.example.com
   ```

4. **Authorization Server Metadata**
   ```http
   GET /.well-known/oauth-authorization-server HTTP/1.1
   Host: auth.example.com
   ```

5. **User Authorization** (with PKCE and Resource Indicators)
   ```
   https://auth.example.com/authorize?
     client_id=client123&
     response_type=code&
     redirect_uri=https://client.example.com/callback&
     code_challenge=CHALLENGE&
     code_challenge_method=S256&
     resource=https://api.example.com&
     state=STATE&
     scope=mcp:read+mcp:write
   ```

6. **Token Exchange**
   ```http
   POST /token HTTP/1.1
   Host: auth.example.com
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code&
   code=AUTH_CODE&
   redirect_uri=https://client.example.com/callback&
   client_id=client123&
   code_verifier=VERIFIER&
   resource=https://api.example.com
   ```

7. **Authenticated MCP Request**
   ```http
   GET /mcp/tools HTTP/1.1
   Host: api.example.com
   Authorization: Bearer ACCESS_TOKEN
   ```

### Resource Indicators (RFC 8707)
- MCP clients **MUST** use RFC 8707 resource indicators to specify target MCP server
- Include `resource` parameter in both authorization and token requests
- Prevents cross-service token reuse through audience validation

### State Parameters
- MCP clients **SHOULD** use and verify state parameters for CSRF protection
- Generate cryptographically secure random state value
- Verify state parameter matches in callback

## Implementation Requirements

### For MCP Servers (Resource Servers)
**MUST Requirements:**
- ✅ Implement OAuth 2.0 Protected Resource Metadata (RFC 9728)
- ✅ Validate access tokens including audience claims
- ✅ Return 401 with WWW-Authenticate headers for unauthenticated requests
- ✅ Use HTTPS for all authorization endpoints
- ✅ Validate token signatures and expiration

**SHOULD Requirements:**
- ✅ Support Dynamic Client Registration (RFC 7591)
- ✅ Implement proper CORS headers for cross-origin requests
- ✅ Support token introspection for validation

### For MCP Clients
**MUST Requirements:**
- ✅ Implement PKCE with S256 code challenge method
- ✅ Support both WWW-Authenticate and well-known URI discovery
- ✅ Use Resource Indicators (RFC 8707) in authorization and token requests
- ✅ Validate redirect URIs and state parameters
- ✅ Handle token refresh and expiration

**SHOULD Requirements:**
- ✅ Implement Dynamic Client Registration for automated onboarding
- ✅ Cache authorization server metadata appropriately
- ✅ Support multiple concurrent MCP server connections

### For Authorization Servers (Our Implementation)
**MUST Requirements:**
- ✅ Support OAuth 2.1 authorization code flow with PKCE
- ✅ Implement authorization server metadata endpoint (RFC 8414)
- ✅ Validate resource indicators and issue audience-specific tokens
- ✅ Support S256 code challenge method
- ✅ Use HTTPS for all endpoints

**SHOULD Requirements:**
- ✅ Support Dynamic Client Registration (RFC 7591)
- ✅ Implement refresh token rotation
- ✅ Provide token introspection endpoint
- ✅ Support multiple grant types as needed

## Security Considerations

### Token Security
- Access tokens should be short-lived (15-60 minutes recommended)
- Implement refresh token rotation for long-lived sessions
- Proper audience validation prevents cross-service token reuse
- Use cryptographically secure random values for all tokens

### Transport Security
- All authorization endpoints MUST use HTTPS
- Validate TLS certificates and use certificate pinning where appropriate
- Implement proper CORS policies for browser-based clients

### Attack Prevention
- PKCE protects against authorization code interception attacks
- State parameters prevent CSRF attacks
- Proper redirect URI validation prevents authorization code injection
- Rate limiting on authorization endpoints prevents brute force attacks

### Multi-Tenant Considerations
- Organization-scoped authorization servers (subdomain-based)
- Separate client registration per organization
- Audience claims must include organization context
- Token validation must enforce organization boundaries

## Better Auth Implementation Strategy

### Configuration Structure
```typescript
// Platform Auth (Dashboard users)
export const platformAuth = betterAuth({
  database: platformAuthAdapter,
  baseURL: "https://dashboard.mcp-obs.com",
  // Platform-specific providers and settings
});

// MCP Server Auth (Per-organization OAuth servers)
export const createMCPAuth = (organization: Organization) => betterAuth({
  database: mcpAuthAdapter,
  baseURL: `https://${organization.subdomain}.mcp-obs.com`,
  // MCP OAuth 2.1 compliant configuration
});
```

### Key Implementation Areas
1. **Authorization Server Metadata Endpoint**: Implement RFC 8414 compliant metadata
2. **Resource Metadata Endpoint**: Support RFC 9728 for MCP server discovery
3. **Dynamic Client Registration**: Implement RFC 7591 for automatic client onboarding
4. **PKCE Support**: Mandatory S256 code challenge method
5. **Resource Indicators**: RFC 8707 support for audience-specific tokens
6. **Multi-Tenant Isolation**: Organization-scoped OAuth servers

## Standards References

- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10) - Base OAuth specification
- [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414) - OAuth 2.0 Authorization Server Metadata
- [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728) - OAuth 2.0 Protected Resource Metadata
- [RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591) - OAuth 2.0 Dynamic Client Registration Protocol
- [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) - Resource Indicators for OAuth 2.0
- [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) - Proof Key for Code Exchange (PKCE)

## Next Steps

1. **Better Auth Configuration**: Configure OAuth 2.1 compliant authorization server
2. **Metadata Endpoints**: Implement authorization server and resource metadata endpoints
3. **Client Registration**: Build dynamic client registration system
4. **Token Validation**: Implement proper JWT validation with audience checking
5. **Multi-Tenant Support**: Organization-scoped OAuth servers with subdomain routing
6. **SDK Integration**: Update server and client SDKs with OAuth flow support