# mcp-obs Python Server SDK

The **mcp-obs Python Server SDK** provides seamless OAuth authentication for MCP (Model Context Protocol) servers, enabling integration with the mcp-obs platform for user authentication and session management.

## Design Philosophy

**"SDK Does All the Heavy Lifting"** - The entire OAuth flow complexity is abstracted away in the SDK, allowing developers to add enterprise-grade authentication to their MCP servers in just 3 lines of code.

## Key Features

- 🔐 **RFC 7662 Token Introspection** - Standards-compliant OAuth token validation
- 🚀 **Official MCP SDK Integration** - Works with FastMCP and official MCP patterns
- 🎯 **3-Line Integration** - Minimal code required for full OAuth functionality
- 🔄 **Dynamic Client Registration** - Automatic OAuth client setup with PKCE
- 🌐 **Transport Support** - stdio, HTTP, and streamable-HTTP transports
- 🔍 **Debug Logging** - Comprehensive OAuth flow visibility
- ⚡ **FastAPI/Flask Ready** - Built-in middleware for popular frameworks

## Architecture Overview

### Core Components

```
mcp-obs Python SDK Architecture:

┌─────────────────────────────────────────────────────────┐
│                    MCP Server                           │
│  ┌─────────────────────────────────────────────────────┐│
│  │            Your MCP Tools & Logic                   ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │           mcp-obs Python SDK                        ││
│  │  • OAuth Proxy Endpoints (/register, /authorize)   ││
│  │  • Token Introspection (RFC 7662)                  ││
│  │  • Middleware (FastAPI, Flask, FastMCP)            ││
│  │  • Transport Adapters (stdio, HTTP, streamable)    ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                mcp-obs Platform                         │
│        (OAuth Server + User Management)                │
└─────────────────────────────────────────────────────────┘
```

### OAuth Flow

1. **Discovery**: MCP clients discover OAuth endpoints via `.well-known/oauth-protected-resource`
2. **Dynamic Client Registration**: SDK proxies DCR requests to mcp-obs platform
3. **Authorization**: PKCE-based OAuth 2.0 flow with subdomain isolation
4. **Token Introspection**: RFC 7662 validation for every protected request
5. **Scope Validation**: Configurable scope requirements with automatic parsing

## Installation

```bash
# Using UV (recommended)
uv add mcp-obs-server

# Using pip
pip install mcp-obs-server
```

## Quick Start

### FastMCP Integration (Recommended)

```python
from mcp_obs_server.fastmcp_integration import create_fastmcp_with_oauth

# 3-line OAuth integration!
app = create_fastmcp_with_oauth(
    name="My MCP Server",
    server_slug="mycompany",  # Maps to mycompany.mcp-obs.com
    platform_url="https://mcp-obs.com",  # or http://localhost:3000 for dev
    required_scopes=["read", "write"],
    debug=True
)

@app.tool()
def my_protected_tool(message: str) -> str:
    """This tool requires OAuth authentication"""
    return f"Authenticated response: {message}"

# Use proper MCP transport for OAuth
app.run('streamable-http')
```

### Manual SDK Integration

```python
from mcp_obs_server import McpObsSDK
from fastapi import FastAPI, Request

# Initialize SDK
mcp_obs = McpObsSDK({
    "serverName": "My MCP Server",
    "version": "1.0.0",
    "oauthConfig": {
        "serverSlug": "mycompany",
        "platformUrl": "https://mcp-obs.com",
        "requiredScopes": ["read", "write"],
        "debug": True
    }
})

app = FastAPI()

@app.on_event("startup")
async def startup():
    await mcp_obs.initialize()

    # Create OAuth middleware
    oauth_adapter = await mcp_obs.create_oauth_middleware('http')

    # Add OAuth proxy endpoints
    oauth_adapter.create_oauth_proxy_endpoints(app)

@app.post("/mcp")
async def mcp_endpoint(request: Request):
    # OAuth validation handled by SDK
    if oauth_adapter:
        middleware = oauth_adapter.express_middleware()
        auth_context = await middleware(request)
        # auth_context contains user info, scopes, etc.

    # Your MCP logic here...
```

### Legacy Middleware Pattern

```python
from mcp_obs_server import with_oauth, OAuthConfig, AuthContext

# Configure OAuth
config = OAuthConfig(
    server_slug="your-server-slug",
    platform_url="http://localhost:3000",  # or your mcp-obs platform URL
    debug=True
)

# Apply OAuth to your MCP request handlers
@with_oauth
async def handle_list_tools(request, auth_context: AuthContext):
    """Handle list_tools request with OAuth authentication"""
    print(f"Authenticated user: {auth_context.email}")
    return {
        "tools": [
            {"name": "example_tool", "description": "An example tool"}
        ]
    }
```

### Transport-Specific Adapters

#### Stdio Transport

```python
from mcp_obs_server import StdioOAuthAdapter, create_oauth_config

config = create_oauth_config(
    server_slug="your-server-slug",
    platform_url="http://localhost:3000",
    debug=True
)

adapter = StdioOAuthAdapter(config)

@adapter.with_oauth
async def handle_request(request, auth_context: AuthContext):
    return {"result": f"Hello {auth_context.email}"}
```

#### HTTP Transport

```python
from mcp_obs_server import HTTPOAuthAdapter, create_oauth_config

config = create_oauth_config(
    server_slug="your-server-slug",
    required_scopes=["read", "write"]
)

adapter = HTTPOAuthAdapter(config)

@adapter.with_oauth
async def handle_request(request, auth_context: AuthContext):
    return {"result": "Authenticated HTTP request"}
```

#### Streamable HTTP with FastAPI

```python
from fastapi import FastAPI, Request
from mcp_obs_server import StreamableHTTPOAuthAdapter, create_oauth_config

app = FastAPI()

config = create_oauth_config(
    server_slug="your-server-slug",
    platform_url="http://localhost:3000"
)

adapter = StreamableHTTPOAuthAdapter(config)

# Add OAuth middleware to FastAPI
@app.middleware("http")
async def oauth_middleware(request: Request, call_next):
    middleware = FastAPIMiddleware(config)
    return await middleware(request, call_next)

@app.post("/mcp")
async def mcp_endpoint(request: Request):
    # Access authenticated user context
    auth_context = request.state.auth_context
    return {"user": auth_context.email}
```

#### Flask Integration

```python
from flask import Flask, g
from mcp_obs_server import FlaskMiddleware, create_oauth_config

app = Flask(__name__)

config = create_oauth_config(
    server_slug="your-server-slug",
    platform_url="http://localhost:3000"
)

# Apply OAuth middleware to Flask
middleware = FlaskMiddleware(config)
middleware.create_middleware(app)

@app.route("/mcp", methods=["POST"])
def mcp_endpoint():
    # Access authenticated user via Flask's g object
    auth_context = g.auth_context
    return {"user": auth_context.email}
```

## Configuration

### OAuthConfig

```python
from mcp_obs_server import OAuthConfig

config = OAuthConfig(
    server_slug="your-server-slug",           # Required: Your server slug
    platform_url="http://localhost:3000",    # Optional: Platform URL
    debug=True                                # Optional: Enable debug logging
)
```

### Transport Adapter Config

```python
from mcp_obs_server import create_oauth_config

config = create_oauth_config(
    server_slug="your-server-slug",
    required_scopes=["read", "write"],        # Required OAuth scopes
    skip_validation_for=["health", "status"], # Skip OAuth for these tools
    debug=True,
    platform_url="http://localhost:3000"
)
```

## Advanced Usage

### Custom Token Validation

```python
from mcp_obs_server import OAuthTokenValidator, OAuthConfig

config = OAuthConfig(server_slug="your-server")
validator = OAuthTokenValidator(config)

async def custom_validation():
    token = "your-bearer-token"
    auth_context = await validator.validate_token(token)

    if auth_context:
        print(f"Valid user: {auth_context.email}")
        print(f"Scopes: {auth_context.scopes}")
    else:
        print("Invalid token")
```

### Manual Middleware Configuration

```python
from mcp_obs_server import configure_oauth_validator, get_oauth_validator

# Configure global validator
configure_oauth_validator(config)

# Use validator anywhere in your app
validator = get_oauth_validator()
auth_context = await validator.validate_token(token)
```

### Error Handling

```python
from mcp_obs_server import MCPError, with_oauth

@with_oauth
async def protected_handler(request, auth_context: AuthContext):
    try:
        # Your handler logic
        return {"result": "success"}
    except Exception as e:
        # OAuth errors are automatically handled
        # Custom errors can be raised as MCPError
        raise MCPError(code=-32603, message="Internal server error")
```

## Authentication Context

The `AuthContext` object provides information about the authenticated user:

```python
class AuthContext:
    user_id: str              # User ID from OAuth token
    email: str                # User email address
    name: Optional[str]       # User display name
    image: Optional[str]      # User profile image URL
    scopes: List[str]         # OAuth scopes granted
    client_id: str           # OAuth client ID
    expires_at: int          # Token expiration (milliseconds since epoch)
```

## Transport Types

The SDK supports three MCP transport types:

1. **Stdio Transport**: Standard input/output communication
2. **HTTP Transport**: RESTful HTTP requests
3. **Streamable HTTP**: HTTP with Server-Sent Events (SSE) support

## Development

### Setup

```bash
cd packages/sdk/python/mcp-server
uv sync
```

### Testing

```bash
uv run pytest
```

### Linting

```bash
uv run ruff check
uv run mypy src/
```

## Examples

See the [examples](./examples/) directory for complete working examples:

- `stdio_example.py` - Basic stdio transport with OAuth
- `fastapi_example.py` - FastAPI web server with OAuth
- `flask_example.py` - Flask web server with OAuth

## Key Design Patterns

### 1. SDK-First Architecture

The SDK handles all OAuth complexity:
- **OAuth Discovery**: Automatic `.well-known` endpoint creation
- **Proxy Endpoints**: `/register`, `/authorize`, `/token` automatically created
- **Token Validation**: RFC 7662 introspection with caching
- **Scope Parsing**: Handles both space-separated and comma-separated formats
- **Error Handling**: Proper OAuth error responses and challenge headers

### 2. Official MCP SDK Compatibility

Designed to work seamlessly with the official MCP SDK:

```python
from mcp.server.auth.provider import TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp.server import FastMCP

# The SDK creates MCP-compatible components
class McpObsTokenVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> Optional[AccessToken]:
        # RFC 7662 token introspection
        # Platform communication
        # Scope parsing and validation
```

### 3. Transport-Agnostic Design

Single SDK works across all MCP transports:

```python
# Same SDK code, different transports
oauth_adapter = await mcp_obs.create_oauth_middleware('stdio')
oauth_adapter = await mcp_obs.create_oauth_middleware('http')
oauth_adapter = await mcp_obs.create_oauth_middleware('streamable-http')
```

### 4. Scope Handling Best Practices

The SDK automatically handles scope format variations:

```python
# Platform returns: "read,write" (comma-separated)
# SDK parses to: ["read", "write"] (standard format)
# Server requires: ["read", "write"] (standard format)
# ✅ Automatic compatibility!
```

## Key Learnings & Best Practices

### 1. Scope Format Compatibility

**Problem**: mcp-obs platform returns comma-separated scopes (`"read,write"`), but OAuth standard expects space-separated (`"read write"`).

**Solution**: SDK automatically detects and parses both formats:

```python
def parse_scopes(scope_string: str) -> List[str]:
    if "," in scope_string:
        return [s.strip() for s in scope_string.split(",")]
    else:
        return scope_string.split()
```

### 2. MCP Transport Selection

**Critical**: For OAuth with MCP clients like Cursor, use `streamable-http`:

```python
# ✅ Correct - OAuth compatible
app.run('streamable-http')

# ❌ Wrong - OAuth won't work with MCP clients
app.run()  # defaults to stdio
```

### 3. OAuth Discovery Endpoints

MCP clients expect specific discovery patterns:

```python
# Required endpoints created automatically by SDK:
# GET /.well-known/oauth-protected-resource
# POST /register (DCR proxy)
# GET /authorize (OAuth proxy)
# POST /token (OAuth proxy)
```

### 4. Subdomain URL Construction

The SDK handles localhost→subdomain conversion automatically:

```python
# Input: platform_url="http://localhost:3000", server_slug="test"
# SDK creates: "http://test.localhost:3000"
# This enables proper tenant isolation during development
```

## Development vs Production

### Development Setup

```python
app = create_fastmcp_with_oauth(
    name="My Dev Server",
    server_slug="dev",
    platform_url="http://localhost:3000",  # Local mcp-obs platform
    debug=True
)
```

### Production Setup

```python
app = create_fastmcp_with_oauth(
    name="My Production Server",
    server_slug="mycompany",
    platform_url="https://mcp-obs.com",
    required_scopes=["read", "write"],
    debug=False
)
```

## Troubleshooting

### Common Issues

1. **403 Insufficient Scope**
   - Check scope format parsing (comma vs space separated)
   - Verify required_scopes configuration matches token scopes

2. **401 Unauthorized**
   - Verify token introspection endpoint connectivity
   - Check debug logs for introspection response details

3. **Server Won't Start with OAuth**
   - Ensure using `streamable-http` transport for FastMCP
   - Verify platform_url is accessible

4. **MCP Client Connection Issues**
   - Check OAuth discovery endpoint: `/.well-known/oauth-protected-resource`
   - Verify DCR endpoint is proxying correctly: `/register`

### Debug Commands

```bash
# Test OAuth discovery
curl http://localhost:3008/.well-known/oauth-protected-resource

# Test DCR
curl -X POST http://localhost:3008/register -H "Content-Type: application/json" -d '{"client_name":"Test"}'

# Test token introspection (with real token)
curl -X POST http://localhost:3008/mcp -H "Authorization: Bearer <token>"
```

### Debug Logging

Enable comprehensive OAuth flow visibility:

```python
oauth_config = {"debug": True}

# Example debug output:
# 🔍 [mcp-obs] Verifying token via https://platform/api/mcp-oauth/introspect
# ✅ [mcp-obs] Token verified for user: user@example.com
# 🔍 [mcp-obs] Parsed scopes: ['read', 'write']
# 🔄 [OAuth Proxy] Proxying DCR request to platform
# ✅ [OAuth Proxy] DCR successful: mcp_client_12345
```

## Future Implementation Guidance

### Adding New Transport Support

1. Create adapter class inheriting from base transport adapter
2. Implement transport-specific OAuth middleware
3. Add to `create_oauth_adapter()` factory function
4. Follow existing patterns for consistency

### Extending Scope Validation

```python
class CustomScopeValidator:
    def validate_scopes(self, token_scopes: List[str], required_scopes: List[str]) -> bool:
        # Custom validation logic
        # Hierarchical scopes, role-based access, etc.
        pass
```

### Adding New OAuth Providers

The SDK is designed for mcp-obs platform integration, but can be extended:

1. Implement new `TokenVerifier` subclass
2. Add provider-specific introspection logic
3. Maintain compatibility with MCP SDK interfaces

## Platform Integration

This SDK integrates with the mcp-obs platform to provide:

- User authentication and session management
- OAuth 2.1 token validation
- Scope-based access control
- Request correlation and logging
- Multi-tenant user isolation

## API Reference

### Main Classes

- **`McpObsSDK`**: Main SDK class for manual integration
- **`create_fastmcp_with_oauth()`**: FastMCP integration helper
- **`OAuthTokenValidator`**: Token validation utility
- **`McpObsTokenVerifier`**: MCP SDK compatible token verifier

### Configuration Types

- **`OAuthConfig`**: OAuth configuration interface
- **`AuthContext`**: Authenticated user context
- **`TransportAdapterConfig`**: Transport-specific configuration

See source code for complete API documentation and type definitions.

## License

MIT License - see [LICENSE](../../../../LICENSE) for details.

---

**Need Help?** Check the demo implementations in `/demo-mcp/python/` for complete working examples.