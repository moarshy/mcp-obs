"""
MCP Demo Server with FastMCP and OAuth Authentication
Uses mcp-obs Python SDK for OAuth integration
"""
import asyncio
from typing import Any, Dict
from contextvars import ContextVar

from fastmcp import FastMCP
from pydantic import BaseModel

# Import our simplified mcp-obs authentication
from mcp_obs_server import create_mcp_obs_auth

# Create OAuth authentication provider - this is all you need!
auth = create_mcp_obs_auth(
    server_slug="test",  # Server slug for mcp-obs platform
    platform_url="http://localhost:3000",  # mcp-obs platform URL
    base_url="http://localhost:3005",  # This server's URL
    debug=True
)

# Create FastMCP app with OAuth authentication
mcp = FastMCP("Demo MCP Python Server with OAuth", auth=auth)


class CalculateInput(BaseModel):
    """Input for calculate tool"""
    expression: str

class WeatherInput(BaseModel):
    """Input for weather tool"""
    location: str

class TaskInput(BaseModel):
    """Input for task creation"""
    description: str

@mcp.tool()
def get_server_info() -> Dict[str, Any]:
    """Get information about the server and authenticated user"""
    return {
        "server_name": "Demo MCP Python Server",
        "version": "1.0.0",
        "transport": "HTTP with OAuth via FastMCP",
        "oauth_platform": "http://localhost:3000",
        "server_slug": "test",
        "note": "🔐 This tool is now protected by OAuth! Authentication handled by FastMCP + mcp-obs SDK"
    }

@mcp.tool()
def calculate(expression: str) -> Dict[str, Any]:
    """Calculate a mathematical expression (authenticated)"""
    try:
        # Simple evaluation - in production, use a proper math parser
        result = eval(expression)  # Note: Don't use eval in production!
        return {
            "expression": expression,
            "result": result,
            "note": "🔐 Calculated via OAuth-protected FastMCP server"
        }
    except Exception as e:
        return {
            "error": str(e),
            "expression": expression
        }

@mcp.tool()
def get_weather(location: str) -> Dict[str, str]:
    """Get weather information for a location (authenticated)"""
    # Mock weather data
    return {
        "location": location,
        "temperature": "22°C",
        "condition": "Sunny",
        "humidity": "65%",
        "note": "🔐 Weather data retrieved via OAuth-protected FastMCP server"
    }

@mcp.tool()
def create_task(description: str) -> Dict[str, Any]:
    """Create a new task (authenticated)"""
    import time

    return {
        "id": f"task_{int(time.time())}",
        "description": description,
        "status": "pending",
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "note": "🔐 Task created via OAuth-protected FastMCP server"
    }

@mcp.tool()
def get_user_profile() -> Dict[str, Any]:
    """Get user profile information"""
    return {
        "note": "🔐 User profile via OAuth-protected FastMCP server",
        "status": "OAuth authentication working via FastMCP + mcp-obs SDK integration!"
    }


# No additional app creation needed - FastMCP handles everything!
# The OAuth integration is completely handled by the auth parameter above

if __name__ == "__main__":
    print("🚀 Starting Demo MCP Python Server with OAuth")
    print("📡 Server slug: test")
    print("🔐 OAuth platform: http://localhost:3000")
    print("🌐 Server will run on http://localhost:3005")
    print("📋 Available tools:")
    print("  - get_server_info: Get server and user information")
    print("  - calculate: Calculate mathematical expressions")
    print("  - get_weather: Get weather information")
    print("  - create_task: Create a new task")
    print("  - get_user_profile: Get user profile information")
    print()
    print("🔑 All requests require valid Bearer tokens from http://localhost:3000")
    print("✨ OAuth integration via FastMCP + mcp-obs SDK - just a few lines of code!")

    # Use FastMCP's built-in server
    mcp.run(transport="http", host="0.0.0.0", port=3005)