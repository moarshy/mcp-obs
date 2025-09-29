#!/usr/bin/env python3
"""
Minimal MCP Python Server with mcp-obs SDK OAuth
Following TypeScript architecture: minimal server, maximum SDK integration
"""

import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Official MCP SDK imports
from mcp.server.lowlevel import Server
from mcp.types import Tool, TextContent, CallToolResult, ListToolsResult

# Our mcp-obs SDK - this does all the heavy lifting!
from mcp_obs_server import McpObsSDK
from mcp_obs_server.support_tool import create_support_tool_handler, SupportTicketRequest

# Configuration - matches TypeScript demo exactly
SERVER_NAME = "Demo MCP Python Server with OAuth"
SERVER_VERSION = "1.0.0"
PORT = 3005

# Initialize mcp-obs SDK - just like TypeScript version
mcp_obs = McpObsSDK({
    "serverName": SERVER_NAME,
    "version": SERVER_VERSION,
    "oauthConfig": {
        "serverSlug": "test",        # Maps to test subdomain
        "platformUrl": "http://localhost:3000",  # Local mcp-obs platform
        "debug": True                # Enable debug logging
    }
})

# Global variables to store OAuth adapter
oauth_adapter = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan manager - initialize SDK and OAuth"""
    global oauth_adapter

    # Initialize mcp-obs SDK
    await mcp_obs.initialize()

    # Create OAuth middleware for HTTP transport - SDK handles everything!
    oauth_adapter = await mcp_obs.create_oauth_middleware('http')

    # Create OAuth proxy endpoints - SDK magic!
    print('🔧 Creating OAuth proxy endpoints...')
    if hasattr(oauth_adapter, 'create_oauth_proxy_endpoints'):
        oauth_adapter.create_oauth_proxy_endpoints(app)
        print('✅ OAuth proxy endpoints created by SDK')
    else:
        print('❌ OAuth adapter missing createOAuthProxyEndpoints method')

    yield  # Server runs here

    print('🛑 Shutting down...')


# Create FastAPI app
app = FastAPI(title=SERVER_NAME, lifespan=lifespan)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create MCP server instance
mcp_server = Server(SERVER_NAME, version=SERVER_VERSION)

# Create support tool handler
support_tool_handler = create_support_tool_handler({
    "title": "Get Demo Support",
    "description": "Report issues or ask questions about the demo MCP server",
    "categories": ["Bug Report", "Feature Request", "Demo Question", "Other"]
})

# Register MCP tools
@mcp_server.list_tools()
async def list_tools() -> ListToolsResult:
    return ListToolsResult(
        tools=[
            Tool(
                name="echo",
                description="Echo a message back with OAuth authentication info",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "message": {
                            "type": "string",
                            "description": "Message to echo back",
                            "default": "Hello from OAuth Python MCP!"
                        }
                    },
                }
            ),
            Tool(
                name="get_user_info",
                description="Get authenticated user information",
                inputSchema={
                    "type": "object",
                    "properties": {},
                }
            ),
            support_tool_handler.tool_definition
        ]
    )

@mcp_server.call_tool()
async def call_tool(name: str, arguments: dict) -> CallToolResult:
    if name == "echo":
        message = arguments.get("message", "Hello from OAuth Python MCP!")
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=f"🔐 OAuth Echo: {message} (Python SDK integration working!)"
                )
            ]
        )
    elif name == "get_user_info":
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=json.dumps({
                        "server": SERVER_NAME,
                        "version": SERVER_VERSION,
                        "oauth_enabled": True,
                        "sdk": "mcp-obs Python SDK",
                        "note": "User info available via request.state.auth_context"
                    }, indent=2)
                )
            ]
        )
    elif name == support_tool_handler.tool_name:
        # Handle support ticket creation
        ticket_request = SupportTicketRequest(**arguments)
        result = await support_tool_handler.handle_call(ticket_request)
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=result
                )
            ]
        )
    else:
        raise ValueError(f"Unknown tool: {name}")

# Health check endpoint (public)
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": SERVER_NAME,
        "oauth": {"enabled": True, "server_slug": "test"},
        "sdk": "mcp-obs Python SDK"
    }

# Main MCP endpoint with OAuth middleware from SDK
@app.post("/mcp")
async def mcp_endpoint(request: Request):
    """Main MCP endpoint - OAuth handled by SDK middleware!"""

    # OAuth validation is handled by SDK middleware in the future
    # For now, we manually call the middleware
    if oauth_adapter and hasattr(oauth_adapter, 'express_middleware'):
        middleware = oauth_adapter.express_middleware()
        auth_context = await middleware(request)

        if auth_context:
            # Track authenticated usage
            body = await request.json()
            if body.get("method") == "tools/call":
                tool_name = body.get("params", {}).get("name")
                await mcp_obs.track_authenticated_tool_usage(
                    tool_name,
                    auth_context,
                    {"transport": "http"}
                )

    # Handle MCP requests
    body = await request.json()

    if body.get("method") == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": body.get("id"),
            "result": {
                "protocolVersion": "2025-03-26",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION}
            }
        }
    elif body.get("method") == "tools/list":
        tools_result = await list_tools()
        return {
            "jsonrpc": "2.0",
            "id": body.get("id"),
            "result": {"tools": [tool.model_dump() for tool in tools_result.tools]}
        }
    elif body.get("method") == "tools/call":
        params = body.get("params", {})
        try:
            tool_result = await call_tool(params.get("name"), params.get("arguments", {}))
            return {
                "jsonrpc": "2.0",
                "id": body.get("id"),
                "result": {"content": [content.model_dump() for content in tool_result.content]}
            }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": body.get("id"),
                "error": {"code": -32000, "message": str(e)}
            }
    else:
        return {
            "jsonrpc": "2.0",
            "id": body.get("id"),
            "error": {"code": -32601, "message": f"Method not found: {body.get('method')}"}
        }


if __name__ == "__main__":
    print("🚀 Starting Minimal Python MCP Server with mcp-obs SDK")
    print(f"📡 Server: {SERVER_NAME}")
    print(f"🔐 OAuth: Enabled via mcp-obs SDK")
    print(f"🌐 Server: http://localhost:{PORT}")
    print("✨ SDK handles: OAuth proxy endpoints, token validation, middleware")

    uvicorn.run(app, host="0.0.0.0", port=PORT)