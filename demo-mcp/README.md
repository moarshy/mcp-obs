# Demo MCP - TypeScript Implementation

This is a demonstration of Model Context Protocol (MCP) implementation in TypeScript, featuring both server and client components with support for stdio and HTTP/SSE transports.

## Features

- **MCP Server**: Implements an echo tool that responds with "hello from mcp-obs: {message}"
- **MCP Client**: Can connect via stdio or HTTP transport
- **Dual Transport Support**: Both stdio (process-based) and HTTP/SSE (network-based)
- **TypeScript**: Full type safety using the official `@modelcontextprotocol/sdk`

## Project Structure

```
demo-mcp/
├── server/
│   └── src/
│       ├── index.ts       # Stdio MCP server
│       └── http-server.ts # HTTP/SSE MCP server
├── client/
│   └── src/
│       ├── index.ts       # Stdio MCP client
│       └── http-client.ts # HTTP MCP client
└── package.json           # Dependencies and scripts
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

### SSE Transport Demo

**Terminal 1** - Start SSE server:
```bash
bun run dev:server:http
```

**Terminal 2** - Run SSE client:
```bash
bun run dev:client:http
```

### Individual Components

**Stdio Server (standalone)**:
```bash
bun run dev:server
```

**SSE Server**:
```bash
bun run dev:server:http
# SSE endpoint: http://localhost:3003/sse
# Messages endpoint: http://localhost:3003/messages
```

**Stdio Client**:
```bash
bun run dev:client
```

**SSE Client**:
```bash
bun run dev:client:http
```

## MCP Tool: Echo

The demo implements a single MCP tool called `echo`:

- **Name**: `echo`
- **Description**: Echo a message back with a greeting from mcp-obs
- **Parameters**:
  - `message` (optional): The message to echo back (defaults to "Hello World!")
- **Response**: Returns "hello from mcp-obs: {message}"

## Transport Types

### Stdio Transport
- **Use Case**: Local applications where client launches server as subprocess
- **Communication**: JSON-RPC over stdin/stdout
- **Benefits**: Simple, secure, no network exposure

### HTTP/SSE Transport
- **Use Case**: Remote servers, web applications, distributed systems
- **Communication**: HTTP with Server-Sent Events for real-time updates
- **Benefits**: Network accessible, standard web protocols

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
2. **Two servers available**:
   - `demo-mcp-obs-stdio`: Process-based (always available)
   - `demo-mcp-obs-sse`: HTTP-based (requires `bun run dev:server:http`)

**Usage in Cursor**:
- Restart Cursor and open this project
- Use `@demo-mcp-obs-stdio` for stdio transport
- Use `@demo-mcp-obs-sse` for SSE transport (start server first)
- Both provide the same `echo` tool with "hello from mcp-obs" responses

## Development

**Build for production**:
```bash
bun run build
```

**Run built version**:
```bash
bun run start:client  # stdio demo
bun run start:client:http  # SSE demo
```

**Test both transports**:
```bash
./test-both-transports.sh
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