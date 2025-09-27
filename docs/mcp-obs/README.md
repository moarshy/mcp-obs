# MCP-OBS Documentation

This directory contains documentation specific to **MCP-OBS** - the observability and authentication platform for Model Context Protocol (MCP) servers. These guides focus on the mcp-obs platform itself, client integrations, and the Server SDK implementation.

## Overview

**MCP-OBS** is the "Auth0 + OpenTelemetry for MCP servers" - providing enterprise-grade authentication proxy and observability infrastructure. This documentation covers how to integrate with the mcp-obs platform, implement the Server SDK, and manage OAuth flows for MCP clients.

## Documentation Contents

### 🏗️ [SDK Design & Architecture](./sdk-design-architecture.md)
**Focus**: MCP-OBS Server SDK design philosophy and implementation
- SDK-first architecture approach
- Transport-agnostic design (stdio, HTTP, streamable-HTTP)
- Minimal server complexity principle
- Integration patterns and examples

### 🔄 [Complete OAuth Flow](./oauth-flow-complete.md)
**Focus**: End-to-end OAuth 2.1 implementation for MCP servers
- System architecture overview
- Complete OAuth flow from discovery to tool execution
- Real-world integration examples
- PKCE and RFC 6749 compliance

### 🔐 [Authentication Architecture](./auth-architecture-guide.md)
**Focus**: MCP-OBS authentication system design
- Server/client boundary management
- Session management patterns
- Organization-scoped security
- Clean auth import structures

### 🎫 [OAuth Client Integration](./mcp-oauth-client-integration.md)
**Focus**: How MCP clients integrate with OAuth authentication
- Dynamic client registration (RFC 7591)
- Authorization code flow with PKCE
- Token management and refresh
- Real HTTP examples and responses

### 🔗 [MCP Client-Server Interactions](./mcp-client-server-interaction.md)
**Focus**: How MCP protocol works with mcp-obs SDK integration
- MCP protocol fundamentals
- JSON-RPC 2.0 communication patterns
- Transport layer integration
- Tool execution with authentication context

### 📊 [User Capture System](./mcp-user-capture-system.md)
**Focus**: Analytics and user tracking for business intelligence
- User deduplication across organizations
- Analytics data collection
- Business metrics and reporting
- Privacy and compliance considerations

### 🛠️ [MCP OAuth Implementation](./mcp-oauth-implementation-guide.md)
**Focus**: Technical implementation details for OAuth in MCP context
- OAuth server configuration
- Token validation patterns
- Error handling strategies
- Production deployment considerations

## Architecture Overview

```
MCP-OBS Platform Architecture:
┌─────────────────────────────────────────────────────────────────┐
│ MCP Client (Cursor, Claude Desktop, etc.)                      │
├─────────────────────────────────────────────────────────────────┤
│ OAuth 2.1 + PKCE Flow                                          │
├─────────────────────────────────────────────────────────────────┤
│ MCP Server + mcp-obs Server SDK                                │
│ ├── Transport Adapters (stdio, HTTP, streaming)               │
│ ├── OAuth Middleware & Token Validation                       │
│ └── Observability & Analytics Collection                      │
├─────────────────────────────────────────────────────────────────┤
│ MCP-OBS Platform                                               │
│ ├── OAuth Authorization Server                                │
│ ├── User Management & Organization Scoping                    │
│ ├── Analytics & Business Intelligence                         │
│ └── Dashboard & Admin Interface                               │
└─────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. **SDK-First Integration**
- Existing MCP servers require minimal changes (2-3 lines of code)
- All OAuth complexity handled in the SDK
- Distributable via npm: `@mcp-obs/server-sdk`

### 2. **OAuth 2.1 Compliance**
- Full RFC 6749 and RFC 7636 (PKCE) compliance
- Dynamic client registration support (RFC 7591)
- Standard OAuth discovery endpoints

### 3. **Multi-Transport Support**
- **stdio**: Traditional stdin/stdout communication
- **HTTP**: RESTful HTTP transport
- **streamable-HTTP**: Modern streaming HTTP (primary focus)

### 4. **User Capture & Analytics**
- Organization-scoped user deduplication
- Tool usage analytics and billing metrics
- Privacy-compliant data collection
- Business intelligence reporting

### 5. **Enterprise-Grade Security**
- Organization-level data isolation
- Token-based authentication with proper validation
- Session management and security tracking
- Production-ready error handling

## Integration Workflow

### For MCP Server Developers

1. **Install SDK**: `npm install @mcp-obs/server-sdk`
2. **Initialize SDK**: Add 2-3 lines to existing MCP server
3. **Configure OAuth**: Set server slug and authentication options
4. **Deploy**: Server automatically supports OAuth authentication

### For MCP Client Developers

1. **Discover OAuth Endpoints**: Use `/.well-known/oauth-authorization-server`
2. **Dynamic Client Registration**: Register client with OAuth server
3. **Authorization Flow**: Implement PKCE OAuth flow
4. **Token Management**: Handle access tokens and refresh logic

### For Platform Administrators

1. **Organization Setup**: Configure organizations and users
2. **Server Registration**: Register and configure MCP servers
3. **Analytics Dashboard**: Monitor usage and performance
4. **User Management**: Handle permissions and access control

## Related Documentation

- **MCPlatform Guides**: `/docs/mcplatform-guide/` - Implementation patterns and architecture guides
- **Project Guide**: `/CLAUDE.md` - Overall project structure and setup
- **Database Schema**: `/packages/database/src/` - Schema implementations and migrations
- **SDK Implementation**: `/packages/server-sdk/src/` - Server SDK source code
- **Demo Examples**: `/demo-mcp/` - Working integration examples

## Development Resources

### Server SDK Installation
```bash
npm install @mcp-obs/server-sdk
```

### Basic Integration Example
```typescript
import { McpObsSDK } from '@mcp-obs/server-sdk'

const mcpObs = new McpObsSDK({
  serverName: "my-mcp-server",
  version: "1.0.0",
  oauthConfig: {
    serverSlug: "my-server",
    debug: true
  }
})

await mcpObs.initialize()
```

### OAuth Discovery Endpoint
```
https://your-server.mcp-obs.com/.well-known/oauth-authorization-server
```

## Support and Contributing

- **Issues**: Report bugs and request features via GitHub issues
- **Documentation**: Contribute improvements to these guides
- **SDK Development**: Contribute to the Server SDK implementation
- **Examples**: Share integration examples and best practices

## Important Notes

- **Security**: Always use HTTPS in production
- **Token Storage**: Never store tokens in client-side code
- **Rate Limiting**: Implement appropriate rate limiting for production
- **Analytics**: Ensure compliance with privacy regulations
- **Error Handling**: Implement robust error handling for all OAuth flows

This documentation provides the foundation for building secure, observable MCP servers with enterprise-grade authentication using the mcp-obs platform.