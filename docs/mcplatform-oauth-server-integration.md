# 🔐 MCPlatform OAuth Server Integration: True Implementation

## 🎯 Key Discovery: MCPlatform Doesn't Use HTTP Introspection

The critical insight: **MCPlatform MCP servers don't make HTTP calls to validate tokens**. They use direct database validation through shared libraries.

### ❌ Wrong Approach (What We Were Doing)
```typescript
// ❌ Making HTTP calls from MCP server to OAuth server
const response = await fetch('http://localhost:3000/api/mcp-oauth/introspect', {
    method: 'POST',
    body: new URLSearchParams({ token })
})
```

### ✅ MCPlatform Approach (Database-Direct Validation)
```typescript
// ✅ Direct database validation using shared utilities
import { validateAccessToken } from '@/lib/mcp-oauth/token-validation'

const validation = await validateAccessToken(serverId, accessToken)
```

## 🏗️ MCPlatform's Architecture Pattern

### 1. Shared Database Package
All authentication logic lives in the shared database package that both dashboard and MCP servers import:

```
packages/database/
├── src/
│   ├── mcp-auth-schema.ts     # OAuth tables schema
│   ├── token-validation.ts    # Shared validation logic
│   └── index.ts              # Export validation functions
```

### 2. OAuth Validation Flow
```typescript
// In MCP server (not HTTP call!)
import { validateAccessToken } from 'database'

export async function withOAuthValidation(serverId: string, request: MCPRequest) {
    const authHeader = extractAuthorizationHeader(request)
    const token = extractBearerToken(authHeader)

    if (!token) {
        return createOAuthChallenge(serverId)
    }

    const validation = await validateAccessToken(serverId, token)

    if (!validation.valid) {
        return createOAuthChallenge(serverId, validation.error)
    }

    return {
        user: validation.user,
        client: validation.client,
        scopes: validation.token?.scope?.split(' ') || []
    }
}
```

### 3. OAuth Challenge Response (MCPlatform Format)
```typescript
function createOAuthChallenge(serverId: string, error?: string) {
    const wwwAuth = generateWWWAuthenticateHeader(serverId, 'MCP Server', error)

    return {
        status: 401,
        headers: {
            'WWW-Authenticate': wwwAuth
        },
        body: {
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: `Unauthorized: ${error || 'Bearer token required'}`,
                'www-authenticate': wwwAuth
            },
            id: null
        }
    }
}
```

## 🔧 Implementation: True MCPlatform Pattern

### 1. Update Server SDK to Use Direct Database Validation

**File**: `packages/server-sdk/src/oauth-validator.ts`

Replace HTTP-based validation with database-direct validation:

```typescript
import { validateAccessToken, extractUserFromToken, generateWWWAuthenticateHeader } from 'database'

export interface OAuthConfig {
  serverSlug: string;
  serverId?: string; // Add server ID for direct database lookup
  debug?: boolean;
}

export interface AuthContext {
  userId: string;
  email: string;
  name?: string;
  image?: string;
  scopes: string[];
  clientId: string;
  expiresAt: number;
}

export class OAuthTokenValidator {
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  async validateToken(token: string): Promise<AuthContext | null> {
    try {
      if (!this.config.serverId) {
        console.error('[OAuth] Server ID required for database validation');
        return null;
      }

      // Use MCPlatform's direct database validation
      const validation = await validateAccessToken(this.config.serverId, token);

      if (!validation.valid || !validation.user) {
        if (this.config.debug) {
          console.error('[OAuth] Token validation failed:', validation.error);
        }
        return null;
      }

      return {
        userId: validation.user.id,
        email: validation.user.email,
        name: validation.user.name,
        image: validation.user.image,
        scopes: validation.token?.scope?.split(' ') || [],
        clientId: validation.token?.clientId || '',
        expiresAt: validation.token?.expiresAt.getTime() || 0
      };

    } catch (error) {
      console.error('OAuth token validation error:', error);
      return null;
    }
  }

  extractBearerToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }

  hasRequiredScopes(authContext: AuthContext, requiredScopes: string[]): boolean {
    return requiredScopes.every(scope => authContext.scopes.includes(scope));
  }
}
```

### 2. Update Transport Adapters to Use Database Validation

**File**: `packages/server-sdk/src/transport-adapters.ts`

Remove HTTP calls, use direct database validation:

```typescript
import { generateWWWAuthenticateHeader } from 'database'

export class StreamableHTTPOAuthAdapter {
  private config: TransportAdapterConfig & { serverId: string };

  constructor(config: TransportAdapterConfig & { serverId: string }) {
    this.config = config;
  }

  expressMiddleware() {
    const self = this;
    return async (req: any, res: any, next: any) => {
      // Skip OAuth for public endpoints
      if (self.isPublicEndpoint(req.path)) {
        return next();
      }

      const token = self.extractTokenFromExpress(req);

      if (!token) {
        if (self.config.debug) {
          console.error('[OAuth Express] No Bearer token found');
        }
        return self.sendOAuthChallenge(res, 'Bearer token required');
      }

      try {
        // Direct database validation (MCPlatform pattern)
        const validator = new OAuthTokenValidator(self.config);
        const authContext = await validator.validateToken(token);

        if (!authContext) {
          if (self.config.debug) {
            console.error('[OAuth Express] Token validation failed');
          }
          return self.sendOAuthChallenge(res, 'Invalid or expired token');
        }

        if (self.config.debug) {
          console.log(`[OAuth Express] Authenticated: ${authContext.email}`);
        }

        req.authContext = authContext;
        next();

      } catch (error) {
        console.error('[OAuth Express] Token validation error:', error);
        return self.sendOAuthChallenge(res, 'Token validation failed');
      }
    };
  }

  private async sendOAuthChallenge(res: any, errorDescription: string) {
    try {
      // Use MCPlatform's WWW-Authenticate header generator
      const wwwAuth = await generateWWWAuthenticateHeader(
        this.config.serverId,
        'MCP Server',
        'invalid_token',
        errorDescription
      );

      return res.status(401)
        .set('WWW-Authenticate', wwwAuth)
        .json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: `Unauthorized: ${errorDescription}`,
            'www-authenticate': wwwAuth
          },
          id: null
        });

    } catch (error) {
      console.error('Error generating OAuth challenge:', error);

      // Fallback to simple challenge
      const fallbackAuth = `Bearer realm="MCP Server", error="invalid_token", error_description="${errorDescription}"`;

      return res.status(401)
        .set('WWW-Authenticate', fallbackAuth)
        .json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: `Unauthorized: ${errorDescription}`
          },
          id: null
        });
    }
  }

  private extractTokenFromExpress(req: any): string | null {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }

  private isPublicEndpoint(path: string): boolean {
    const publicPaths = ['/health', '/status', '/.well-known/'];
    return publicPaths.some(publicPath => path.startsWith(publicPath));
  }
}
```

### 3. Update Demo Server Configuration

**File**: `demo-mcp/server/src/streamable-http-server-oauth.ts`

Add server ID resolution:

```typescript
import { McpObsSDK, type AuthContext } from "@mcp-obs/server-sdk";
import { getMcpServerBySlug } from 'database'; // Import server lookup

// Get server ID by slug for database validation
async function getServerIdBySlug(slug: string): Promise<string | null> {
  try {
    const server = await getMcpServerBySlug(slug);
    return server?.id || null;
  } catch (error) {
    console.error('Failed to resolve server ID:', error);
    return null;
  }
}

async function main() {
  // Resolve server ID for database validation
  const serverId = await getServerIdBySlug('test');

  if (!serverId) {
    console.error('❌ Failed to resolve server ID for slug "test"');
    process.exit(1);
  }

  // Initialize mcp-obs SDK with server ID
  const mcpObs = new McpObsSDK({
    serverName: "demo-mcp-streamable-oauth-server",
    version: "1.0.0",
    oauthConfig: {
      serverSlug: "test",
      serverId: serverId, // Required for database validation
      debug: true
    }
  });

  await mcpObs.initialize();

  // Initialize OAuth adapter with server ID
  oauthAdapter = await mcpObs.createOAuthMiddleware('streamable-http');

  // OAuth middleware for all MCP endpoints
  app.use('/mcp', oauthAdapter.expressMiddleware());

  app.listen(PORT, () => {
    console.log(`🌐 Demo MCP OAuth Streamable HTTP Server running on http://localhost:${PORT}`);
    console.log(`🔐 OAuth: Enabled for server slug "test" (serverId: ${serverId})`);
    console.log(`💾 Using direct database validation (MCPlatform pattern)`);
  });
}
```

## 🎯 Key Changes Required

### 1. Move Token Validation to Database Package

**File**: `packages/database/src/index.ts`

Export token validation functions:

```typescript
// Re-export OAuth validation utilities
export {
  validateAccessToken,
  introspectToken,
  checkTokenScope,
  extractUserFromToken,
  generateWWWAuthenticateHeader,
  type TokenValidationResult,
  type TokenIntrospectionResponse
} from './mcp-oauth/token-validation'
```

### 2. Update Server SDK Dependencies

**File**: `packages/server-sdk/package.json`

Ensure database dependency:

```json
{
  "dependencies": {
    "database": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.18.1"
  }
}
```

### 3. Remove HTTP Client Dependencies

No need for fetch calls, HTTP client libraries, or introspection endpoint URLs.

## 🔄 Complete Flow Example

### 1. MCP Client Sends Request
```http
POST http://localhost:3005/mcp
Authorization: Bearer mcp_at_abc123xyz...
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {"name": "echo", "arguments": {"message": "Hello"}},
  "id": 1
}
```

### 2. Express Middleware Validates Token
```typescript
// Direct database query (no HTTP call)
const validation = await validateAccessToken(serverId, 'mcp_at_abc123xyz...')

if (validation.valid) {
  req.authContext = {
    userId: validation.user.id,
    email: validation.user.email,
    scopes: validation.token.scope.split(' ')
  }
  next() // Continue to MCP handler
} else {
  // Return 401 with WWW-Authenticate header
}
```

### 3. MCP Handler Uses Auth Context
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const authContext = (request as any).authContext;

  return {
    content: [{
      type: "text",
      text: `Hello ${authContext.email}! (scopes: ${authContext.scopes.join(', ')})`
    }]
  };
});
```

## ✅ Benefits of MCPlatform Pattern

1. **No Network Latency**: Direct database queries vs HTTP calls
2. **Better Error Handling**: Database transactions vs HTTP timeouts
3. **Shared Schema**: Same validation logic in dashboard and MCP servers
4. **Type Safety**: Shared TypeScript types across packages
5. **Performance**: No serialization/deserialization overhead
6. **Consistency**: Same OAuth logic everywhere

## 🚀 Implementation Steps

1. **Update Server SDK** to use database-direct validation
2. **Add server ID resolution** for database queries
3. **Remove HTTP introspection** endpoints from SDK
4. **Test with database tokens** from the dashboard
5. **Verify WWW-Authenticate** headers are MCPlatform-compliant

The key insight: MCPlatform uses shared libraries and direct database access, not HTTP APIs, for OAuth token validation within the platform infrastructure.