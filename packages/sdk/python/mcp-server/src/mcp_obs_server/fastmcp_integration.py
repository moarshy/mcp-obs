"""
FastMCP integration for mcp-obs SDK
Following official MCP SDK patterns for OAuth integration
"""

from typing import Optional, List, Dict, Any
from mcp.server.auth.provider import TokenVerifier, AccessToken
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp.server import FastMCP
import httpx
import logging

from .oauth_validator import OAuthTokenValidator
from .types import AuthContext

logger = logging.getLogger(__name__)


class McpObsTokenVerifier(TokenVerifier):
    """
    Token verifier for mcp-obs platform using RFC 7662 token introspection

    This follows the official MCP SDK pattern but integrates with mcp-obs platform
    """

    def __init__(
        self,
        server_slug: str,
        platform_url: str,
        server_url: str,
        validate_resource: bool = False,
        debug: bool = False
    ):
        self.server_slug = server_slug
        self.platform_url = platform_url
        self.server_url = server_url
        self.validate_resource = validate_resource
        self.debug = debug

        # Build introspection endpoint
        self.introspection_endpoint = f"{platform_url}/api/mcp-oauth/introspect"

    async def verify_token(self, token: str) -> Optional[AccessToken]:
        """Verify token via mcp-obs platform introspection"""

        if self.debug:
            logger.info(f"🔍 [mcp-obs] Verifying token via {self.introspection_endpoint}")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.introspection_endpoint,
                    data={
                        "token": token,
                        "server_slug": self.server_slug
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )

                if response.status_code != 200:
                    if self.debug:
                        logger.warning(f"❌ [mcp-obs] Token introspection failed: {response.status_code}")
                    return None

                data = response.json()
                if not data.get("active", False):
                    if self.debug:
                        logger.warning("❌ [mcp-obs] Token is not active")
                    return None

                # Validate resource if required (RFC 8707)
                if self.validate_resource and not self._validate_resource(data):
                    if self.debug:
                        logger.warning(f"❌ [mcp-obs] Resource validation failed for {self.server_url}")
                    return None

                # Parse scopes - handle both comma-separated and space-separated formats
                scope_string = data.get("scope", "")
                if scope_string:
                    # If contains commas, split by comma; otherwise split by space (OAuth standard)
                    if "," in scope_string:
                        scopes = [s.strip() for s in scope_string.split(",")]
                    else:
                        scopes = scope_string.split()
                else:
                    scopes = []

                if self.debug:
                    logger.info(f"✅ [mcp-obs] Token verified for user: {data.get('username', 'unknown')}")
                    logger.info(f"🔍 [mcp-obs] Raw scope string: '{scope_string}'")
                    logger.info(f"🔍 [mcp-obs] Parsed scopes: {scopes}")
                    logger.info(f"🔍 [mcp-obs] Full token data: {data}")

                return AccessToken(
                    token=token,
                    client_id=data.get("client_id", "unknown"),
                    scopes=scopes,
                    expires_at=data.get("exp"),
                    resource=data.get("aud")
                )

        except Exception as e:
            if self.debug:
                logger.error(f"❌ [mcp-obs] Token verification error: {e}")
            return None

    def _validate_resource(self, token_data: Dict[str, Any]) -> bool:
        """Validate token was issued for this resource server"""
        aud = token_data.get("aud")
        if not aud:
            return False

        # Simple validation - in production you might want hierarchical matching
        return self.server_url in aud if isinstance(aud, list) else aud == self.server_url


def create_fastmcp_with_oauth(
    name: str,
    server_slug: str,
    platform_url: str = "http://localhost:3000",
    server_url: Optional[str] = None,
    host: str = "localhost",
    port: int = 3005,
    required_scopes: Optional[List[str]] = None,
    debug: bool = False,
    **fastmcp_kwargs
) -> FastMCP:
    """
    Create a FastMCP server with mcp-obs OAuth integration

    This function follows the official MCP SDK pattern but integrates with mcp-obs:
    - Creates McpObsTokenVerifier for token validation
    - Sets up AuthSettings for OAuth configuration
    - Returns configured FastMCP instance

    Args:
        name: Server name
        server_slug: mcp-obs server slug (e.g., "test" for test.mcp-obs.com)
        platform_url: mcp-obs platform URL
        server_url: This server's URL (auto-generated if not provided)
        host: Server host
        port: Server port
        required_scopes: Required OAuth scopes
        debug: Enable debug logging
        **fastmcp_kwargs: Additional FastMCP arguments

    Returns:
        Configured FastMCP server with OAuth

    Example:
        # Following official MCP SDK pattern
        app = create_fastmcp_with_oauth(
            name="My MCP Server",
            server_slug="test",
            platform_url="http://localhost:3000",
            debug=True
        )

        @app.tool()
        def my_tool() -> str:
            return "Hello from OAuth-protected tool!"

        app.run()
    """

    # Auto-generate server URL if not provided
    if not server_url:
        protocol = "https" if port == 443 else "http"
        server_url = f"{protocol}://{host}:{port}"

    # Convert localhost to subdomain format for platform URL
    if "localhost" in platform_url and server_slug not in platform_url:
        if ":" in platform_url:
            protocol, rest = platform_url.split("://", 1)
            platform_url_with_subdomain = f"{protocol}://{server_slug}.{rest}"
        else:
            platform_url_with_subdomain = platform_url.replace('localhost', f'{server_slug}.localhost')
    else:
        platform_url_with_subdomain = platform_url

    # Create mcp-obs token verifier
    token_verifier = McpObsTokenVerifier(
        server_slug=server_slug,
        platform_url=platform_url_with_subdomain,
        server_url=server_url,
        debug=debug
    )

    # Create auth settings following official pattern
    auth_settings = AuthSettings(
        issuer_url=platform_url_with_subdomain,
        required_scopes=required_scopes or ["read"],
        resource_server_url=server_url
    )

    # Create FastMCP server with OAuth - following official pattern!
    app = FastMCP(
        name=name,
        host=host,
        port=port,
        debug=debug,
        token_verifier=token_verifier,
        auth=auth_settings,
        **fastmcp_kwargs
    )

    if debug:
        print(f"🔐 [mcp-obs] Created FastMCP server with OAuth:")
        print(f"   Server: {name}")
        print(f"   Server URL: {server_url}")
        print(f"   Platform: {platform_url_with_subdomain}")
        print(f"   Required scopes: {required_scopes}")

    return app