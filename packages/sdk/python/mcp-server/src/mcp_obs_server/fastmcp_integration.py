"""
FastMCP integration for mcp-obs SDK
Following official MCP SDK patterns for OAuth integration
"""

from typing import Optional, List, Dict, Any
from mcp.server.auth.provider import TokenVerifier, AccessToken
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp.server import FastMCP
from mcp.server.fastmcp import Context
from mcp.server.session import ServerSession
import httpx
import logging
import asyncio
import time

from .oauth_validator import OAuthTokenValidator
from .types import AuthContext
from .support_tool import create_support_tool_handler, SupportToolConfig

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

        # Store current token for tool access
        self._current_token = None

    async def verify_token(self, token: str) -> Optional[AccessToken]:
        """Verify token via mcp-obs platform introspection"""

        if self.debug:
            logger.info(f"🔍 [mcp-obs] Verifying token via {self.introspection_endpoint}")

        # Store the current token for tool access
        self._current_token = token
        if self.debug:
            logger.info(f"🔍 [mcp-obs] Stored token in TokenVerifier instance {id(self)}: {token[:20]}...")

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

    def get_current_token(self) -> Optional[str]:
        """Get the current authenticated token"""
        return self._current_token


async def fetch_server_config(server_slug: str, platform_url: str, debug: bool = False) -> Dict[str, Any]:
    """Fetch server configuration from mcp-obs platform"""
    try:
        # Build API endpoint
        config_endpoint = f"{platform_url}/api/mcpserver/config"

        if debug:
            logger.info(f"🔍 [mcp-obs] Fetching server config from {config_endpoint}")

        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                config_endpoint,
                params={"slug": server_slug},
                headers={"User-Agent": "mcp-obs-sdk-python/1.0.0"}
            )

            if response.status_code == 200:
                config = response.json()
                if debug:
                    logger.info(f"✅ [mcp-obs] Server config loaded: support_tool_enabled={config.get('supportToolEnabled', False)}")
                return config
            else:
                if debug:
                    logger.warning(f"❌ [mcp-obs] Failed to fetch server config: {response.status_code}")
                return {}

    except Exception as e:
        if debug:
            logger.error(f"❌ [mcp-obs] Error fetching server config: {e}")
        return {}


def auto_register_support_tool(app: FastMCP, server_config: Dict[str, Any], server_slug: str, platform_url: str, token_verifier: McpObsTokenVerifier = None, debug: bool = False):
    """Automatically register support tool if enabled in server configuration"""

    if not server_config.get('supportToolEnabled', False):
        if debug:
            logger.info("ℹ️ [mcp-obs] Support tool not enabled, skipping registration")
        return

    if debug:
        logger.info("🔧 [mcp-obs] Auto-registering support tool...")

    # Store token verifier on app instance for tool access
    app._mcp_obs_token_verifier = token_verifier

    # Extract configuration
    support_config = SupportToolConfig(
        enabled=True,
        title=server_config.get('supportToolTitle', 'Get Support'),
        description=server_config.get('supportToolDescription', 'Report issues or ask questions'),
        categories=server_config.get('supportToolCategories', ["Bug Report", "Feature Request", "Documentation", "Other"]),
        server_slug=server_slug
    )

    # Create handler
    support_handler = create_support_tool_handler(support_config)

    # Register as FastMCP tool with authentication context
    @app.tool()
    async def get_support_tool(
        title: str,
        description: str,
        category: str = "Other",
        userEmail: str = "",
        ctx: Context[ServerSession, None] = None
    ) -> str:
        """Report issues or ask questions (auto-registered by mcp-obs SDK)"""

        try:
            # Make direct API call to support endpoint with proper authentication
            api_url = f"{platform_url}/api/mcpserver/support"

            # Prepare payload
            payload = {
                "title": title.strip(),
                "description": description.strip(),
                "category": category,
                "toolCall": {
                    "name": "get_support_tool",
                    "arguments": {
                        "title": title,
                        "description": description,
                        "category": category,
                        "userEmail": userEmail
                    },
                    "timestamp": int(time.time() * 1000)
                }
            }

            # Prepare headers
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'mcp-obs-sdk-python/1.0.0'
            }

            # Try to get authentication token from app's stored token verifier
            auth_token = None
            app_token_verifier = getattr(app, '_mcp_obs_token_verifier', None)

            if debug and ctx:
                await ctx.info(f"🔍 [mcp-obs] Looking for TokenVerifier on app instance...")
                await ctx.info(f"🔍 [mcp-obs] TokenVerifier found: {'YES' if app_token_verifier else 'NO'}")

            if app_token_verifier:
                try:
                    auth_token = app_token_verifier.get_current_token()
                    if debug and ctx:
                        await ctx.info(f"🔍 [mcp-obs] TokenVerifier instance: {id(app_token_verifier)}")
                        await ctx.info(f"🔍 [mcp-obs] Current token from TokenVerifier: {'FOUND' if auth_token else 'NOT_FOUND'}")
                        if auth_token:
                            await ctx.info(f"🔍 [mcp-obs] Token preview: {auth_token[:20]}...")
                            await ctx.info("✅ [mcp-obs] Using OAuth token from TokenVerifier for support ticket")
                        else:
                            await ctx.info("⚠️ [mcp-obs] No current token available from TokenVerifier")
                except Exception as e:
                    if debug and ctx:
                        await ctx.info(f"⚠️ [mcp-obs] Error accessing token from TokenVerifier: {e}")
            elif debug and ctx:
                await ctx.info("⚠️ [mcp-obs] No TokenVerifier found on app instance")

            # Add Authorization header if we have a token
            if auth_token:
                headers['Authorization'] = f'Bearer {auth_token}'
            else:
                # Fallback to email if no OAuth token
                if not userEmail:
                    return f"❌ Authentication required or email needed.\n\n" \
                           f"Please provide your email address using the userEmail parameter " \
                           f"so we can follow up on your support request.\n\n" \
                           f"Example: get_support_tool(title='Issue title', description='Issue description', userEmail='your@email.com')"

                # Add email to payload for email-based ticket creation
                payload["userEmail"] = userEmail
                if debug and ctx:
                    await ctx.info(f"ℹ️ [mcp-obs] Using email fallback for support ticket: {userEmail}")

            # Make HTTP request
            if debug and ctx:
                await ctx.info(f"🌐 [mcp-obs] Making API request to: {api_url}")
                await ctx.info(f"🔑 [mcp-obs] Authorization header: {'Bearer ***' if 'Authorization' in headers else 'NONE'}")

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(api_url, json=payload, headers=headers)

                if response.status_code == 201:
                    result = response.json()
                    ticket = result.get('ticket', {})
                    return f"✅ Support ticket created successfully!\n\n" \
                           f"Ticket ID: {ticket.get('id', 'Unknown')}\n" \
                           f"Status: {ticket.get('status', 'open')}\n" \
                           f"Category: {ticket.get('category', category)}\n\n" \
                           f"Your request has been submitted and you should expect a response soon. Thank you for your feedback!"
                elif response.status_code == 400:
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', f'HTTP {response.status_code}: Bad Request')
                    except:
                        error_message = f'HTTP {response.status_code}: Bad Request'

                    # If authentication failed and no email provided, suggest email
                    if 'email' in error_message.lower() and not userEmail:
                        return f"❌ Authentication required or email needed.\n\n" \
                               f"Please provide your email address using the userEmail parameter, or ensure you're authenticated with the MCP server.\n\n" \
                               f"Error: {error_message}"
                    else:
                        return f"❌ Failed to create support ticket: {error_message}"
                else:
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', f'HTTP {response.status_code}: {response.reason_phrase}')
                    except:
                        error_message = f'HTTP {response.status_code}: {response.reason_phrase}'
                    return f"❌ Failed to create support ticket: {error_message}"

        except Exception as e:
            if debug:
                logger.error(f"❌ [mcp-obs] Support tool error: {e}")
            return f"❌ Error creating support ticket: {str(e)}\n\n" \
                   f"Please try again or contact support directly if the problem persists."

    if debug:
        logger.info(f"✅ [mcp-obs] Support tool registered: {support_config.title}")
        logger.info(f"   Categories: {support_config.categories}")
        logger.info(f"   Description: {support_config.description}")


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

    # Auto-register support tool if enabled
    try:
        # Fetch server configuration
        server_config = asyncio.run(fetch_server_config(server_slug, platform_url_with_subdomain, debug))

        # Auto-register support tool
        auto_register_support_tool(app, server_config, server_slug, platform_url_with_subdomain, token_verifier, debug)

    except Exception as e:
        if debug:
            logger.error(f"❌ [mcp-obs] Failed to auto-register support tool: {e}")
        # Continue without support tool - don't fail server startup

    return app