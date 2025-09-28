"""
mcp-obs Server SDK - Main SDK class

This module provides the main McpObsSDK class that mirrors the TypeScript implementation,
including OAuth middleware creation and proxy endpoint functionality.
"""

import asyncio
import json
from typing import Any, Dict, List, Optional, Callable
from fastapi import FastAPI, Request, Response, HTTPException
from starlette.responses import RedirectResponse
import httpx

from .types import OAuthConfig, AuthContext
from .oauth_validator import OAuthTokenValidator
from .transport_adapters import create_oauth_adapter, create_oauth_config


class McpObsSDK:
    """
    Main mcp-obs SDK class that provides OAuth middleware and proxy endpoints

    This class mirrors the TypeScript SDK functionality, providing:
    - OAuth middleware creation for different transport types
    - OAuth proxy endpoints (register, authorize, token)
    - Token validation
    - Usage tracking
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the mcp-obs SDK

        Args:
            config: Configuration dict with serverName, version, oauthConfig, etc.
        """
        self.config = config
        self.server_name = config.get("serverName", "unknown")
        self.version = config.get("version", "1.0.0")
        self.oauth_config = config.get("oauthConfig")

        if self.oauth_config:
            self.server_slug = self.oauth_config["serverSlug"]
            self.platform_url = self.oauth_config.get("platformUrl", "http://localhost:3000")
            self.debug = self.oauth_config.get("debug", False)

            # Convert localhost to subdomain format
            if "localhost" in self.platform_url and self.server_slug not in self.platform_url:
                if ":" in self.platform_url:
                    protocol, rest = self.platform_url.split("://", 1)
                    self.platform_url_with_subdomain = f"{protocol}://{self.server_slug}.{rest}"
                else:
                    self.platform_url_with_subdomain = f"{self.platform_url.replace('localhost', f'{self.server_slug}.localhost')}"
            else:
                self.platform_url_with_subdomain = self.platform_url
        else:
            self.server_slug = None
            self.platform_url = None
            self.platform_url_with_subdomain = None
            self.debug = False

    async def initialize(self) -> None:
        """Initialize the SDK connection to mcp-obs"""
        if self.debug:
            print(f"mcp-obs SDK initialized for server: {self.server_name}")
            if self.oauth_config:
                print(f"OAuth enabled for server slug: {self.server_slug}")
                print(f"Platform URL: {self.platform_url_with_subdomain}")

    async def create_oauth_middleware(self, transport_type: str = "stdio"):
        """
        Create OAuth middleware for MCP request handlers

        Args:
            transport_type: Transport type ('stdio', 'http', 'streamable-http')

        Returns:
            OAuth adapter with middleware and proxy endpoint functionality
        """
        if not self.oauth_config:
            raise ValueError("OAuth configuration required to create OAuth middleware")

        oauth_config = create_oauth_config(
            server_slug=self.server_slug,
            required_scopes=self.oauth_config.get("requiredScopes"),
            skip_validation_for=self.oauth_config.get("skipValidationFor"),
            debug=self.debug,
            platform_url=self.platform_url
        )

        adapter = create_oauth_adapter(transport_type, oauth_config)

        # Add OAuth proxy endpoints functionality
        adapter.create_oauth_proxy_endpoints = self._create_oauth_proxy_endpoints_factory(adapter)

        # Add FastAPI middleware functionality - this is what makes integration simple!
        adapter.fastapi_middleware = self._create_fastapi_middleware_factory(adapter)

        # Add Express-like middleware function for easier integration
        adapter.express_middleware = self._create_express_middleware_factory(adapter)

        return adapter

    def _create_oauth_proxy_endpoints_factory(self, adapter):
        """Factory method to create OAuth proxy endpoints for the adapter"""

        def create_oauth_proxy_endpoints(app: FastAPI):
            """
            Create OAuth proxy endpoints on FastAPI app
            These endpoints proxy OAuth requests to the mcp-obs platform
            """

            @app.get("/.well-known/oauth-protected-resource")
            async def oauth_protected_resource():
                """OAuth discovery endpoint for MCP clients"""
                return {
                    "resource": f"http://localhost:3005/mcp",  # TODO: Make this configurable
                    "authorization_servers": [self.platform_url_with_subdomain],
                    "scopes_supported": ["read", "write"],
                    "bearer_methods_supported": ["header"]
                }

            @app.post("/register")
            async def oauth_register(request: Request):
                """Dynamic Client Registration proxy to mcp-obs platform"""
                body = await request.json()

                if self.debug:
                    print(f"🔄 [OAuth Proxy] Proxying DCR request to {self.platform_url_with_subdomain}")

                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{self.platform_url_with_subdomain}/mcp-auth/oauth/register",
                        json=body,
                        headers={"Content-Type": "application/json"}
                    )

                    if response.is_success:
                        if self.debug:
                            result = response.json()
                            print(f"✅ [OAuth Proxy] DCR successful: {result.get('client_id')}")
                    else:
                        if self.debug:
                            print(f"❌ [OAuth Proxy] DCR failed: {response.status_code}")

                    return Response(
                        content=response.content,
                        status_code=response.status_code,
                        headers=dict(response.headers)
                    )

            @app.get("/authorize")
            async def oauth_authorize(request: Request):
                """OAuth authorization proxy to mcp-obs platform"""
                query_params = str(request.url.query)

                if self.debug:
                    print(f"🔄 [OAuth Proxy] Proxying authorize request to {self.platform_url_with_subdomain}")

                # Redirect to mcp-obs platform authorization endpoint
                redirect_url = f"{self.platform_url_with_subdomain}/mcp-auth/oauth/authorize?{query_params}"

                return RedirectResponse(url=redirect_url, status_code=302)

            @app.post("/token")
            async def oauth_token(request: Request):
                """OAuth token exchange proxy to mcp-obs platform"""
                form_data = await request.form()

                if self.debug:
                    print(f"🔄 [OAuth Proxy] Proxying token request to {self.platform_url_with_subdomain}")

                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{self.platform_url_with_subdomain}/mcp-auth/oauth/token",
                        data=dict(form_data),
                        headers={"Content-Type": "application/x-www-form-urlencoded"}
                    )

                    if response.is_success:
                        if self.debug:
                            print(f"✅ [OAuth Proxy] Token exchange successful")
                    else:
                        if self.debug:
                            print(f"❌ [OAuth Proxy] Token exchange failed: {response.status_code}")

                    return Response(
                        content=response.content,
                        status_code=response.status_code,
                        headers=dict(response.headers)
                    )

            if self.debug:
                print("✅ OAuth proxy endpoints created")

        return create_oauth_proxy_endpoints

    async def validate_token(self, token: str) -> Optional[AuthContext]:
        """
        Validate an OAuth token directly

        Args:
            token: Bearer token to validate

        Returns:
            AuthContext if valid, None if invalid
        """
        if not self.oauth_config:
            raise ValueError("OAuth configuration required for token validation")

        from .transport_adapters import create_oauth_config
        oauth_config = create_oauth_config(
            server_slug=self.server_slug,
            debug=self.debug,
            platform_url=self.platform_url
        )
        validator = OAuthTokenValidator(oauth_config)

        return await validator.validate_token(token)

    async def report_status(self, status: str) -> None:
        """Report server status to mcp-obs"""
        if self.debug:
            print(f"Server {self.server_name} status: {status}")

    async def track_tool_usage(self, tool_name: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Track tool usage analytics"""
        if self.debug:
            print(f"Tool usage tracked: {tool_name}", metadata)

    async def track_authenticated_tool_usage(
        self,
        tool_name: str,
        auth_context: AuthContext,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Track authenticated tool usage with user context"""
        if self.debug:
            print(f"Authenticated tool usage tracked: {tool_name}", {
                "user": auth_context.user_id,
                "email": auth_context.email,
                "scopes": auth_context.scopes,
                **(metadata or {})
            })

    def _create_fastapi_middleware_factory(self, adapter):
        """Factory method to create FastAPI middleware for OAuth"""

        def fastapi_middleware():
            """
            Create FastAPI OAuth middleware
            Returns a middleware function that validates OAuth tokens
            """
            async def oauth_middleware(request, call_next):
                # Skip OAuth for public endpoints
                if self._is_public_endpoint(request.url.path):
                    response = await call_next(request)
                    return response

                # Extract Bearer token from Authorization header
                auth_header = request.headers.get("authorization") or request.headers.get("Authorization")

                if not auth_header:
                    raise HTTPException(
                        status_code=401,
                        detail="Authorization header required",
                        headers={"WWW-Authenticate": f'Bearer resource_metadata="{self.platform_url_with_subdomain}/.well-known/oauth-protected-resource"'}
                    )

                token = self._extract_bearer_token(auth_header)
                if not token:
                    raise HTTPException(
                        status_code=401,
                        detail="Bearer token required",
                        headers={"WWW-Authenticate": f'Bearer resource_metadata="{self.platform_url_with_subdomain}/.well-known/oauth-protected-resource"'}
                    )

                # Validate token using SDK
                auth_context = await self.validate_token(token)
                if not auth_context:
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid or expired OAuth token",
                        headers={"WWW-Authenticate": f'Bearer resource_metadata="{self.platform_url_with_subdomain}/.well-known/oauth-protected-resource"'}
                    )

                # Add auth context to request state
                request.state.auth_context = auth_context

                response = await call_next(request)
                return response

            return oauth_middleware

        return fastapi_middleware

    def _create_express_middleware_factory(self, adapter):
        """Factory method to create Express-like middleware function"""

        def express_middleware():
            """
            Create Express-like OAuth middleware function
            This matches the TypeScript SDK pattern exactly
            """
            async def middleware(request):
                """OAuth validation middleware"""
                # Skip OAuth for public endpoints
                if self._is_public_endpoint(request.url.path):
                    return None  # Continue without auth

                # Extract Bearer token
                auth_header = request.headers.get("authorization") or request.headers.get("Authorization")

                if not auth_header:
                    raise HTTPException(
                        status_code=401,
                        detail="Authorization header required",
                        headers={"WWW-Authenticate": f'Bearer resource_metadata="{self.platform_url_with_subdomain}/.well-known/oauth-protected-resource"'}
                    )

                token = self._extract_bearer_token(auth_header)
                if not token:
                    raise HTTPException(
                        status_code=401,
                        detail="Bearer token required",
                        headers={"WWW-Authenticate": f'Bearer resource_metadata="{self.platform_url_with_subdomain}/.well-known/oauth-protected-resource"'}
                    )

                # Validate token
                auth_context = await self.validate_token(token)
                if not auth_context:
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid or expired OAuth token",
                        headers={"WWW-Authenticate": f'Bearer resource_metadata="{self.platform_url_with_subdomain}/.well-known/oauth-protected-resource"'}
                    )

                return auth_context

            return middleware

        return express_middleware

    def _is_public_endpoint(self, path: str) -> bool:
        """Check if endpoint should be public (no OAuth required)"""
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

    def _extract_bearer_token(self, authorization_header: str) -> Optional[str]:
        """Extract Bearer token from Authorization header"""
        if authorization_header and authorization_header.startswith("Bearer "):
            return authorization_header[7:]  # Remove "Bearer " prefix
        return None