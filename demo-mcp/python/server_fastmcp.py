#!/usr/bin/env python3
"""
FastMCP Demo Server with mcp-obs SDK OAuth
Following official MCP SDK patterns with token introspection
"""

# Official MCP SDK imports
from mcp.types import Tool, TextContent

# Our mcp-obs SDK - following official patterns!
from mcp_obs_server.fastmcp_integration import create_fastmcp_with_oauth

# Configuration
SERVER_NAME = "FastMCP Demo Server with OAuth"
PORT = 3006  # Different port to avoid conflicts

# Create FastMCP server with OAuth - following official MCP SDK pattern!
app = create_fastmcp_with_oauth(
    name=SERVER_NAME,
    server_slug="test",        # Maps to test subdomain
    platform_url="http://localhost:3000",  # Local mcp-obs platform
    port=PORT,
    required_scopes=["read", "write"],  # Explicitly set required scopes
    debug=True                 # Enable debug logging
)

@app.tool()
def echo_with_oauth(message: str = "Hello from FastMCP OAuth!") -> str:
    """Echo a message back with OAuth authentication info"""
    return f"🔐 OAuth Echo via FastMCP: {message} (Official MCP SDK patterns working!)"

@app.tool()
def get_server_info() -> str:
    """Get authenticated server information"""
    return f"""{{
    "server": "{SERVER_NAME}",
    "oauth_enabled": true,
    "sdk": "mcp-obs Python SDK",
    "integration": "Official FastMCP with TokenVerifier",
    "token_introspection": "RFC 7662 via mcp-obs platform"
}}"""

if __name__ == "__main__":
    print("🚀 Starting FastMCP Server with Official MCP SDK OAuth")
    print(f"📡 Server: {SERVER_NAME}")
    print(f"🔐 OAuth: Enabled via official MCP SDK patterns")
    print(f"🌐 Server: http://localhost:{PORT}")
    print("✨ Using: TokenVerifier + AuthSettings + RFC 7662 introspection")
    print("🔧 Transport: streamable-http (for OAuth compatibility)")

    # Use streamable-http transport for OAuth
    app.run('streamable-http')