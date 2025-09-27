# mcp-obs Python Server SDK

OAuth authentication middleware for MCP servers, enabling seamless integration with the mcp-obs platform.

## Installation

```bash
# Using UV (recommended)
uv add mcp-obs-server

# Using pip
pip install mcp-obs-server
```

## Quick Start

### Basic OAuth Middleware

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

## Platform Integration

This SDK integrates with the mcp-obs platform to provide:

- User authentication and session management
- OAuth 2.1 token validation
- Scope-based access control
- Request correlation and logging
- Multi-tenant user isolation

## License

MIT License - see [LICENSE](../../../../LICENSE) for details.