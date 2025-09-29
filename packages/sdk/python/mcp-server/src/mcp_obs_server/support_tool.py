"""
Support tool registration for MCP servers

This module provides functionality to automatically register a support tool
when enabled in server configuration, allowing end-users to create support
tickets directly through MCP tool calls.
"""

import json
import time
from typing import Any, Dict, List, Optional, Callable, Awaitable
import asyncio
import aiohttp
from pydantic import BaseModel, Field
from .types import OAuthConfig

SUPPORT_TOOL_NAME = "get_support_tool"


class SupportToolConfig(BaseModel):
    """Configuration for support tool registration"""
    enabled: bool = Field(default=False, description="Whether the support tool is enabled")
    title: str = Field(default="Get Support", description="Custom title for the support tool")
    description: str = Field(default="Report issues or ask questions", description="Custom description for the support tool")
    categories: List[str] = Field(
        default_factory=lambda: ["Bug Report", "Feature Request", "Documentation", "Other"],
        description="Available categories for support tickets"
    )
    server_slug: str = Field(default="", description="Server slug for API endpoint routing")
    server_id: Optional[str] = Field(default=None, description="Server ID for API calls")


class SupportToolHandler(BaseModel):
    """Handler for support tool operations"""
    on_list_tools: Callable[[Dict[str, Any], List[Dict[str, Any]]], List[Dict[str, Any]]]
    on_call_tool: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]

    class Config:
        arbitrary_types_allowed = True


def create_support_tool_handler(config: SupportToolConfig) -> SupportToolHandler:
    """Create support tool handler for MCP server integration"""

    if not config.enabled:
        def disabled_list_tools(request: Dict[str, Any], existing_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
            return existing_tools

        async def disabled_call_tool(request: Dict[str, Any]) -> Dict[str, Any]:
            raise Exception("Support tool is not enabled")

        return SupportToolHandler(
            on_list_tools=disabled_list_tools,
            on_call_tool=disabled_call_tool
        )

    # Define the support tool schema
    support_tool = {
        "name": SUPPORT_TOOL_NAME,
        "description": config.description,
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Brief title describing the issue or question",
                    "maxLength": 200
                },
                "description": {
                    "type": "string",
                    "description": "Detailed description of the issue or question",
                    "maxLength": 2000
                },
                "category": {
                    "type": "string",
                    "description": "Category of the support request",
                    "enum": config.categories,
                    "default": "Other"
                }
            },
            "required": ["title", "description"],
            "additionalProperties": False
        }
    }

    # Add email field if needed (always for now since we can't detect OAuth state easily)
    support_tool["inputSchema"]["properties"]["userEmail"] = {
        "type": "string",
        "format": "email",
        "description": "Your email address for follow-up (required for non-authenticated requests)"
    }
    support_tool["inputSchema"]["required"].append("userEmail")

    def list_tools_handler(request: Dict[str, Any], existing_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add support tool to existing tools list"""
        return existing_tools + [support_tool]

    async def call_tool_handler(request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle support tool calls"""
        params = request.get("params", {})

        if params.get("name") != SUPPORT_TOOL_NAME:
            raise Exception(f"Unknown tool: {params.get('name')}")

        try:
            args = params.get("arguments", {})

            # Validate required arguments
            if not args.get("title") or not args.get("description"):
                raise Exception("Title and description are required")

            # Validate argument lengths
            if len(args["title"]) > 200:
                raise Exception("Title must be 200 characters or less")

            if len(args["description"]) > 2000:
                raise Exception("Description must be 2000 characters or less")

            # Prepare API request payload
            payload = {
                "title": args["title"].strip(),
                "description": args["description"].strip(),
                "category": args.get("category", "Other"),
                "toolCall": {
                    "name": params.get("name"),
                    "arguments": args,
                    "timestamp": int(time.time() * 1000)
                }
            }

            if args.get("userEmail"):
                payload["userEmail"] = args["userEmail"]

            # Make API call to create support ticket
            result = await create_support_ticket(config, payload, request)

            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"✅ Support ticket created successfully!\n\n"
                               f"Ticket ID: {result['ticket']['id']}\n"
                               f"Status: {result['ticket']['status']}\n"
                               f"Category: {result['ticket']['category']}\n\n"
                               f"Your request has been submitted and you should expect a response soon. Thank you for your feedback!"
                    }
                ],
                "isError": False
            }

        except Exception as error:
            print(f"Support tool error: {error}")

            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"❌ Failed to create support ticket: {str(error)}\n\n"
                               f"Please try again or contact support directly if the problem persists."
                    }
                ],
                "isError": True
            }

    return SupportToolHandler(
        on_list_tools=list_tools_handler,
        on_call_tool=call_tool_handler
    )


async def create_support_ticket(
    config: SupportToolConfig,
    payload: Dict[str, Any],
    request: Dict[str, Any]
) -> Dict[str, Any]:
    """Make API call to create support ticket"""

    # Determine API endpoint URL
    is_development = 'localhost' in config.server_slug
    if is_development:
        api_url = f"http://{config.server_slug}/api/mcpserver/support"
    else:
        api_url = f"https://{config.server_slug}.mcp-obs.com/api/mcpserver/support"

    # Prepare headers
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'mcp-obs-sdk-python/1.0.0'
    }

    # Try to extract authorization token from request
    auth_token = extract_auth_token(request)
    if auth_token:
        headers['Authorization'] = f'Bearer {auth_token}'

    # Make HTTP request
    async with aiohttp.ClientSession() as session:
        async with session.post(api_url, json=payload, headers=headers) as response:
            if not response.ok:
                try:
                    error_data = await response.json()
                    error_message = error_data.get('error', f'HTTP {response.status}: {response.reason}')
                except:
                    error_message = f'HTTP {response.status}: {response.reason}'
                raise Exception(error_message)

            return await response.json()


def extract_auth_token(request: Dict[str, Any]) -> Optional[str]:
    """Extract auth token from MCP request for API calls"""

    # Try different locations where auth token might be stored
    headers = request.get('headers', {})
    metadata = request.get('metadata', {})
    authorization = request.get('authorization')

    # Check HTTP headers
    if 'authorization' in headers:
        return extract_bearer_token(headers['authorization'])
    if 'Authorization' in headers:
        return extract_bearer_token(headers['Authorization'])

    # Check MCP metadata
    if 'authorization' in metadata:
        return extract_bearer_token(metadata['authorization'])
    if 'Authorization' in metadata:
        return extract_bearer_token(metadata['Authorization'])

    # Check direct authorization field
    if authorization:
        return extract_bearer_token(authorization)

    return None


def extract_bearer_token(auth_header: str) -> Optional[str]:
    """Extract Bearer token from authorization header"""
    if isinstance(auth_header, str) and auth_header.startswith('Bearer '):
        return auth_header[7:]  # Remove 'Bearer ' prefix
    return None


async def register_support_tool(server: Any, config: SupportToolConfig) -> None:
    """
    Register support tool with an MCP Server instance

    Args:
        server: MCP Server instance (duck-typed)
        config: Support tool configuration
    """
    if not config.enabled:
        return  # Support tool is disabled

    handler = create_support_tool_handler(config)

    # Store original handlers
    original_list_tools = getattr(server, 'list_tools', None)
    original_call_tool = getattr(server, 'call_tool', None)

    # Override list tools to include support tool
    async def enhanced_list_tools(request: Dict[str, Any]) -> Dict[str, Any]:
        existing_result = {"tools": []}
        if original_list_tools:
            if asyncio.iscoroutinefunction(original_list_tools):
                existing_result = await original_list_tools(request)
            else:
                existing_result = original_list_tools(request)

        existing_tools = existing_result.get("tools", [])
        enhanced_tools = handler.on_list_tools(request, existing_tools)

        return {"tools": enhanced_tools}

    # Override call tool to handle support tool
    async def enhanced_call_tool(request: Dict[str, Any]) -> Dict[str, Any]:
        params = request.get("params", {})

        if params.get("name") == SUPPORT_TOOL_NAME:
            return await handler.on_call_tool(request)

        if original_call_tool:
            if asyncio.iscoroutinefunction(original_call_tool):
                return await original_call_tool(request)
            else:
                return original_call_tool(request)

        raise Exception(f"Unknown tool: {params.get('name')}")

    # Set the enhanced handlers
    server.list_tools = enhanced_list_tools
    server.call_tool = enhanced_call_tool


async def configure_oauth_mcp_server(server: Any, config: Dict[str, Any]) -> None:
    """
    Configure MCP server with OAuth middleware and optional support tool

    This is the main integration function that sets up both authentication and support

    Args:
        server: MCP Server instance
        config: Configuration dictionary including OAuth and support tool settings
    """
    from .oauth_middleware import configure_oauth_validator

    # Configure OAuth validator
    configure_oauth_validator(config)

    # Register support tool if enabled
    support_tool_config = config.get('support_tool', {})
    if support_tool_config.get('enabled', False):
        support_config = SupportToolConfig(
            enabled=True,
            title=support_tool_config.get('title'),
            description=support_tool_config.get('description'),
            categories=support_tool_config.get('categories'),
            server_slug=config.get('server_slug', ''),
            server_id=config.get('server_id')
        )

        await register_support_tool(server, support_config)

        # Add support tool to skip validation list if not already there
        skip_validation = config.get('skip_validation_for', [])
        if SUPPORT_TOOL_NAME not in skip_validation:
            config['skip_validation_for'] = skip_validation + [SUPPORT_TOOL_NAME]

    print('✅ MCP Server configured with OAuth middleware' +
          (' and support tool' if support_tool_config.get('enabled') else ''))