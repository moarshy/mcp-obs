/**
 * MCP-specific OpenTelemetry semantic conventions
 *
 * These conventions define standardized attribute names for MCP operations
 * following OpenTelemetry semantic conventions pattern.
 */

export const MCPAttributes = {
  // Operation identification
  MCP_OPERATION_TYPE: 'mcp.operation.type', // "tool_call" | "resource_read" | "prompt_get"
  MCP_TOOL_NAME: 'mcp.tool.name',
  MCP_TOOL_INPUT_SIZE: 'mcp.tool.input.size',
  MCP_TOOL_OUTPUT_SIZE: 'mcp.tool.output.size',
  MCP_TOOL_SUCCESS: 'mcp.tool.success',

  // Resource operations
  MCP_RESOURCE_URI: 'mcp.resource.uri',
  MCP_RESOURCE_TYPE: 'mcp.resource.type',
  MCP_RESOURCE_SIZE: 'mcp.resource.size',

  // Prompt operations
  MCP_PROMPT_NAME: 'mcp.prompt.name',
  MCP_PROMPT_ARGS_COUNT: 'mcp.prompt.args.count',

  // Server context
  MCP_SERVER_ID: 'mcp.server.id',
  MCP_SERVER_SLUG: 'mcp.server.slug',
  MCP_SERVER_VERSION: 'mcp.server.version',

  // User context (from OAuth)
  MCP_USER_ID: 'mcp.user.id',
  MCP_USER_EMAIL: 'mcp.user.email',
  MCP_SESSION_ID: 'mcp.session.id',

  // Business context
  MCP_BUSINESS_CONTEXT: 'mcp.business.context', // JSON object

  // Error attributes
  MCP_ERROR_TYPE: 'mcp.error.type',
  MCP_ERROR_MESSAGE: 'mcp.error.message',
} as const

export const MCPOperationType = {
  TOOL_CALL: 'tool_call',
  RESOURCE_READ: 'resource_read',
  RESOURCE_LIST: 'resource_list',
  PROMPT_GET: 'prompt_get',
  PROMPT_LIST: 'prompt_list',
  INITIALIZE: 'initialize',
  PING: 'ping',
} as const

export const MCPSpanNames = {
  TOOL_CALL: 'mcp.tool.call',
  TOOL_VALIDATION: 'mcp.tool.validation',
  TOOL_EXECUTION: 'mcp.tool.execution',
  TOOL_RESPONSE: 'mcp.tool.response',

  RESOURCE_READ: 'mcp.resource.read',
  RESOURCE_FETCH: 'mcp.resource.fetch',
  RESOURCE_SERIALIZE: 'mcp.resource.serialize',
  RESOURCE_LIST: 'mcp.resource.list',

  PROMPT_GET: 'mcp.prompt.get',
  PROMPT_TEMPLATE: 'mcp.prompt.template',
  PROMPT_RENDER: 'mcp.prompt.render',
  PROMPT_LIST: 'mcp.prompt.list',

  INITIALIZE: 'mcp.initialize',
  PING: 'mcp.ping',
} as const

export type MCPAttributeValues = typeof MCPAttributes[keyof typeof MCPAttributes]
export type MCPOperationTypeValues = typeof MCPOperationType[keyof typeof MCPOperationType]
export type MCPSpanNameValues = typeof MCPSpanNames[keyof typeof MCPSpanNames]

/**
 * Standard OpenTelemetry attributes we commonly use
 */
export const StandardAttributes = {
  SERVICE_NAME: 'service.name',
  SERVICE_VERSION: 'service.version',
  HTTP_METHOD: 'http.method',
  HTTP_STATUS_CODE: 'http.status_code',
  HTTP_URL: 'http.url',
  ERROR: 'error',
  ERROR_MESSAGE: 'error.message',
  ERROR_TYPE: 'error.type',
} as const