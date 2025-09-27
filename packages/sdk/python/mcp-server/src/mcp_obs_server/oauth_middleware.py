"""
OAuth middleware utilities for MCP servers
Provides decorator functions to add OAuth authentication to MCP request handlers
"""
import time
from typing import Any, Callable, Optional, List, Dict, Union, Awaitable
from functools import wraps
from pydantic import BaseModel
from loguru import logger

from .types import OAuthConfig, AuthContext
from .oauth_validator import OAuthTokenValidator


class MCPError(Exception):
    """MCP protocol error with error code"""

    def __init__(self, code: int, message: str):
        super().__init__(message)
        self.code = code


class OAuthMiddlewareConfig(OAuthConfig):
    """Extended OAuth configuration for middleware"""
    required_scopes: List[str] = []
    """Required scopes for all protected endpoints"""

    skip_validation_for: List[str] = []
    """Skip OAuth validation for specific tools"""


# Type definitions
AuthenticatedHandler = Callable[[Any, AuthContext], Awaitable[Any]]
RequestHandler = Callable[[Any], Awaitable[Any]]

# Global validator instance
_global_validator: Optional[OAuthTokenValidator] = None


def configure_oauth_validator(config: OAuthMiddlewareConfig) -> None:
    """Configure global OAuth validator instance"""
    global _global_validator
    _global_validator = OAuthTokenValidator(config)


def get_oauth_validator() -> OAuthTokenValidator:
    """Get the configured OAuth validator instance"""
    if _global_validator is None:
        raise RuntimeError("OAuth validator not configured. Call configure_oauth_validator() first.")
    return _global_validator


def with_oauth(
    handler: AuthenticatedHandler,
    *,
    required_scopes: Optional[List[str]] = None,
    skip_validation_for: Optional[List[str]] = None
) -> RequestHandler:
    """
    Decorator that wraps MCP request handlers with OAuth authentication

    Args:
        handler: The original request handler that expects auth context
        required_scopes: Optional list of required scopes for this handler
        skip_validation_for: Optional list of tool names to skip validation for

    Returns:
        Wrapped handler that validates OAuth before calling original handler
    """
    @wraps(handler)
    async def wrapper(request: Any) -> Any:
        validator = get_oauth_validator()

        # Check if we should skip validation for this specific tool
        tool_name = getattr(getattr(request, 'params', None), 'name', None)
        if skip_validation_for and tool_name in skip_validation_for:
            # Call handler without auth context for skipped tools
            anonymous_context = AuthContext(
                user_id="anonymous",
                email="anonymous@mcp-obs.com",
                scopes=[],
                client_id="anonymous",
                expires_at=int(time.time() * 1000) + 3600000  # 1 hour from now
            )
            return await handler(request, anonymous_context)

        # Extract Bearer token from request
        token = _extract_token_from_request(request)

        if not token:
            raise MCPError(
                code=-32602,  # Invalid params error code
                message="Authorization required. Include Bearer token in Authorization header."
            )

        # Validate token
        auth_context = await validator.validate_token(token)

        if not auth_context:
            raise MCPError(
                code=-32602,  # Invalid params error code
                message="Invalid or expired OAuth token"
            )

        # Check required scopes
        if required_scopes and not validator.has_required_scopes(auth_context, required_scopes):
            raise MCPError(
                code=-32603,  # Internal error code (closest to 403 Forbidden)
                message=f"Insufficient scopes. Required: {', '.join(required_scopes)}, "
                       f"Got: {', '.join(auth_context.scopes)}"
            )

        # Call original handler with auth context
        return await handler(request, auth_context)

    return wrapper


def with_oauth_stdio(config: OAuthMiddlewareConfig) -> Callable[[AuthenticatedHandler], RequestHandler]:
    """
    Wrapper for stdio transport OAuth middleware
    Handles Bearer token extraction from MCP request metadata

    Args:
        config: OAuth middleware configuration

    Returns:
        Decorator function for stdio transport
    """
    # Configure validator if not already done
    if _global_validator is None:
        configure_oauth_validator(config)

    def decorator(handler: AuthenticatedHandler) -> RequestHandler:
        return with_oauth(
            handler,
            required_scopes=config.required_scopes,
            skip_validation_for=config.skip_validation_for
        )

    return decorator


def with_oauth_http(config: OAuthMiddlewareConfig) -> Callable[[AuthenticatedHandler], RequestHandler]:
    """
    Wrapper for HTTP transport OAuth middleware
    Handles Bearer token extraction from HTTP Authorization headers

    Args:
        config: OAuth middleware configuration

    Returns:
        Decorator function for HTTP transport
    """
    # Configure validator if not already done
    if _global_validator is None:
        configure_oauth_validator(config)

    def decorator(handler: AuthenticatedHandler) -> RequestHandler:
        return with_oauth(
            handler,
            required_scopes=config.required_scopes,
            skip_validation_for=config.skip_validation_for
        )

    return decorator


def _extract_token_from_request(request: Any) -> Optional[str]:
    """
    Extract Bearer token from MCP request
    This is a transport-agnostic extraction that tries multiple methods

    Args:
        request: MCP request object

    Returns:
        Bearer token string or None if not found
    """
    validator = get_oauth_validator()

    # Method 1: Check if request has an Authorization header (HTTP transports)
    headers = getattr(request, 'headers', None)
    if headers:
        # Try both lowercase and uppercase
        auth_header = headers.get('authorization') or headers.get('Authorization')
        if auth_header:
            token = validator.extract_bearer_token(auth_header)
            if token:
                return token

    # Method 2: Check MCP metadata (stdio transport)
    metadata = getattr(request, 'metadata', None)
    if metadata:
        auth_header = metadata.get('authorization') or metadata.get('Authorization')
        if auth_header:
            token = validator.extract_bearer_token(auth_header)
            if token:
                return token

    # Method 3: Check request params for authorization (fallback)
    params = getattr(request, 'params', None)
    if params:
        auth_header = getattr(params, 'authorization', None)
        if auth_header:
            token = validator.extract_bearer_token(auth_header)
            if token:
                return token

    # Method 4: Check top-level authorization field (custom transport)
    auth_header = getattr(request, 'authorization', None)
    if auth_header:
        token = validator.extract_bearer_token(auth_header)
        if token:
            return token

    return None


def create_oauth_challenge_headers(
    server_slug: str,
    server_id: Optional[str] = None,
) -> Dict[str, str]:
    """
    Utility function to create OAuth challenge response headers
    For HTTP transports that need WWW-Authenticate header

    Args:
        server_slug: MCP server slug
        server_id: Optional server ID for advanced header generation

    Returns:
        Dictionary of response headers
    """
    # Fallback to simple challenge header
    protocol = "http" if "localhost" in server_slug else "https"
    base_url = server_slug if "localhost" in server_slug else f"{server_slug}.mcp-obs.com"

    return {
        "WWW-Authenticate": f'Bearer resource_metadata="{protocol}://{base_url}/.well-known/oauth-protected-resource"'
    }


def is_authenticated(request: Any) -> bool:
    """
    Utility to check if request is authenticated
    Useful for conditional logic in handlers

    Args:
        request: MCP request object

    Returns:
        True if request has a valid Bearer token
    """
    try:
        token = _extract_token_from_request(request)
        return token is not None
    except Exception:
        return False


def get_request_correlation_id(request: Any) -> str:
    """
    Utility to get correlation ID for request tracking
    Generates a unique ID for each request for logging/debugging

    Args:
        request: MCP request object

    Returns:
        Correlation ID string
    """
    # Try to get existing correlation ID
    existing = getattr(request, 'correlation_id', None) or getattr(request, 'id', None)
    if existing:
        return str(existing)

    # Generate new correlation ID
    timestamp = int(time.time() * 1000)
    random_suffix = hex(hash(str(timestamp) + str(id(request))))[-9:]
    return f"req_{timestamp}_{random_suffix}"