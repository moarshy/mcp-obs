# mcp-obs Python Demo Servers

This directory contains demonstration implementations showing how to integrate OAuth authentication into MCP servers using the **mcp-obs Python SDK**.

## Demo Servers Overview

### 🚀 `server_fastmcp.py` (Recommended)
**Official MCP SDK Integration with FastMCP**

Uses the official MCP SDK patterns with FastMCP and proper OAuth integration:
- ✅ **Official MCP Patterns**: FastMCP with `streamable-http` transport
- ✅ **3-Line Integration**: Minimal code using `create_fastmcp_with_oauth()`
- ✅ **RFC 7662 Compliance**: Token introspection via mcp-obs platform
- ✅ **Real MCP Client Support**: Works with Cursor and other MCP clients

### 🔧 `server_minimal.py` (Reference)
**Manual SDK Integration Example**

Shows how to manually integrate the SDK with FastAPI:
- ✅ **Educational Purpose**: Demonstrates SDK internals
- ✅ **FastAPI Integration**: Manual OAuth middleware setup
- ✅ **SDK Architecture**: Shows how `McpObsSDK` class works
- ⚠️ **Not Typical MCP Usage**: Uses uvicorn instead of MCP transports

## Quick Start

### Prerequisites

```bash
# Install dependencies
uv sync

# Ensure mcp-obs platform is running on localhost:3000
# (or update platform_url in the demo servers)
```

### Running the FastMCP Demo (Recommended)

```bash
# Run the FastMCP server with OAuth
python server_fastmcp.py

# Output:
# 🚀 Starting FastMCP Server with Official MCP SDK OAuth
# 📡 Server: FastMCP Demo Server with OAuth
# 🔐 OAuth: Enabled via official MCP SDK patterns
# 🌐 Server: http://localhost:3006
# ✨ Using: TokenVerifier + AuthSettings + RFC 7662 introspection
# 🔧 Transport: streamable-http (for OAuth compatibility)
```

### Testing OAuth Flow

1. **OAuth Discovery**:
```bash
curl http://localhost:3006/.well-known/oauth-protected-resource
# Should return OAuth discovery metadata
```

2. **Dynamic Client Registration**:
```bash
curl -X POST http://localhost:3006/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Test MCP Client",
    "redirect_uris": ["http://localhost:8000/callback"],
    "grant_types": ["authorization_code"]
  }'
# Should return registered client credentials
```

3. **Test MCP Request** (without token):
```bash
curl -X POST http://localhost:3006/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
# Should return 401 with OAuth challenge
```

## Integration Patterns Demonstrated

### 1. FastMCP Pattern (server_fastmcp.py)

```python
from mcp_obs_server.fastmcp_integration import create_fastmcp_with_oauth

# 3-line OAuth integration!
app = create_fastmcp_with_oauth(
    name="FastMCP Demo Server with OAuth",
    server_slug="test",
    platform_url="http://localhost:3000",
    port=3006,
    required_scopes=["read", "write"],
    debug=True
)

@app.tool()
def echo_with_oauth(message: str = "Hello from FastMCP OAuth!") -> str:
    """This tool requires OAuth authentication"""
    return f"🔐 OAuth Echo via FastMCP: {message}"

# Critical: Use streamable-http for OAuth compatibility
app.run('streamable-http')
```

**Key Points**:
- Uses official MCP SDK `TokenVerifier` and `AuthSettings`
- Automatic OAuth proxy endpoint creation
- RFC 7662 token introspection
- Proper MCP transport selection

### 2. Manual SDK Pattern (server_minimal.py)

```python
from mcp_obs_server import McpObsSDK

# Initialize SDK
mcp_obs = McpObsSDK({
    "serverName": "Demo MCP Python Server with OAuth",
    "version": "1.0.0",
    "oauthConfig": {
        "serverSlug": "test",
        "platformUrl": "http://localhost:3000",
        "debug": True
    }
})

@app.on_event("startup")
async def startup():
    await mcp_obs.initialize()

    # SDK creates OAuth middleware and proxy endpoints
    oauth_adapter = await mcp_obs.create_oauth_middleware('http')
    oauth_adapter.create_oauth_proxy_endpoints(app)
```

**Key Points**:
- Shows SDK internal architecture
- Demonstrates manual middleware setup
- Educational for understanding OAuth flow
- FastAPI integration example

## OAuth Flow Architecture

```
MCP Client (Cursor) OAuth Flow:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │    │   MCP Server    │    │  mcp-obs        │
│   (Cursor)      │    │   (FastMCP)     │    │  Platform       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. Connect to MCP     │                       │
         │─────────────────────▶│                       │
         │                       │                       │
         │ 2. OAuth Discovery    │                       │
         │─────────────────────▶│                       │
         │ ◀─────────────────────│                       │
         │   (.well-known/...)   │                       │
         │                       │                       │
         │ 3. DCR Request        │ 4. Proxy DCR          │
         │─────────────────────▶│─────────────────────▶│
         │                       │                       │
         │ 5. Client Credentials │ ◀─────────────────────│
         │ ◀─────────────────────│                       │
         │                       │                       │
         │ 6. Authorization      │ 7. Proxy Auth         │
         │─────────────────────▶│─────────────────────▶│
         │                       │                       │
         │ 8. User Authenticates │                       │
         │ ◀─────────────────────│ ◀─────────────────────│
         │                       │                       │
         │ 9. Token Exchange     │ 10. Proxy Token       │
         │─────────────────────▶│─────────────────────▶│
         │                       │                       │
         │ 11. Access Token      │ ◀─────────────────────│
         │ ◀─────────────────────│                       │
         │                       │                       │
         │ 12. MCP Requests      │ 13. Token Validation  │
         │    (with Bearer)      │    (RFC 7662)         │
         │─────────────────────▶│─────────────────────▶│
         │                       │                       │
         │ 13. Authenticated     │ ◀─────────────────────│
         │     Response          │                       │
         │ ◀─────────────────────│                       │
```

## Key OAuth Endpoints Created by SDK

The SDK automatically creates these endpoints:

### OAuth Discovery
- **`GET /.well-known/oauth-protected-resource`**
  - Resource server metadata for MCP clients
  - Advertises authorization servers and supported scopes

### OAuth Proxy Endpoints
- **`POST /register`** - Dynamic Client Registration proxy
- **`GET /authorize`** - OAuth authorization redirect proxy
- **`POST /token`** - OAuth token exchange proxy

### MCP Endpoints
- **`POST /mcp`** - Main MCP endpoint with OAuth protection
- **`GET /health`** - Public health check (no OAuth required)

## Configuration Options

### Development Configuration

```python
app = create_fastmcp_with_oauth(
    name="My Dev Server",
    server_slug="dev",                        # Creates dev.localhost:3000
    platform_url="http://localhost:3000",    # Local mcp-obs platform
    port=3006,                               # Local server port
    required_scopes=["read", "write"],       # OAuth scopes
    debug=True                               # Enable debug logging
)
```

### Production Configuration

```python
app = create_fastmcp_with_oauth(
    name="My Production Server",
    server_slug="mycompany",                 # Creates mycompany.mcp-obs.com
    platform_url="https://mcp-obs.com",     # Production platform
    port=443,                                # HTTPS port
    required_scopes=["read", "write"],       # OAuth scopes
    debug=False                              # Disable debug in prod
)
```

## Debug Output Examples

When `debug=True`, you'll see comprehensive OAuth logging:

### Successful OAuth Flow
```
🔐 [mcp-obs] Created FastMCP server with OAuth:
   Server: FastMCP Demo Server with OAuth
   Server URL: http://localhost:3006
   Platform: http://test.localhost:3000
   Required scopes: ['read', 'write']

INFO:     127.0.0.1:56417 - "GET /.well-known/oauth-protected-resource HTTP/1.1" 200 OK

🔄 [OAuth Proxy] Proxying DCR request to http://test.localhost:3000
✅ [OAuth Proxy] DCR successful: mcp_test_1759031946406_9gb28wszcbp

🔍 [mcp-obs] Verifying token via http://test.localhost:3000/api/mcp-oauth/introspect
✅ [mcp-obs] Token verified for user: user@example.com
🔍 [mcp-obs] Raw scope string: 'read,write'
🔍 [mcp-obs] Parsed scopes: ['read', 'write']
```

### Error Cases
```
# No authorization header
❌ [OAuth] Authorization header required

# Invalid token
🔍 [mcp-obs] Verifying token via http://test.localhost:3000/api/mcp-oauth/introspect
❌ [mcp-obs] Token is not active

# Insufficient scopes
❌ [OAuth] Insufficient scope: Required ['read', 'write'], Got ['read']
```

## Common Issues & Solutions

### 1. Server Won't Start
```bash
ERROR: [Errno 48] error while attempting to bind on address
```
**Solution**: Change the port number in the server configuration.

### 2. MCP Client Can't Connect
- ✅ Ensure using `app.run('streamable-http')` not `app.run()`
- ✅ Check OAuth discovery endpoint is working
- ✅ Verify mcp-obs platform is accessible

### 3. 403 Insufficient Scope Error
- ✅ Check token scopes vs required scopes in logs
- ✅ Verify scope parsing (comma vs space separated)
- ✅ Ensure platform is issuing correct scopes

### 4. 401 Unauthorized
- ✅ Check token introspection endpoint connectivity
- ✅ Verify platform_url and server_slug configuration
- ✅ Check debug logs for detailed error info

## Connecting with MCP Clients

### Cursor IDE Integration

1. Add to your `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "mcp-obs-demo": {
      "command": "python",
      "args": ["server_fastmcp.py"],
      "cwd": "/path/to/demo-mcp/python",
      "transport": {
        "type": "streamableHttp",
        "url": "http://localhost:3006"
      }
    }
  }
}
```

2. Cursor will automatically:
   - Discover OAuth endpoints
   - Register as OAuth client
   - Redirect user for authorization
   - Handle token management

### Other MCP Clients

Any MCP client supporting OAuth 2.0 with PKCE can connect:
1. Client discovers OAuth via `.well-known/oauth-protected-resource`
2. Client registers via Dynamic Client Registration
3. User completes OAuth authorization flow
4. Client uses Bearer tokens for MCP requests

## Architecture Benefits

### For Developers
- **3-Line Integration**: Minimal code required
- **Standards Compliant**: RFC 7662 token introspection
- **Debug Friendly**: Comprehensive logging
- **Framework Agnostic**: Works with FastMCP, FastAPI, Flask

### For Users
- **Seamless Experience**: OAuth handled transparently
- **Enterprise Security**: Token-based authentication
- **Multi-Tenant**: Isolated per organization/server
- **MCP Native**: Works with any MCP client

### For Operations
- **Observable**: Full OAuth flow visibility
- **Scalable**: Platform handles auth complexity
- **Secure**: No secrets in server code
- **Compliant**: Standards-based OAuth flows

## Next Steps

1. **Try the Demo**: Run `python server_fastmcp.py`
2. **Connect with Cursor**: Add to `.cursor/mcp.json`
3. **Customize**: Modify tools and scopes for your use case
4. **Deploy**: Use production configuration for live deployment

## Learn More

- **SDK Documentation**: `/packages/sdk/python/mcp-server/README.md`
- **mcp-obs Platform**: Main OAuth server and user management
- **Official MCP SDK**: https://github.com/modelcontextprotocol/python-sdk

---

**Need Help?** Check the comprehensive troubleshooting section in the SDK README or enable `debug=True` for detailed OAuth flow visibility.