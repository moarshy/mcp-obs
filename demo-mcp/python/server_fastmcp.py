#!/usr/bin/env python3
"""
FastMCP Demo Server with mcp-obs SDK OAuth and OpenTelemetry
Following official MCP SDK patterns with token introspection and telemetry
"""
import os
from dotenv import load_dotenv
load_dotenv()

# Official MCP SDK imports
from mcp.types import Tool, TextContent

# Our mcp-obs SDK - following official patterns!
from mcp_obs_server.fastmcp_integration import create_fastmcp_with_oauth
from mcp_obs_server.telemetry import setup_simple_telemetry

# Configuration
SERVER_NAME = "FastMCP Demo Server with OAuth and Telemetry"
PORT = 3006  # Different port to avoid conflicts

# Telemetry configuration - replace with your actual API key
TELEMETRY_API_KEY = os.getenv("MCP_OBS_TELEMETRY_KEY")
TELEMETRY_ENABLED = True  # Set to False to disable telemetry

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
    """Echo a message back with OAuth authentication info (basic version)"""
    return f"🔐 OAuth Echo via FastMCP: {message} (Official MCP SDK patterns working!)"

@app.tool()
def get_server_info() -> str:
    """Get authenticated server information with telemetry status"""
    telemetry_status = telemetry_handles is not None if 'telemetry_handles' in globals() else False
    return f"""{{
    "server": "{SERVER_NAME}",
    "oauth_enabled": true,
    "telemetry_enabled": {str(telemetry_status).lower()},
    "sdk": "mcp-obs Python SDK",
    "integration": "Official FastMCP with TokenVerifier + OpenTelemetry",
    "token_introspection": "RFC 7662 via mcp-obs platform",
    "telemetry_export": "OTLP via mcp-obs platform"
}}"""

# Support tool will be auto-registered by the SDK if enabled in dashboard!

# Initialize telemetry if enabled
telemetry_handles = None
if TELEMETRY_ENABLED and TELEMETRY_API_KEY:
    import asyncio
    print("🔍 [mcp-obs] Initializing OpenTelemetry...")

    try:
        # Setup telemetry with the server instance
        telemetry_handles = asyncio.run(setup_simple_telemetry(
            server_slug="test",  # Should match your MCP server slug
            api_key=TELEMETRY_API_KEY,
            server=app,
            endpoint="http://localhost:3000/api/otel/traces",  # Local mcp-obs platform
            service_name=SERVER_NAME,
            service_version="1.0.0",
            debug=True
        ))
        print("✅ [mcp-obs] OpenTelemetry initialized successfully!")
    except Exception as e:
        print(f"⚠️ [mcp-obs] Failed to initialize telemetry: {e}")
        print("🚀 [mcp-obs] Continuing without telemetry...")
        telemetry_handles = None

@app.tool()
def echo_with_oauth_and_telemetry(message: str = "Hello from FastMCP OAuth!") -> str:
    """Echo a message back with OAuth authentication and telemetry info"""
    telemetry_status = "✅ Enabled" if telemetry_handles else "❌ Disabled"
    return f"🔐 OAuth Echo via FastMCP: {message}\n📊 Telemetry: {telemetry_status}\n✨ (Official MCP SDK patterns working!)"

if __name__ == "__main__":
    print("🚀 Starting FastMCP Server with Official MCP SDK OAuth + OpenTelemetry")
    print(f"📡 Server: {SERVER_NAME}")
    print(f"🔐 OAuth: Enabled via official MCP SDK patterns")
    print(f"📊 Telemetry: {'Enabled' if TELEMETRY_ENABLED and TELEMETRY_API_KEY else 'Disabled'}")
    print(f"🌐 Server: http://localhost:{PORT}")
    print("✨ Using: TokenVerifier + AuthSettings + RFC 7662 introspection")
    print("📈 Using: OpenTelemetry auto-instrumentation + OTLP export")
    print("🔧 Transport: streamable-http (for OAuth + telemetry compatibility)")

    try:
        # Use streamable-http transport for OAuth
        app.run('streamable-http')
    finally:
        # Cleanup telemetry on shutdown
        if telemetry_handles:
            print("🔄 [mcp-obs] Shutting down telemetry...")
            try:
                telemetry_handles["shutdown"]()
                print("✅ [mcp-obs] Telemetry shutdown complete")
            except Exception as e:
                print(f"⚠️ [mcp-obs] Error during telemetry shutdown: {e}")