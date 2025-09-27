# mcp-obs Server SDK: Design & Architecture

## Overview

The **mcp-obs Server SDK** is a distributable npm package that enables MCP (Model Context Protocol) server developers to easily add OAuth authentication, observability, and analytics to their existing servers. The SDK follows the principle of **minimal server complexity** - all OAuth and authentication logic is handled by the SDK, keeping the server code clean and simple.

## Design Philosophy

### 1. **SDK-First Architecture**
- **Server Simplicity**: Existing MCP servers require minimal changes (2-3 lines of code)
- **SDK Handles Complexity**: All OAuth flows, token validation, session management handled in SDK
- **Distributable**: Customers install via `npm install @mcp-obs/server-sdk`
- **Standalone**: SDK works independently without requiring mcp-obs platform to be running locally

### 2. **Transport Agnostic**
The SDK supports all MCP transport types:
- **stdio**: Standard input/output transport
- **http**: Traditional HTTP transport
- **streamable-http**: Modern streaming HTTP transport (primary focus)

### 3. **Platform Integration**
- **HTTP-Based**: Uses HTTP requests to validate tokens against mcp-obs platform
- **OAuth 2.1 Compliant**: Implements RFC 7662 Token Introspection standard
- **Multi-Tenant**: Each customer gets isolated OAuth configuration per server slug

## SDK Architecture

### Core Components

```typescript
// Main SDK Entry Point
export class McpObsSDK {
  constructor(config: MCPServerConfig)
  async initialize(): Promise<void>
  async createOAuthMiddleware(transportType): Promise<OAuthAdapter>
  async validateToken(token: string): Promise<AuthContext | null>
  async trackToolUsage(toolName: string, metadata?): Promise<void>
}
```

### 1. **OAuth Token Validator** (`oauth-validator.ts`)

```typescript
export class OAuthTokenValidator {
  async validateToken(token: string): Promise<AuthContext | null>
  getCacheStats(): { size: number; maxSize: number }
}

export interface AuthContext {
  user: {
    id: string
    email: string
    name?: string
  }
  scopes: string[]
  expiresAt: number
  serverSlug: string
}
```

**Key Features:**
- **HTTP Token Introspection**: Makes POST requests to `{platformUrl}/api/oauth/introspect`
- **Intelligent Caching**: LRU cache with TTL for performance (respects token expiry)
- **Error Handling**: Graceful degradation on network failures
- **Debug Logging**: Optional verbose logging for troubleshooting

**Token Validation Flow:**
1. Extract Bearer token from Authorization header
2. Check local cache for valid token
3. If cache miss, make HTTP request to mcp-obs platform
4. Cache successful response with TTL based on token expiry
5. Return structured AuthContext or null

### 2. **Transport Adapters** (`transport-adapters.ts`)

```typescript
export function createOAuthAdapter(
  transportType: 'stdio' | 'http' | 'streamable-http',
  config: OAuthConfig
): OAuthAdapter

export class StreamableHTTPOAuthAdapter {
  expressMiddleware(): (req, res, next) => Promise<void>
  createOAuthProxyEndpoints(app: express.Application): void
}
```

**StreamableHTTP Adapter Features:**
- **Express Middleware**: Seamlessly integrates with Express.js servers
- **Request Body Buffering**: Handles stream consumption for MCP protocol compatibility
- **Stream Reconstruction**: Recreates readable streams for MCP transport consumption
- **OAuth Proxy Endpoints**: Creates `/register`, `/token`, `/authorize` endpoints
- **Session Management**: Proper session ID communication with StreamableHTTPTransport

**Body Buffering Pattern:**
```typescript
// Problem: Express middleware consumes request stream
// Solution: Buffer body and recreate stream for MCP transport

async function expressMiddleware(req, res, next) {
  if (req.method === 'POST') {
    // Buffer the body for OAuth validation
    const bodyBuffer = await getBodyBuffer(req);

    // Store for later stream recreation
    (req as any)._mcpOAuthBufferedBody = bodyBuffer;

    // Validate OAuth token
    const authContext = await validator.validateToken(token);
    req.authContext = authContext;
  }
  next();
}

// Later in MCP server:
// Recreate stream from buffered body
const bodyStream = new BufferedRequestStream(bufferedBody);
await transport.handleRequest(recreatedRequest, res, originalBody);
```

### 3. **OAuth Proxy Endpoints**

The SDK automatically creates OAuth endpoints that proxy to the mcp-obs platform:

```typescript
// Auto-generated endpoints:
POST /register   → {platformUrl}/api/oauth/{serverSlug}/register
POST /token      → {platformUrl}/api/oauth/{serverSlug}/token
GET  /authorize  → {platformUrl}/api/oauth/{serverSlug}/authorize
```

**Purpose:**
- **Client Compatibility**: MCP clients can discover OAuth endpoints on the server
- **Seamless Integration**: No client-side configuration changes needed
- **Domain Alignment**: OAuth endpoints served from same domain as MCP server

## Integration Patterns

### Minimal Integration Example

```typescript
// Existing MCP Server (2 lines added)
import { McpObsSDK } from '@mcp-obs/server-sdk';

const mcpObs = new McpObsSDK({
  serverName: "my-api-server",
  version: "1.0.0",
  oauthConfig: {
    serverSlug: "my-api",
    platformUrl: "https://app.mcp-obs.com"
  }
});

await mcpObs.initialize();
const oauthAdapter = await mcpObs.createOAuthMiddleware('streamable-http');

// Apply OAuth middleware to Express app
app.use('/mcp', oauthAdapter.expressMiddleware());
oauthAdapter.createOAuthProxyEndpoints(app);

// Rest of existing MCP server code remains unchanged
```

### Full StreamableHTTP Integration

```typescript
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// Initialize SDK
const mcpObs = new McpObsSDK({ /* config */ });
const oauthAdapter = await mcpObs.createOAuthMiddleware('streamable-http');

// Apply OAuth middleware
app.use(cors());
app.use('/mcp', oauthAdapter.expressMiddleware());
oauthAdapter.createOAuthProxyEndpoints(app);

// MCP endpoint with OAuth protection
app.post('/mcp', async (req, res) => {
  const authContext = (req as any).authContext; // Set by OAuth middleware

  if (!sessionId && isInitializeRequest(req.body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId: string) => {
        // Session management with OAuth context
        transports[sessionId] = transport;
        sessionAuthContexts[sessionId] = authContext;
      }
    });

    // Handle stream recreation from buffered body
    const bufferedBody = (req as any)._mcpOAuthBufferedBody;
    const streamableReq = recreateStreamFromBuffer(req, bufferedBody);

    await transport.handleRequest(streamableReq, res, req.body);
  }
});
```

## Session Management

### StreamableHTTP Session Flow

1. **Initialize Request**: Client sends `initialize` request with Bearer token
2. **OAuth Validation**: SDK validates token, sets `req.authContext`
3. **Transport Creation**: Server creates StreamableHTTPServerTransport with `onsessioninitialized` callback
4. **Session Registration**: Callback stores transport and auth context with session ID
5. **Subsequent Requests**: Client includes session ID, server retrieves auth context
6. **Tool Execution**: MCP tools have access to authenticated user context

```typescript
// Tool handler with OAuth context
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const authContext = sessionAuthContexts[sessionId];

  // Tool implementation with user context
  return {
    content: [{
      type: "text",
      text: `Hello ${authContext.user.email}, tool result here...`
    }]
  };
});
```

## Configuration & Deployment

### SDK Configuration

```typescript
interface MCPServerConfig {
  serverName: string          // Identifier for the MCP server
  version: string            // Server version
  oauthConfig?: {
    serverSlug: string       // Maps to subdomain: {slug}.mcp-obs.com
    platformUrl?: string     // Override default platform URL
    requiredScopes?: string[] // OAuth scopes validation
    skipValidationFor?: string[] // Skip OAuth for specific endpoints
    debug?: boolean         // Enable verbose logging
  }
}
```

### Environment-Based Configuration

```typescript
// Development
const mcpObs = new McpObsSDK({
  serverName: "my-dev-server",
  version: "1.0.0",
  oauthConfig: {
    serverSlug: "mycompany-dev",
    platformUrl: "http://localhost:3000", // Local mcp-obs platform
    debug: true
  }
});

// Production
const mcpObs = new McpObsSDK({
  serverName: "my-prod-server",
  version: "1.0.0",
  oauthConfig: {
    serverSlug: "mycompany",
    platformUrl: "https://app.mcp-obs.com", // Hosted platform
    debug: false
  }
});
```

## Key Benefits

### For MCP Server Developers
1. **Minimal Integration**: 2-3 lines of code to add OAuth
2. **No Auth Complexity**: SDK handles all OAuth flows
3. **Transport Agnostic**: Works with any MCP transport
4. **Production Ready**: Built-in caching, error handling, logging

### for End Users
1. **Seamless Experience**: Standard OAuth 2.1 flows
2. **MCP Client Compatible**: Works with Cursor, Claude Desktop, etc.
3. **Secure**: Industry-standard token-based authentication
4. **Fast**: Intelligent caching minimizes validation overhead

### For Platform Operators
1. **Centralized Management**: All OAuth configuration in mcp-obs platform
2. **Multi-Tenant**: Isolated configuration per customer/server
3. **Analytics**: Built-in usage tracking and observability
4. **Scalable**: HTTP-based validation scales horizontally

## Next Steps

The current implementation demonstrates:
- ✅ Complete StreamableHTTP OAuth integration
- ✅ Token validation with caching
- ✅ Express middleware pattern
- ✅ Session management with StreamableHTTPTransport
- ✅ OAuth proxy endpoints for client compatibility

Future enhancements:
- 📋 stdio and http transport adapters
- 📋 Advanced analytics and telemetry collection
- 📋 WebSocket transport support
- 📋 Client-side SDK for MCP clients