# Demo MCP - TypeScript Implementation

This is a comprehensive demonstration of Model Context Protocol (MCP) implementation in TypeScript, featuring both server and client components with support for three different transport types.

## Features

- **MCP Server**: Implements an echo tool that responds with "hello from mcp-obs: {message}"
- **MCP Client**: Can connect via multiple transports
- **Triple Transport Support**: stdio, SSE (deprecated), and Streamable HTTP (current standard)
- **TypeScript**: Full type safety using the official `@modelcontextprotocol/sdk`
- **Transport Identification**: Each transport clearly identifies itself in responses

## Project Structure

```
demo-mcp/
├── server/
│   └── src/
│       ├── index.ts                     # Stdio MCP server
│       ├── http-server.ts               # SSE MCP server (deprecated)
│       └── streamable-http-server.ts    # Streamable HTTP MCP server (current standard)
├── client/
│   └── src/
│       ├── index.ts                     # Stdio MCP client
│       ├── http-client.ts               # SSE MCP client
│       └── streamable-http-client.ts    # Streamable HTTP MCP client
└── package.json                         # Dependencies and scripts
```

## Installation

```bash
cd demo-mcp
bun install
```

## Usage

### Quick Demo (stdio transport)

Run the complete demo with stdio transport:

```bash
bun run demo
```

This will:
1. Start the MCP server as a subprocess
2. Connect the client via stdio
3. List available tools
4. Call the echo tool with different messages
5. Clean up and disconnect

### SSE Transport Demo (Deprecated)

**Terminal 1** - Start SSE server:
```bash
bun run dev:server:http
```

**Terminal 2** - Run SSE client:
```bash
bun run dev:client:http
```

### Streamable HTTP Transport Demo (Current Standard)

**Terminal 1** - Start Streamable HTTP server:
```bash
bun run dev:server:streamable
```

**Terminal 2** - Run Streamable HTTP client:
```bash
bun run dev:client:streamable
```

### Individual Components

**Stdio Server (standalone)**:
```bash
bun run dev:server
```

**SSE Server (deprecated)**:
```bash
bun run dev:server:http
# SSE endpoint: http://localhost:3003/sse
# Messages endpoint: http://localhost:3003/messages
```

**Streamable HTTP Server (current standard)**:
```bash
bun run dev:server:streamable
# Endpoint: http://localhost:3004/mcp
# Health check: http://localhost:3004/health
# Status: http://localhost:3004/status
```

**Stdio Client**:
```bash
bun run dev:client
```

**SSE Client**:
```bash
bun run dev:client:http
```

**Streamable HTTP Client**:
```bash
bun run dev:client:streamable
```

## MCP Tool: Echo

The demo implements a single MCP tool called `echo`:

- **Name**: `echo`
- **Description**: Echo a message back with a greeting from mcp-obs
- **Parameters**:
  - `message` (optional): The message to echo back (defaults to "Hello World!")
- **Response Format by Transport**:
  - Stdio: `hello from mcp-obs (stdio): {message}`
  - SSE: `hello from mcp-obs (SSE): {message}`
  - Streamable HTTP: `hello from mcp-obs (Streamable HTTP): {message}`

## Transport Types

### 1. Stdio Transport
- **Use Case**: Local applications where client launches server as subprocess
- **Communication**: JSON-RPC over stdin/stdout
- **Benefits**: Simple, secure, no network exposure
- **Status**: ✅ Current and recommended for local use

### 2. SSE Transport (Deprecated)
- **Use Case**: Remote servers, web applications, distributed systems
- **Communication**: HTTP with Server-Sent Events for real-time updates
- **Benefits**: Network accessible, standard web protocols
- **Status**: ⚠️ Deprecated as of MCP v2025-03-26, use Streamable HTTP instead

### 3. Streamable HTTP Transport (Current Standard)
- **Use Case**: Remote servers, web applications, modern distributed systems
- **Communication**: Single HTTP endpoint with bidirectional communication
- **Benefits**: Resumable connections, better error handling, single endpoint architecture
- **Status**: ✅ Current standard as of MCP v2025-03-26

## Example Output

```
🚀 Demo MCP Client Starting...

=== Running MCP Client with stdio transport ===
✅ Connected to MCP server via stdio
📋 Available tools: [ 'echo' ]
🔧 Calling echo tool with default message...
📤 Result: { type: 'text', text: 'hello from mcp-obs: Hello World!' }
🔧 Calling echo tool with custom message...
📤 Result: { type: 'text', text: 'hello from mcp-obs: TypeScript MCP Demo is working!' }
🔌 Disconnected from MCP server

✨ Demo completed!
```

## Cursor Integration

The demo MCP servers can be used with Cursor IDE:

1. **Configuration**: Located at `/Users/arshath/play/naptha/mcp-obs/.cursor/mcp.json`
2. **Available servers**:
   - `demo-mcp-obs-stdio`: Process-based (always available)
   - `demo-mcp-obs-streamable`: HTTP-based (requires `bun run dev:server:streamable`)

**Usage in Cursor**:
- Restart Cursor and open this project
- Use `@demo-mcp-obs-stdio` for stdio transport
  - Response: `hello from mcp-obs (stdio): {your message}`
- Use `@demo-mcp-obs-streamable` for Streamable HTTP transport (start server first)
  - Response: `hello from mcp-obs (Streamable HTTP): {your message}`
- Both provide the same `echo` tool interface

## Development

**Build for production**:
```bash
bun run build
```

**Run built version**:
```bash
bun run start:client           # stdio demo
bun run start:client:http      # SSE demo
bun run start:client:streamable # Streamable HTTP demo (requires server running)
```

**Test all transports**:
```bash
bun run demo                   # stdio transport
bun run demo:http             # SSE transport (requires server running)
bun run demo:streamable       # Streamable HTTP transport (requires server running)
./test-both-transports.sh     # Test script for multiple transports
```

## Dependencies

- `@modelcontextprotocol/sdk`: Official MCP TypeScript SDK
- `express`: HTTP server framework (for HTTP transport)
- `cors`: Cross-origin resource sharing (for HTTP transport)
- `tsx`: TypeScript execution for development
- `typescript`: TypeScript compiler

## Notes

This demo showcases the basic concepts of MCP implementation and can be extended with:
- Additional tools (file operations, API calls, etc.)
- Authentication and authorization
- Logging and monitoring
- Error handling and retry logic
- Custom transport implementations