# 🔧 OAuth Fix Implementation Guide

## Immediate Fix: Stop the Crashes

### 1. Fix Express Middleware (5 minutes)

**File**: `packages/server-sdk/src/transport-adapters.ts`

Replace the broken `expressMiddleware()` method:

```typescript
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
            if (self.config.debug) {
                console.error('[OAuth Express] No Bearer token found');
            }
            return self.sendUnauthorizedResponse(res, host, 'Bearer token required');
        }

        try {
            const { OAuthTokenValidator } = await import('./oauth-validator.js');
            const validator = new OAuthTokenValidator(self.config);
            const authContext = await validator.validateToken(token);

            if (!authContext) {
                if (self.config.debug) {
                    console.error('[OAuth Express] Token validation failed');
                }
                return self.sendUnauthorizedResponse(res, host, 'Invalid or expired token');
            }

            if (self.config.debug) {
                console.log(`[OAuth Express] Authenticated: ${authContext.email}`);
            }

            req.authContext = authContext;
            next();

        } catch (error) {
            if (self.config.debug) {
                console.error('[OAuth Express] Error:', error);
            }
            return self.sendUnauthorizedResponse(res, host, 'Token validation failed');
        }
    };
}

// Add this new method to StreamableHTTPOAuthAdapter class
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

### 2. Fix Demo Server (2 minutes)

**File**: `demo-mcp/server/src/streamable-http-server-oauth.ts`

Add null checks before accessing authContext:

```typescript
// Around line 238, replace:
console.log(`✅ New OAuth session created: ${newSessionId} for user: ${authContext.email}`);

// With defensive code:
if (authContext && authContext.email) {
    console.log(`✅ New OAuth session created: ${newSessionId} for user: ${authContext.email}`);
} else {
    console.error('❌ OAuth session created but no valid auth context');
}
```

And in the GET /mcp handler (around line 175):

```typescript
// Replace:
const authContext = (req as any).authContext as AuthContext;
if (!authContext) {
    res.status(401).json(createErrorResponse("Authentication required for SSE streaming."));
    return;
}

// With:
const authContext = (req as any).authContext as AuthContext;
if (!authContext) {
    const protocol = req.headers.host?.includes('localhost') ? 'http' : 'https';
    const host = req.headers.host || 'localhost:3000';
    const wwwAuth = `Bearer resource_metadata=${protocol}://${host}/.well-known/oauth-authorization-server`;

    return res.status(401)
        .set('WWW-Authenticate', wwwAuth)
        .json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Unauthorized: Authentication required for SSE streaming',
                'www-authenticate': wwwAuth
            },
            id: null
        });
}
```

## Test the Fix

### 1. Start the OAuth Server
```bash
cd demo-mcp && bun run demo:oauth
```

### 2. Test Without Token (Should Return 401)
```bash
curl -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
  -v
```

**Expected**: 401 with WWW-Authenticate header, no crashes

### 3. Test With Invalid Token (Should Return 401)
```bash
curl -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake_token_123" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
  -v
```

**Expected**: 401 with token validation error, no crashes

### 4. Test Health Endpoint (Should Work)
```bash
curl http://localhost:3005/health -v
```

**Expected**: 200 OK with server status

## Verify the Fix

✅ **Success Criteria**:
1. No more `Cannot read properties of undefined (reading 'email')` errors
2. Proper 401 JSON-RPC responses with WWW-Authenticate headers
3. Server logs show authentication attempts without crashing
4. Health endpoints still work (skip OAuth)

✅ **What You Should See**:
```bash
# Server logs:
[OAuth Express] No Bearer token found
[OAuth Express] Token validation failed
# Instead of crashes

# Client response:
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata=http://localhost:3000/.well-known/oauth-authorization-server
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Unauthorized: Bearer token required"
  }
}
```

## After the Fix

Once this stops crashing, you can work on:
1. Setting up proper OAuth token generation for testing
2. Aligning endpoint URLs with OAuth standards
3. Testing with real MCP clients like Cursor
4. Adding complete OAuth authorization code flow

The key insight from MCPlatform: **Never assume auth context exists - always return proper 401 responses that guide clients to OAuth endpoints.**