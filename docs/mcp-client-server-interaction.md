# MCP Client-Server Interactions & SDK Integration

## Overview

This document explains how the Model Context Protocol (MCP) client-server interactions work, and how the mcp-obs SDK integrates seamlessly into this flow to provide OAuth authentication, session management, and observability.

## MCP Protocol Fundamentals

### What is MCP?

The **Model Context Protocol (MCP)** is a standardized protocol that enables AI applications (like Claude, Cursor, etc.) to securely connect with external data sources and tools. It defines how clients and servers communicate using JSON-RPC 2.0 over various transports.

### Core Concepts

1. **JSON-RPC 2.0**: All MCP communication uses JSON-RPC format
2. **Transports**: Multiple ways to communicate (stdio, HTTP, WebSocket)
3. **Capabilities**: Servers declare what they can do (tools, resources, prompts)
4. **Sessions**: Persistent connections with state management
5. **Tools**: Functions that clients can call on servers

### MCP Message Flow

```
Client                    Server
  |                         |
  |------- initialize ------|
  |                         |
  |<----- capabilities -----|
  |                         |
  |-- notifications/init ---|
  |                         |
  |------- list_tools ------|
  |                         |
  |<-------- tools ---------|
  |                         |
  |------- call_tool -------|
  |                         |
  |<------- result ---------|
```

## Transport Types & SDK Integration

### 1. **Stdio Transport** (Standard Input/Output)

**Traditional MCP:**
```typescript
// Client connects via process spawn
const client = new Client({
  name: "example-client",
  version: "1.0.0",
});

const transport = new StdioClientTransport({
  command: "node",
  args: ["server.js"],
});

await client.connect(transport);
```

**With mcp-obs SDK:**
```typescript
// Server with OAuth via environment variables
const mcpObs = new McpObsSDK({
  serverName: "my-api-server",
  version: "1.0.0",
  oauthConfig: {
    serverSlug: "mycompany",
    platformUrl: process.env.MCP_OBS_PLATFORM_URL
  }
});

// SDK handles OAuth via stdio messaging
const oauthAdapter = await mcpObs.createOAuthMiddleware('stdio');
// OAuth flows happen through JSON-RPC messages
```

### 2. **HTTP Transport** (Request/Response)

**Traditional MCP:**
```typescript
// Client makes HTTP requests
const transport = new HTTPClientTransport(
  new URL("http://localhost:3000/mcp")
);

// Each tool call is a separate HTTP request
const result = await client.request({
  method: "tools/call",
  params: { name: "search", arguments: { query: "hello" } }
}, CallToolRequestSchema);
```

**With mcp-obs SDK:**
```typescript
// Server with OAuth middleware
app.use('/mcp', oauthAdapter.expressMiddleware());
oauthAdapter.createOAuthProxyEndpoints(app);

app.post('/mcp', async (req, res) => {
  const authContext = (req as any).authContext; // Set by SDK

  // Handle MCP requests with authentication context
  await transport.handleRequest(req, res, req.body);
});
```

### 3. **Streamable HTTP Transport** (Modern, Efficient)

**Key Advantages:**
- **Session Management**: Persistent connections with session IDs
- **Server-Sent Events (SSE)**: Real-time notifications from server to client
- **Connection Pooling**: Efficient resource utilization
- **Error Recovery**: Robust connection handling

**Traditional MCP Flow:**
```typescript
// 1. Client sends initialize request (no session)
POST /mcp
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "id": 1,
  "params": { "protocolVersion": "2025-03-26", ... }
}

// 2. Server responds with session ID in headers
HTTP 200 OK
mcp-session-id: abc123
{
  "jsonrpc": "2.0",
  "result": { "capabilities": {...}, ... }
}

// 3. Client includes session ID in subsequent requests
POST /mcp
mcp-session-id: abc123
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 2
}

// 4. Client opens SSE stream for notifications
GET /mcp
mcp-session-id: abc123
Accept: text/event-stream
```

## mcp-obs SDK StreamableHTTP Integration

### Complete OAuth Flow Integration

The mcp-obs SDK seamlessly integrates with the StreamableHTTP transport to add OAuth authentication while preserving all MCP protocol features.

### 1. **OAuth-Enhanced Initialize Flow**

```typescript
// Client Request (with OAuth)
POST /mcp
Authorization: Bearer mcp_at_xxxx...
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "id": 1,
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {...}
  }
}
```

**Server Processing with mcp-obs SDK:**
```typescript
app.post('/mcp', async (req, res) => {
  // 1. OAuth middleware runs first
  const authContext = (req as any).authContext; // Validated by SDK
  const sessionId = req.headers['mcp-session-id'];

  if (!sessionId && isInitializeRequest(req.body)) {
    // 2. Create StreamableHTTPTransport with OAuth context
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId: string) => {
        // 3. Store OAuth context with session
        transports[sessionId] = transport;
        sessionAuthContexts[sessionId] = authContext;
        console.log(`Session ${sessionId} initialized for ${authContext.user.email}`);
      }
    });

    // 4. Create MCP server with OAuth-aware tools
    const server = createMCPServer(authContext);
    await server.connect(transport);

    // 5. Handle body buffering (SDK requirement)
    const bufferedBody = (req as any)._mcpOAuthBufferedBody;
    const streamableReq = recreateStreamFromBuffer(req, bufferedBody);

    // 6. Process MCP request normally
    await transport.handleRequest(streamableReq, res, req.body);
  }
});
```

### 2. **Session-Aware Tool Execution**

```typescript
function createMCPServer(authContext: AuthContext): Server {
  const server = new Server({
    name: "oauth-protected-server",
    version: "1.0.0"
  });

  // OAuth-aware tool handlers
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Each tool has access to authenticated user context
    switch (name) {
      case "search":
        return searchWithUserContext(args, authContext);

      case "upload":
        return uploadWithUserPermissions(args, authContext);

      case "delete":
        // Check if user has delete permissions
        if (!authContext.scopes.includes('delete')) {
          throw new Error('Insufficient permissions');
        }
        return deleteWithAuditLog(args, authContext);
    }
  });

  return server;
}
```

### 3. **SSE Stream with Authentication**

```typescript
app.get('/mcp', async (req, res) => {
  // OAuth validation for SSE streams
  const authContext = (req as any).authContext;
  const sessionId = req.headers['mcp-session-id'];

  if (!sessionId || !transports[sessionId]) {
    return res.status(400).json({
      error: "Invalid session ID or authentication required"
    });
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);

  // Stream authenticated notifications
  await streamMessagesWithAuth(transport, authContext);
});
```

## OAuth Discovery & Client Compatibility

### Automatic OAuth Endpoint Creation

The mcp-obs SDK automatically creates OAuth discovery endpoints that MCP clients can use:

```typescript
// SDK automatically creates these endpoints:
oauthAdapter.createOAuthProxyEndpoints(app);

// Results in:
GET /.well-known/oauth-authorization-server
{
  "issuer": "http://myserver.com",
  "authorization_endpoint": "http://myserver.com/authorize",
  "token_endpoint": "http://myserver.com/token",
  "registration_endpoint": "http://myserver.com/register"
}

// OAuth endpoints proxy to mcp-obs platform:
POST /register → https://mycompany.mcp-obs.com/api/oauth/register
GET /authorize → https://mycompany.mcp-obs.com/api/oauth/authorize
POST /token → https://mycompany.mcp-obs.com/api/oauth/token
```

### Client Discovery Flow

```typescript
// 1. MCP Client discovers server
const mcpServerUrl = "http://localhost:3005/mcp";

// 2. Client checks for OAuth support
const oauthConfig = await fetch(`${serverUrl}/.well-known/oauth-authorization-server`);

// 3. Client registers with OAuth server
const registration = await fetch(`${serverUrl}/register`, {
  method: 'POST',
  body: JSON.stringify({
    client_name: "Cursor",
    redirect_uris: ["cursor://oauth/callback"],
    grant_types: ["authorization_code", "refresh_token"]
  })
});

// 4. Client performs OAuth flow
const authUrl = `${serverUrl}/authorize?client_id=${clientId}&response_type=code&...`;
// User authenticates via browser
// Client exchanges code for tokens

// 5. Client makes authenticated MCP requests
const mcpResponse = await fetch(`${mcpServerUrl}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "initialize",
    id: 1,
    params: {...}
  })
});
```

## Error Handling & Edge Cases

### 1. **OAuth Token Expiry During Session**

```typescript
// SDK handles token expiry gracefully
app.use('/mcp', async (req, res, next) => {
  try {
    await oauthAdapter.expressMiddleware()(req, res, next);
  } catch (error) {
    if (error.code === 'TOKEN_EXPIRED') {
      // Return OAuth error for client to refresh
      return res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Token expired",
          data: {
            oauth_error: "invalid_token",
            oauth_error_description: "The access token expired"
          }
        },
        id: req.body?.id || null
      });
    }
    throw error;
  }
});
```

### 2. **Session Cleanup**

```typescript
// Automatic cleanup of expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, authContext] of Object.entries(sessionAuthContexts)) {
    if (authContext.expiresAt < now) {
      cleanupSession(sessionId);
    }
  }
}, 300000); // Check every 5 minutes

function cleanupSession(sessionId: string) {
  if (servers[sessionId]) {
    servers[sessionId].close();
    delete servers[sessionId];
  }
  if (transports[sessionId]) {
    delete transports[sessionId];
  }
  delete sessionAuthContexts[sessionId];
  console.log(`🧹 Cleaned up expired session ${sessionId}`);
}
```

### 3. **Network Failure Handling**

```typescript
// SDK includes retry logic for platform communication
export class OAuthTokenValidator {
  async validateToken(token: string): Promise<AuthContext | null> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try to validate with platform
        const response = await fetch(`${this.config.platformUrl}/api/oauth/introspect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // Log error but don't crash server
    console.error(`OAuth validation failed after ${maxRetries} attempts:`, lastError);
    return null; // Let server decide how to handle unauthenticated requests
  }
}
```

## Performance Considerations

### 1. **Token Caching Strategy**

```typescript
// Intelligent caching respects token expiry
class TokenCache {
  private cache = new Map<string, CachedToken>();

  set(token: string, authContext: AuthContext): void {
    const ttl = Math.max(0, authContext.expiresAt - Date.now() - 30000); // 30s buffer
    this.cache.set(token, {
      authContext,
      expiresAt: Date.now() + ttl
    });

    // Set cleanup timer
    setTimeout(() => this.cache.delete(token), ttl);
  }

  get(token: string): AuthContext | null {
    const cached = this.cache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.authContext;
    }
    this.cache.delete(token);
    return null;
  }
}
```

### 2. **Body Buffering Optimization**

```typescript
// Efficient body buffering for MCP compatibility
async function bufferRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalLength = 0;

  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      totalLength += chunk.length;

      // Prevent memory exhaustion
      if (totalLength > MAX_BODY_SIZE) {
        reject(new Error('Request body too large'));
      }
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks, totalLength));
    });

    req.on('error', reject);
  });
}
```

## Summary

The mcp-obs SDK provides **seamless OAuth integration** for MCP servers by:

1. **Preserving MCP Protocol**: All standard MCP flows work exactly as expected
2. **Adding Authentication**: OAuth validation happens transparently
3. **Session Management**: Proper session/authentication context mapping
4. **Client Compatibility**: Standard OAuth discovery and flows
5. **Performance**: Intelligent caching and efficient stream handling
6. **Error Handling**: Graceful degradation and proper error responses

The result is **authenticated MCP servers** that work with existing MCP clients while providing enterprise-grade security and user management through the mcp-obs platform.