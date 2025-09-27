"""
Transport-specific OAuth adapters for different MCP transport types
Handles Bearer token extraction and error responses for each transport
"""
import json
import asyncio
from typing import Any, Dict, List, Optional, Callable, Awaitable, Union
from urllib.parse import urlparse, parse_qs, urlencode
from loguru import logger

from .types import OAuthConfig, AuthContext
from .oauth_middleware import with_oauth, AuthenticatedHandler, RequestHandler, configure_oauth_validator, create_oauth_challenge_headers
from .oauth_validator import OAuthTokenValidator


class TransportAdapterConfig(OAuthConfig):
    """Extended OAuth configuration for transport adapters"""
    required_scopes: List[str] = []
    """Required scopes for all protected endpoints"""

    skip_validation_for: List[str] = []
    """Skip OAuth validation for specific tools"""


class StdioOAuthAdapter:
    """
    Stdio Transport OAuth Adapter
    Handles Bearer token extraction from MCP request metadata for stdio transport
    """

    def __init__(self, config: TransportAdapterConfig):
        self.config = config
        configure_oauth_validator(config)

    def with_oauth(self, handler: AuthenticatedHandler) -> RequestHandler:
        """
        Wrap a request handler with OAuth authentication for stdio transport
        """
        async def wrapper(request: Any) -> Any:
            if self.config.debug:
                logger.debug(f"[OAuth Stdio] Processing request: {getattr(request, 'method', 'unknown')}")

            try:
                return await with_oauth(
                    handler,
                    required_scopes=self.config.required_scopes,
                    skip_validation_for=self.config.skip_validation_for
                )(request)
            except Exception as error:
                if self.config.debug:
                    logger.error(f"[OAuth Stdio] Authentication failed: {error}")
                raise error

        return wrapper

    @staticmethod
    def extract_token(request: Any) -> Optional[str]:
        """
        Extract Bearer token from stdio request metadata
        Stdio transport typically passes auth in request metadata
        """
        # Check various metadata locations for stdio transport
        metadata = getattr(request, 'metadata', None)
        if metadata:
            # Standard Authorization header in metadata
            auth_header = metadata.get('authorization') or metadata.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                return auth_header[7:]

            # MCP-specific auth field
            auth_field = metadata.get('auth')
            if auth_field and isinstance(auth_field, str) and auth_field.startswith('Bearer '):
                return auth_field[7:]

        # Check if token is passed directly in request
        auth_direct = getattr(request, 'authorization', None)
        if auth_direct and auth_direct.startswith('Bearer '):
            return auth_direct[7:]

        return None


class HTTPOAuthAdapter:
    """
    HTTP Transport OAuth Adapter
    Handles Bearer token extraction from HTTP Authorization headers
    """

    def __init__(self, config: TransportAdapterConfig):
        self.config = config
        configure_oauth_validator(config)

    def with_oauth(self, handler: AuthenticatedHandler) -> RequestHandler:
        """
        Wrap a request handler with OAuth authentication for HTTP transport
        """
        async def wrapper(request: Any) -> Any:
            if self.config.debug:
                logger.debug(f"[OAuth HTTP] Processing request: {getattr(request, 'method', 'unknown')}")

            try:
                return await with_oauth(
                    handler,
                    required_scopes=self.config.required_scopes,
                    skip_validation_for=self.config.skip_validation_for
                )(request)
            except Exception as error:
                if self.config.debug:
                    logger.error(f"[OAuth HTTP] Authentication failed: {error}")

                # For HTTP transport, enhance error with proper HTTP headers
                challenge_headers = create_oauth_challenge_headers(
                    self.config.server_slug
                )

                # Enhance error with headers if possible
                if hasattr(error, '__dict__'):
                    existing_headers = getattr(error, 'headers', {})
                    error.headers = {**existing_headers, **challenge_headers}

                raise error

        return wrapper

    @staticmethod
    def extract_token(request: Any) -> Optional[str]:
        """
        Extract Bearer token from HTTP request headers
        """
        headers = getattr(request, 'headers', None)
        if headers:
            # Standard Authorization header
            auth_header = headers.get('authorization') or headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                return auth_header[7:]

        return None

    @staticmethod
    def create_unauthorized_response(
        server_slug: str,
        server_id: Optional[str] = None,
        error: str = "Unauthorized"
    ) -> Dict[str, Any]:
        """
        Create HTTP 401 response with proper OAuth challenge headers
        """
        challenge_headers = create_oauth_challenge_headers(server_slug, server_id)

        return {
            "status": 401,
            "headers": {
                "Content-Type": "application/json",
                **challenge_headers
            },
            "body": {
                "error": "unauthorized",
                "error_description": error,
                "resource_metadata": f"https://{server_slug}.mcp-obs.com/.well-known/oauth-protected-resource"
            }
        }


class StreamableHTTPOAuthAdapter:
    """
    Streamable HTTP Transport OAuth Adapter
    Handles Bearer token extraction for both HTTP requests and SSE connections
    """

    def __init__(self, config: TransportAdapterConfig):
        self.config = config
        configure_oauth_validator(config)

    def with_oauth(self, handler: AuthenticatedHandler) -> RequestHandler:
        """
        Wrap a request handler with OAuth authentication for streamable HTTP transport
        """
        async def wrapper(request: Any) -> Any:
            if self.config.debug:
                logger.debug(f"[OAuth Streamable] Processing request: {getattr(request, 'method', 'unknown')}")

            try:
                return await with_oauth(
                    handler,
                    required_scopes=self.config.required_scopes,
                    skip_validation_for=self.config.skip_validation_for
                )(request)
            except Exception as error:
                if self.config.debug:
                    logger.error(f"[OAuth Streamable] Authentication failed: {error}")
                raise error

        return wrapper

    @staticmethod
    def extract_token(request: Any) -> Optional[str]:
        """
        Extract Bearer token from streamable HTTP request
        Can handle both regular HTTP requests and SSE connection metadata
        """
        # Try HTTP headers first
        token = HTTPOAuthAdapter.extract_token(request)
        if token:
            return token

        # Check session context for SSE connections
        session = getattr(request, 'session', None)
        if session:
            auth_header = getattr(session, 'authorization', None)
            if auth_header and auth_header.startswith('Bearer '):
                return auth_header[7:]

        # Check connection metadata for streaming
        connection = getattr(request, 'connection', None)
        if connection:
            headers = getattr(connection, 'headers', None)
            if headers:
                auth_header = headers.get('authorization') or headers.get('Authorization')
                if auth_header and auth_header.startswith('Bearer '):
                    return auth_header[7:]

        return None


class FastAPIMiddleware:
    """
    FastAPI middleware for OAuth protection
    Use this with FastAPI apps for HTTP/streamable transport
    """

    def __init__(self, config: TransportAdapterConfig):
        self.config = config

    async def __call__(self, request: Any, call_next: Callable) -> Any:
        """
        FastAPI middleware implementation
        """
        # Skip OAuth for health checks and public endpoints
        if self._is_public_endpoint(request.url.path):
            if self.config.debug:
                logger.debug(f"[OAuth FastAPI] Skipping OAuth for public endpoint: {request.url.path}")
            return await call_next(request)

        token = self._extract_token_from_request(request)
        if not token:
            if self.config.debug:
                logger.error("[OAuth FastAPI] No Bearer token found in request")
            return self._send_unauthorized_response("Authentication required")

        try:
            # Use HTTP-based validation (standalone SDK pattern)
            validator = OAuthTokenValidator(self.config)
            auth_context = await validator.validate_token(token)

            if not auth_context:
                return self._send_unauthorized_response("Invalid or expired token")

            if self.config.debug:
                logger.debug(f"[OAuth FastAPI] Successfully authenticated user: {auth_context.email}")

            # Attach auth context to request state
            if not hasattr(request, 'state'):
                request.state = type('State', (), {})()
            request.state.auth_context = auth_context

            return await call_next(request)

        except Exception as error:
            if self.config.debug:
                logger.error(f"[OAuth FastAPI] Middleware error: {error}")
            return self._send_unauthorized_response("Token validation failed")

    def _extract_token_from_request(self, request: Any) -> Optional[str]:
        """
        Extract Bearer token from FastAPI request
        """
        auth_header = request.headers.get('authorization') or request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            return auth_header[7:]
        return None

    def _is_public_endpoint(self, path: str) -> bool:
        """
        Check if endpoint should be public (no OAuth required)
        """
        public_paths = [
            '/health',
            '/status',
            '/.well-known/',
            '/favicon.ico',
            '/register',    # OAuth proxy endpoints
            '/token',
            '/authorize'
        ]

        return any(path.startswith(public_path) for public_path in public_paths)

    def _send_unauthorized_response(self, message: str) -> Any:
        """
        Send OAuth challenge response with proper resource_metadata for discovery
        """
        from fastapi import HTTPException, status
        from fastapi.responses import JSONResponse

        # Construct proper OAuth server URL with subdomain for server slug
        if self.config.platform_url and self.config.server_slug:
            if 'localhost' in self.config.platform_url:
                port = self.config.platform_url.split(':')[-1] if ':' in self.config.platform_url else '3000'
                protocol = 'https' if self.config.platform_url.startswith('https') else 'http'
                auth_server_url = f"{protocol}://{self.config.server_slug}.localhost:{port}"
            else:
                auth_server_url = f"https://{self.config.server_slug}.mcp-obs.com"
        elif self.config.server_slug:
            auth_server_url = f"https://{self.config.server_slug}.mcp-obs.com"
        elif self.config.platform_url:
            auth_server_url = self.config.platform_url
        else:
            auth_server_url = "https://mcp-obs.com"

        www_authenticate_value = f"Bearer resource_metadata={auth_server_url}/.well-known/oauth-authorization-server"

        if self.config.debug:
            logger.debug(f"[OAuth] Setting WWW-Authenticate header: {www_authenticate_value}")

        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "jsonrpc": "2.0",
                "error": {
                    "code": -32000,
                    "message": f"Unauthorized: {message}",
                    "www-authenticate": www_authenticate_value
                },
                "id": None
            },
            headers={"WWW-Authenticate": www_authenticate_value}
        )


class FlaskMiddleware:
    """
    Flask middleware for OAuth protection
    Use this with Flask apps for HTTP/streamable transport
    """

    def __init__(self, config: TransportAdapterConfig):
        self.config = config

    def create_middleware(self, app):
        """
        Create Flask middleware wrapper
        """
        @app.before_request
        async def oauth_middleware():
            from flask import request, jsonify, g

            # Skip OAuth for health checks and public endpoints
            if self._is_public_endpoint(request.path):
                if self.config.debug:
                    logger.debug(f"[OAuth Flask] Skipping OAuth for public endpoint: {request.path}")
                return None

            token = self._extract_token_from_request(request)
            if not token:
                if self.config.debug:
                    logger.error("[OAuth Flask] No Bearer token found in request")
                return self._send_unauthorized_response("Authentication required")

            try:
                # Use HTTP-based validation (standalone SDK pattern)
                validator = OAuthTokenValidator(self.config)
                auth_context = await validator.validate_token(token)

                if not auth_context:
                    return self._send_unauthorized_response("Invalid or expired token")

                if self.config.debug:
                    logger.debug(f"[OAuth Flask] Successfully authenticated user: {auth_context.email}")

                # Attach auth context to Flask's g object
                g.auth_context = auth_context

                return None  # Continue to the actual route handler

            except Exception as error:
                if self.config.debug:
                    logger.error(f"[OAuth Flask] Middleware error: {error}")
                return self._send_unauthorized_response("Token validation failed")

        return app

    def _extract_token_from_request(self, request) -> Optional[str]:
        """
        Extract Bearer token from Flask request
        """
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            return auth_header[7:]
        return None

    def _is_public_endpoint(self, path: str) -> bool:
        """
        Check if endpoint should be public (no OAuth required)
        """
        public_paths = [
            '/health',
            '/status',
            '/.well-known/',
            '/favicon.ico',
            '/register',    # OAuth proxy endpoints
            '/token',
            '/authorize'
        ]

        return any(path.startswith(public_path) for public_path in public_paths)

    def _send_unauthorized_response(self, message: str):
        """
        Send OAuth challenge response with proper resource_metadata for discovery
        """
        from flask import jsonify

        # Construct proper OAuth server URL with subdomain for server slug
        if self.config.platform_url and self.config.server_slug:
            if 'localhost' in self.config.platform_url:
                port = self.config.platform_url.split(':')[-1] if ':' in self.config.platform_url else '3000'
                protocol = 'https' if self.config.platform_url.startswith('https') else 'http'
                auth_server_url = f"{protocol}://{self.config.server_slug}.localhost:{port}"
            else:
                auth_server_url = f"https://{self.config.server_slug}.mcp-obs.com"
        elif self.config.server_slug:
            auth_server_url = f"https://{self.config.server_slug}.mcp-obs.com"
        elif self.config.platform_url:
            auth_server_url = self.config.platform_url
        else:
            auth_server_url = "https://mcp-obs.com"

        www_authenticate_value = f"Bearer resource_metadata={auth_server_url}/.well-known/oauth-authorization-server"

        if self.config.debug:
            logger.debug(f"[OAuth] Setting WWW-Authenticate header: {www_authenticate_value}")

        response = jsonify({
            "jsonrpc": "2.0",
            "error": {
                "code": -32000,
                "message": f"Unauthorized: {message}",
                "www-authenticate": www_authenticate_value
            },
            "id": None
        })
        response.status_code = 401
        response.headers['WWW-Authenticate'] = www_authenticate_value

        return response


def create_oauth_adapter(
    transport_type: str,
    config: TransportAdapterConfig
) -> Union[StdioOAuthAdapter, HTTPOAuthAdapter, StreamableHTTPOAuthAdapter]:
    """
    Factory function to create appropriate OAuth adapter based on transport type
    """
    if transport_type == 'stdio':
        return StdioOAuthAdapter(config)
    elif transport_type == 'http':
        return HTTPOAuthAdapter(config)
    elif transport_type == 'streamable-http':
        return StreamableHTTPOAuthAdapter(config)
    else:
        raise ValueError(f"Unsupported transport type: {transport_type}")


def create_oauth_config(
    server_slug: str,
    required_scopes: Optional[List[str]] = None,
    skip_validation_for: Optional[List[str]] = None,
    debug: bool = False,
    platform_url: Optional[str] = None
) -> TransportAdapterConfig:
    """
    Unified OAuth configuration helper
    Creates appropriate adapter configuration for mcp-obs OAuth server
    """
    return TransportAdapterConfig(
        server_slug=server_slug,
        platform_url=platform_url,
        required_scopes=required_scopes or [],
        skip_validation_for=skip_validation_for or [],
        debug=debug
    )