# 🔐 OAuth Server Integration Fix: MCPlatform Alignment

## 🚨 Critical Issue Analysis

### Current Problem
```typescript
// BROKEN: Trying to access email on undefined authContext
console.log(`✅ New OAuth session created: ${newSessionId} for user: ${authContext.email}`);
//                                                                      ↑
//                                                              TypeError: Cannot read properties of undefined
```

### Root Cause
The Express OAuth middleware fails silently when:
1. No Bearer token is provided in Authorization header
2. Token validation fails against `/api/mcp-oauth/introspect`
3. `authContext` becomes undefined but code tries to access `.email`

**Expected Behavior**: Return proper 401 Unauthorized with WWW-Authenticate headers

## ✅ MCPlatform's Proven Error Handling Pattern

Based on `with-mcp-auth.ts` analysis, here's the correct pattern:

```typescript
// MCPlatform's Error Response Pattern
if (!session || !authContext) {
    const wwwAuthenticateValue = `Bearer resource_metadata=${host?.includes('localhost') ? 'http' : 'https'}://${host}/.well-known/oauth-authorization-server`

    return Response.json(
        {
            jsonrpc: '2.0',  // MCP protocol compliance
            error: {
                code: -32000,
                message: 'Unauthorized: Authentication required',
                'www-authenticate': wwwAuthenticateValue
            },
            id: null
        },
        {
            status: 401,
            headers: {
                'WWW-Authenticate': wwwAuthenticateValue
            }
        }
    )
}
```

### Key Characteristics
1. **JSON-RPC 2.0 Format**: Complies with MCP protocol
2. **Dual Error Location**: Error info in both JSON body AND HTTP headers
3. **WWW-Authenticate Header**: Points clients to OAuth discovery endpoint
4. **Dynamic Protocol**: `http` for localhost, `https` for production
5. **Graceful Failure**: Never accesses properties on null/undefined objects

## 🔧 Immediate Fixes Required

### 1. Fix Express Middleware Error Handling

**File**: `packages/server-sdk/src/transport-adapters.ts`

```typescript
// BEFORE (broken):
expressMiddleware() {
    return async (req: any, res: any, next: any) => {
        const authContext = await validator.validateToken(token);
        req.authContext = authContext; // ❌ Could be null
        next(); // ❌ Continues even with null context
    };
}

// AFTER (MCPlatform pattern):
expressMiddleware() {
    const self = this;
    return async (req: any, res: any, next: any) => {
        // Skip OAuth for health checks and public endpoints
        if (self.isPublicEndpoint(req.path)) {
            return next();
        }

        const token = self.extractTokenFromExpress(req);
        const host = req.headers.host || 'localhost:3000';

        if (!token) {
            return self.sendUnauthorizedResponse(res, host, 'Bearer token required');
        }

        try {
            const authContext = await self.validateToken(token);

            if (!authContext) {
                return self.sendUnauthorizedResponse(res, host, 'Invalid or expired token');
            }

            // Success - attach auth context and continue
            req.authContext = authContext;
            next();

        } catch (error) {
            console.error('[OAuth Express] Token validation error:', error);
            return self.sendUnauthorizedResponse(res, host, 'Token validation failed');
        }
    };
}

// Helper method for consistent error responses
private sendUnauthorizedResponse(res: any, host: string, message: string) {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const wwwAuthenticateValue = `Bearer resource_metadata=${protocol}://${host}/.well-known/oauth-authorization-server`;

    return res.status(401).json({
        jsonrpc: '2.0',
        error: {
            code: -32000,
            message: `Unauthorized: ${message}`,
            'www-authenticate': wwwAuthenticateValue
        },
        id: null
    }).set({
        'WWW-Authenticate': wwwAuthenticateValue
    });
}
```

### 2. Fix Demo Server Error Handling

**File**: `demo-mcp/server/src/streamable-http-server-oauth.ts`

```typescript
// BEFORE (broken):
const authContext = (req as any).authContext as AuthContext;
console.log(`✅ New OAuth session created: ${newSessionId} for user: ${authContext.email}`);
//                                                                  ↑ ❌ Crashes if null

// AFTER (defensive coding):
const authContext = (req as any).authContext as AuthContext;

if (!authContext) {
    // This should never happen due to middleware, but defensive coding
    console.error('❌ OAuth middleware failed - no auth context');
    const response = HTTPOAuthAdapter.createUnauthorizedResponse(
        'test',
        'Authentication required'
    );
    return res.status(response.status).set(response.headers).json(response.body);
}

console.log(`✅ New OAuth session created: ${newSessionId} for user: ${authContext.email}`);
```

### 3. Fix OAuth Configuration Endpoints

**Current Issue**: Using non-standard endpoint paths

```typescript
// BEFORE (non-standard):
introspectionEndpoint: `http://localhost:3000/api/mcp-oauth/introspect`  // ❌

// AFTER (OAuth standard + MCPlatform pattern):
introspectionEndpoint: `http://localhost:3000/oauth/userinfo`           // ✅
tokenEndpoint: `http://localhost:3000/oauth/token`                      // ✅
authorizationEndpoint: `http://localhost:3000/oauth/authorize`          // ✅
```

## 🌐 MCPlatform OAuth Endpoint Structure

### Standard OAuth Endpoints (Per Subdomain)
```
https://acme.mcp-obs.com/.well-known/oauth-authorization-server  # Discovery
https://acme.mcp-obs.com/oauth/authorize                        # Authorization
https://acme.mcp-obs.com/oauth/token                           # Token exchange
https://acme.mcp-obs.com/oauth/userinfo                        # User info (not introspect)
https://acme.mcp-obs.com/oauth/register                        # Client registration
https://acme.mcp-obs.com/oauth/revoke                          # Token revocation
```

### MCP Server Endpoints
```
https://acme.mcp-obs.com/api/mcpserver/mcp                     # MCP server (no tracking)
https://acme.mcp-obs.com/api/mcpserver/{trackingId}/mcp        # MCP server (with tracking)
```

### Development vs Production URLs
```typescript
function buildOAuthEndpoints(host: string, subdomain: string) {
    const isLocalhost = host.includes('localhost');
    const protocol = isLocalhost ? 'http' : 'https';
    const fullHost = isLocalhost ? host : `${subdomain}.mcp-obs.com`;

    return {
        discoveryEndpoint: `${protocol}://${fullHost}/.well-known/oauth-authorization-server`,
        authorizationEndpoint: `${protocol}://${fullHost}/oauth/authorize`,
        tokenEndpoint: `${protocol}://${fullHost}/oauth/token`,
        userinfoEndpoint: `${protocol}://${fullHost}/oauth/userinfo`,  // ← Not "introspect"
        revocationEndpoint: `${protocol}://${fullHost}/oauth/revoke`,
        registrationEndpoint: `${protocol}://${fullHost}/oauth/register`
    };
}

// Development
buildOAuthEndpoints('localhost:3000', 'test')
// → http://localhost:3000/oauth/userinfo

// Production
buildOAuthEndpoints('mcp-obs.com', 'test')
// → https://test.mcp-obs.com/oauth/userinfo
```

## 🔄 How MCP Clients Should Authenticate

### Expected Client Flow
```typescript
// 1. Discovery - Find OAuth endpoints
const discovery = await fetch('http://localhost:3000/.well-known/oauth-authorization-server');
const config = await discovery.json();

// 2. Client Registration (Optional - can be pre-registered)
const registration = await fetch(config.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        client_name: 'Cursor IDE',
        redirect_uris: ['vscode://callback'],
        grant_types: ['authorization_code'],
        response_types: ['code']
    })
});

// 3. Authorization Code Flow
const authUrl = `${config.authorization_endpoint}?` + new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: 'vscode://callback',
    scope: 'read write',
    state: randomState(),
    code_challenge: challenge,
    code_challenge_method: 'S256'
});

// User authorizes in browser, gets redirected with code

// 4. Token Exchange
const tokenResponse = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        client_id: clientId,
        redirect_uri: 'vscode://callback',
        code_verifier: verifier
    })
});

const { access_token } = await tokenResponse.json();

// 5. Use Bearer Token for MCP Requests
const mcpResponse = await fetch('http://localhost:3005/mcp', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`  // ← This is what we validate
    },
    body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'echo', arguments: { message: 'Hello' } },
        id: 1
    })
});
```

### Expected Authorization Header Format
```http
Authorization: Bearer mcp_at_abcdef123456789...
```

## 🎯 Implementation Checklist

### Immediate Fixes (Critical)
- [ ] Fix Express middleware to return proper 401 responses
- [ ] Add defensive null checks in demo server
- [ ] Update OAuth endpoint URLs to standard paths
- [ ] Test with no Authorization header (should return 401)
- [ ] Test with invalid Bearer token (should return 401)

### OAuth Endpoint Alignment
- [ ] Update introspection endpoint: `/api/mcp-oauth/introspect` → `/oauth/userinfo`
- [ ] Ensure all OAuth endpoints follow `/oauth/*` pattern
- [ ] Add proper discovery endpoint at `/.well-known/oauth-authorization-server`
- [ ] Test discovery endpoint returns correct metadata

### Error Response Format
- [ ] All auth errors use JSON-RPC 2.0 format
- [ ] WWW-Authenticate headers point to correct discovery endpoint
- [ ] Status codes: 401 for auth failures, 403 for insufficient scope
- [ ] Error messages are actionable for MCP client developers

### Testing & Validation
- [ ] Test with Cursor (should get proper 401 with WWW-Authenticate header)
- [ ] Test manual curl with/without Bearer tokens
- [ ] Verify error responses match MCPlatform format
- [ ] Test both localhost and production URL patterns

## 🔬 Testing Commands

### Test 1: No Authorization Header (Should Return 401)
```bash
curl -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
  -v
```

**Expected Response**:
```json
{
    "jsonrpc": "2.0",
    "error": {
        "code": -32000,
        "message": "Unauthorized: Bearer token required",
        "www-authenticate": "Bearer resource_metadata=http://localhost:3000/.well-known/oauth-authorization-server"
    },
    "id": null
}
```

**Expected Headers**:
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata=http://localhost:3000/.well-known/oauth-authorization-server
```

### Test 2: Invalid Bearer Token (Should Return 401)
```bash
curl -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token_12345" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
  -v
```

### Test 3: Discovery Endpoint (Should Return OAuth Config)
```bash
curl http://localhost:3000/.well-known/oauth-authorization-server -v
```

## 📋 Success Criteria

1. **No More Crashes**: Server never tries to access `.email` on undefined objects
2. **Proper 401 Responses**: All authentication failures return proper JSON-RPC errors with WWW-Authenticate headers
3. **Client Guidance**: Error responses tell clients exactly where to find OAuth configuration
4. **Standard Compliance**: OAuth endpoints follow RFC 6749 and RFC 8414 patterns
5. **MCPlatform Alignment**: Error format matches MCPlatform's proven patterns

## 🚀 Next Steps After Fix

1. **Test with Real OAuth Flow**: Set up complete OAuth authorization code flow
2. **Add Client Registration**: Implement dynamic client registration endpoint
3. **Enhance Token Validation**: Add scope checking and token introspection
4. **Add Rate Limiting**: Protect OAuth endpoints from abuse
5. **Add Monitoring**: Track authentication success/failure rates

---

The core issue is **defensive programming** - never assume auth context exists, always handle the null case gracefully with proper OAuth error responses that guide clients to the correct authentication flow.