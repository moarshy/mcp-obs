"""
MCP-specific OpenTelemetry semantic conventions

These conventions define standardized attribute names for MCP operations
following OpenTelemetry semantic conventions pattern.
"""

from typing import Final


class MCPAttributes:
    """MCP-specific OpenTelemetry attribute names"""

    # Operation identification
    MCP_OPERATION_TYPE: Final[str] = "mcp.operation.type"
    MCP_TOOL_NAME: Final[str] = "mcp.tool.name"
    MCP_TOOL_INPUT_SIZE: Final[str] = "mcp.tool.input.size"
    MCP_TOOL_OUTPUT_SIZE: Final[str] = "mcp.tool.output.size"
    MCP_TOOL_SUCCESS: Final[str] = "mcp.tool.success"

    # Resource operations
    MCP_RESOURCE_URI: Final[str] = "mcp.resource.uri"
    MCP_RESOURCE_TYPE: Final[str] = "mcp.resource.type"
    MCP_RESOURCE_SIZE: Final[str] = "mcp.resource.size"

    # Prompt operations
    MCP_PROMPT_NAME: Final[str] = "mcp.prompt.name"
    MCP_PROMPT_ARGS_COUNT: Final[str] = "mcp.prompt.args.count"

    # Server context
    MCP_SERVER_ID: Final[str] = "mcp.server.id"
    MCP_SERVER_SLUG: Final[str] = "mcp.server.slug"
    MCP_SERVER_VERSION: Final[str] = "mcp.server.version"

    # User context (from OAuth)
    MCP_USER_ID: Final[str] = "mcp.user.id"
    MCP_USER_EMAIL: Final[str] = "mcp.user.email"
    MCP_SESSION_ID: Final[str] = "mcp.session.id"

    # Business context
    MCP_BUSINESS_CONTEXT: Final[str] = "mcp.business.context"

    # Error attributes
    MCP_ERROR_TYPE: Final[str] = "mcp.error.type"
    MCP_ERROR_MESSAGE: Final[str] = "mcp.error.message"


class MCPOperationType:
    """MCP operation type constants"""

    TOOL_CALL: Final[str] = "tool_call"
    RESOURCE_READ: Final[str] = "resource_read"
    RESOURCE_LIST: Final[str] = "resource_list"
    PROMPT_GET: Final[str] = "prompt_get"
    PROMPT_LIST: Final[str] = "prompt_list"
    INITIALIZE: Final[str] = "initialize"
    PING: Final[str] = "ping"


class MCPSpanNames:
    """Standard span names for MCP operations"""

    TOOL_CALL: Final[str] = "mcp.tool.call"
    TOOL_VALIDATION: Final[str] = "mcp.tool.validation"
    TOOL_EXECUTION: Final[str] = "mcp.tool.execution"
    TOOL_RESPONSE: Final[str] = "mcp.tool.response"

    RESOURCE_READ: Final[str] = "mcp.resource.read"
    RESOURCE_FETCH: Final[str] = "mcp.resource.fetch"
    RESOURCE_SERIALIZE: Final[str] = "mcp.resource.serialize"
    RESOURCE_LIST: Final[str] = "mcp.resource.list"

    PROMPT_GET: Final[str] = "mcp.prompt.get"
    PROMPT_TEMPLATE: Final[str] = "mcp.prompt.template"
    PROMPT_RENDER: Final[str] = "mcp.prompt.render"
    PROMPT_LIST: Final[str] = "mcp.prompt.list"

    INITIALIZE: Final[str] = "mcp.initialize"
    PING: Final[str] = "mcp.ping"


class StandardAttributes:
    """Standard OpenTelemetry attributes we commonly use"""

    SERVICE_NAME: Final[str] = "service.name"
    SERVICE_VERSION: Final[str] = "service.version"
    HTTP_METHOD: Final[str] = "http.method"
    HTTP_STATUS_CODE: Final[str] = "http.status_code"
    HTTP_URL: Final[str] = "http.url"
    ERROR: Final[str] = "error"
    ERROR_MESSAGE: Final[str] = "error.message"
    ERROR_TYPE: Final[str] = "error.type"