"""
FastMCP OAuth Provider for mcp-obs Platform
Integrates with FastMCP's authentication system using OAuthProxy pattern
"""
from typing import Optional, List
from fastmcp.server.auth import OAuthProxy
from fastmcp.server.auth.providers.jwt import JWTVerifier
from pydantic import AnyHttpUrl

from .types import OAuthConfig


class McpObsProvider(OAuthProxy):
    """
    FastMCP authentication provider for mcp-obs platform

    This provider extends FastMCP's OAuthProxy to work with the mcp-obs
    OAuth authentication platform. It handles the complete OAuth flow
    including Dynamic Client Registration simulation, PKCE flows, and
    token validation.

    Usage:
        auth = McpObsProvider(
            server_slug="test",
            platform_url="http://localhost:3000",
            base_url="https://your-server.com"
        )

        mcp = FastMCP(name="My Server", auth=auth)
    """

    def __init__(
        self,
        server_slug: str,
        platform_url: str = None,
        base_url: str = "http://localhost:3005",
        required_scopes: Optional[List[str]] = None,
        debug: bool = False,
        redirect_path: str = "/auth/callback",
        **kwargs
    ):
        """
        Initialize mcp-obs OAuth provider

        Args:
            server_slug: Server slug for mcp-obs platform (e.g., "test" for test.mcp-obs.com)
            platform_url: Base URL of mcp-obs platform (defaults to production)
            base_url: Your FastMCP server's public URL
            required_scopes: OAuth scopes to request
            debug: Enable debug logging
            redirect_path: OAuth callback path
            **kwargs: Additional parameters passed to OAuthProxy
        """
        self.server_slug = server_slug
        self.platform_url = platform_url or f"https://{server_slug}.mcp-obs.com"
        self.debug = debug

        # Configure JWT verification for mcp-obs tokens
        token_verifier = JWTVerifier(
            # mcp-obs uses standard OAuth introspection for now
            # but we'll validate JWTs once the platform supports it
            jwks_uri=f"{self.platform_url}/.well-known/jwks.json",
            issuer=self.platform_url,
            audience=base_url,
            required_scopes=required_scopes or [],
            debug=debug
        )

        # Use mcp-obs OAuth endpoints
        # These are the standard OAuth endpoints that mcp-obs platform provides
        super().__init__(
            upstream_authorization_endpoint=f"{self.platform_url}/oauth/authorize",
            upstream_token_endpoint=f"{self.platform_url}/oauth/token",
            upstream_client_id="mcp-server-dynamic",  # mcp-obs recognizes this special client
            upstream_client_secret="dynamic-registration",  # Placeholder for DCR
            token_verifier=token_verifier,
            base_url=AnyHttpUrl(base_url),
            redirect_path=redirect_path,
            # mcp-obs supports PKCE
            forward_pkce=True,
            # Additional parameters for mcp-obs integration
            extra_authorize_params={
                "server_slug": server_slug,
                "mcp_integration": "true"
            },
            extra_token_params={
                "server_slug": server_slug
            },
            **kwargs
        )

        if self.debug:
            print(f"🔐 [mcp-obs] Configured OAuth provider:")
            print(f"   Server slug: {server_slug}")
            print(f"   Platform URL: {self.platform_url}")
            print(f"   Base URL: {base_url}")
            print(f"   Required scopes: {required_scopes}")


class McpObsTokenVerifier(JWTVerifier):
    """
    Specialized token verifier for mcp-obs platform

    This handles mcp-obs specific token validation using HTTP introspection
    until JWT support is fully implemented in the platform.
    """

    def __init__(
        self,
        server_slug: str,
        platform_url: Optional[str] = None,
        required_scopes: Optional[List[str]] = None,
        debug: bool = False,
        **kwargs
    ):
        self.server_slug = server_slug
        self.platform_url = platform_url or f"https://{server_slug}.mcp-obs.com"

        # For now, use HTTP introspection pattern
        # TODO: Switch to JWT once mcp-obs platform supports it
        super().__init__(
            jwks_uri=f"{self.platform_url}/.well-known/jwks.json",
            issuer=self.platform_url,
            required_scopes=required_scopes or [],
            debug=debug,
            **kwargs
        )

    async def validate_token(self, token: str) -> Optional[dict]:
        """
        Validate token using mcp-obs introspection endpoint

        This uses HTTP introspection for now, but will switch to JWT
        validation once the platform supports it.
        """
        if self.debug:
            print(f"🔍 [mcp-obs] Validating token with {self.platform_url}")

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.platform_url}/api/mcp-oauth/introspect",
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    data={
                        "token": token,
                        "server_slug": self.server_slug
                    },
                    timeout=10.0
                )

                if not response.is_success:
                    if self.debug:
                        print(f"❌ [mcp-obs] Token validation failed: {response.status_code}")
                    return None

                introspection = response.json()

                if not introspection.get("active"):
                    if self.debug:
                        print("❌ [mcp-obs] Token is not active")
                    return None

                if self.debug:
                    print(f"✅ [mcp-obs] Token validated for user: {introspection.get('username', 'unknown')}")

                return introspection

        except Exception as error:
            if self.debug:
                print(f"❌ [mcp-obs] Token validation error: {error}")
            return None


def create_mcp_obs_auth(
    server_slug: str,
    platform_url: Optional[str] = None,
    base_url: str = "http://localhost:3005",
    required_scopes: Optional[List[str]] = None,
    debug: bool = False
) -> McpObsProvider:
    """
    Convenience function to create mcp-obs authentication provider

    This is the main entry point for integrating mcp-obs OAuth with FastMCP.

    Args:
        server_slug: Server slug for mcp-obs platform
        platform_url: mcp-obs platform URL (optional)
        base_url: Your server's public URL
        required_scopes: OAuth scopes to request
        debug: Enable debug logging

    Returns:
        Configured McpObsProvider ready for use with FastMCP

    Example:
        from mcp_obs_server import create_mcp_obs_auth
        from fastmcp import FastMCP

        auth = create_mcp_obs_auth(
            server_slug="test",
            platform_url="http://localhost:3000",
            debug=True
        )

        mcp = FastMCP(name="My Server", auth=auth)
    """
    return McpObsProvider(
        server_slug=server_slug,
        platform_url=platform_url,
        base_url=base_url,
        required_scopes=required_scopes,
        debug=debug
    )