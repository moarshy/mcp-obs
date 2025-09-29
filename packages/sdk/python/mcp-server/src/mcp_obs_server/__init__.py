"""
mcp-obs Server SDK - OAuth middleware for MCP servers

This SDK provides OAuth authentication middleware for MCP servers,
enabling integration with the mcp-obs platform for user authentication
and session management.

Main components:
- OAuth middleware decorators
- Transport-specific adapters (stdio, HTTP, streamable HTTP)
- Token validation utilities
- Configuration helpers
"""

# Core OAuth functionality
from .types import OAuthConfig, AuthContext, MCPServerConfig, TokenValidationResult
from .oauth_validator import OAuthTokenValidator, validate_token
from .oauth_middleware import (
    with_oauth,
    with_oauth_stdio,
    with_oauth_http,
    configure_oauth_validator,
    get_oauth_validator,
    create_oauth_challenge_headers,
    is_authenticated,
    get_request_correlation_id,
    MCPError,
    OAuthMiddlewareConfig
)

# Transport adapters
from .transport_adapters import (
    TransportAdapterConfig,
    StdioOAuthAdapter,
    HTTPOAuthAdapter,
    StreamableHTTPOAuthAdapter,
    FastAPIMiddleware,
    FlaskMiddleware,
    create_oauth_adapter,
    create_oauth_config
)

# Main SDK class
from .mcp_obs_sdk import McpObsSDK

# Support tool functionality
from .support_tool import (
    SupportToolConfig,
    SupportToolHandler,
    create_support_tool_handler,
    register_support_tool,
    configure_oauth_mcp_server
)

__version__ = "0.1.0"

__all__ = [
    # Core types
    "OAuthConfig",
    "AuthContext",
    "MCPServerConfig",
    "TokenValidationResult",

    # OAuth validator
    "OAuthTokenValidator",
    "validate_token",

    # OAuth middleware
    "with_oauth",
    "with_oauth_stdio",
    "with_oauth_http",
    "configure_oauth_validator",
    "get_oauth_validator",
    "create_oauth_challenge_headers",
    "is_authenticated",
    "get_request_correlation_id",
    "MCPError",
    "OAuthMiddlewareConfig",

    # Transport adapters
    "TransportAdapterConfig",
    "StdioOAuthAdapter",
    "HTTPOAuthAdapter",
    "StreamableHTTPOAuthAdapter",
    "FastAPIMiddleware",
    "FlaskMiddleware",
    "create_oauth_adapter",
    "create_oauth_config",

    # Main SDK class
    "McpObsSDK",

    # Support tool functionality
    "SupportToolConfig",
    "SupportToolHandler",
    "create_support_tool_handler",
    "register_support_tool",
    "configure_oauth_mcp_server",

    # Version
    "__version__"
]