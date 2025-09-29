/**
 * Support tool registration for MCP servers
 * Automatically registers a support tool when enabled in server configuration
 */

import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  Tool
} from "@modelcontextprotocol/sdk/types.js";

export interface SupportToolConfig {
  /** Whether the support tool is enabled */
  enabled: boolean;
  /** Custom title for the support tool */
  title?: string;
  /** Custom description for the support tool */
  description?: string;
  /** Available categories for support tickets */
  categories?: string[];
  /** Server slug for API endpoint routing */
  serverSlug: string;
  /** Server ID for API calls */
  serverId?: string;
}

export interface SupportToolHandler {
  /** List tools handler - adds support tool to available tools */
  onListTools: (request: ListToolsRequest, existingTools: Tool[]) => Tool[];
  /** Call tool handler - handles support tool calls */
  onCallTool: (request: CallToolRequest) => Promise<CallToolResult>;
}

const SUPPORT_TOOL_NAME = 'get_support_tool';

/**
 * Create support tool handler for MCP server integration
 */
export function createSupportToolHandler(config: SupportToolConfig): SupportToolHandler {
  if (!config.enabled) {
    return {
      onListTools: (request: ListToolsRequest, existingTools: Tool[]) => existingTools,
      onCallTool: async (request: CallToolRequest) => {
        throw new Error('Support tool is not enabled');
      }
    };
  }

  const supportTool: Tool = {
    name: SUPPORT_TOOL_NAME,
    description: config.description || 'Report issues or ask questions',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Brief title describing the issue or question',
          maxLength: 200
        },
        description: {
          type: 'string',
          description: 'Detailed description of the issue or question',
          maxLength: 2000
        },
        category: {
          type: 'string',
          description: 'Category of the support request',
          enum: config.categories || ['Bug Report', 'Feature Request', 'Documentation', 'Other'],
          default: 'Other'
        },
        ...(needsEmailCollection(config) && {
          userEmail: {
            type: 'string',
            format: 'email',
            description: 'Your email address for follow-up (required for non-authenticated requests)'
          }
        })
      },
      required: ['title', 'description', ...(needsEmailCollection(config) ? ['userEmail'] : [])],
      additionalProperties: false
    }
  };

  return {
    onListTools: (request: ListToolsRequest, existingTools: Tool[]): Tool[] => {
      // Add support tool to existing tools list
      return [...existingTools, supportTool];
    },

    onCallTool: async (request: CallToolRequest): Promise<CallToolResult> => {
      if (request.params.name !== SUPPORT_TOOL_NAME) {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }

      try {
        const args = request.params.arguments as any;

        // Validate required arguments
        if (!args.title || !args.description) {
          throw new Error('Title and description are required');
        }

        // Validate argument lengths
        if (args.title.length > 200) {
          throw new Error('Title must be 200 characters or less');
        }

        if (args.description.length > 2000) {
          throw new Error('Description must be 2000 characters or less');
        }

        // Prepare API request payload
        const payload = {
          title: args.title.trim(),
          description: args.description.trim(),
          category: args.category || 'Other',
          ...(args.userEmail && { userEmail: args.userEmail }),
          toolCall: {
            name: request.params.name,
            arguments: args,
            timestamp: Date.now()
          }
        };

        // Make API call to mcp-obs platform
        const result = await createSupportTicket(config, payload, request);

        return {
          content: [
            {
              type: 'text',
              text: `✅ Support ticket created successfully!\n\nTicket ID: ${result.ticket.id}\nStatus: ${result.ticket.status}\nCategory: ${result.ticket.category}\n\nYour request has been submitted and you should expect a response soon. Thank you for your feedback!`
            }
          ],
          isError: false
        };

      } catch (error) {
        console.error('Support tool error:', error);

        return {
          content: [
            {
              type: 'text',
              text: `❌ Failed to create support ticket: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support directly if the problem persists.`
            }
          ],
          isError: true
        };
      }
    }
  };
}

/**
 * Check if the tool needs to collect email addresses
 * (when server doesn't use OAuth authentication)
 */
function needsEmailCollection(config: SupportToolConfig): boolean {
  // For now, assume email is always needed since we can't detect OAuth state
  // In practice, this could be configured based on server's OAuth settings
  return true;
}

/**
 * Make API call to create support ticket
 */
async function createSupportTicket(
  config: SupportToolConfig,
  payload: any,
  request: CallToolRequest
): Promise<any> {
  // Determine API endpoint URL
  const isDevelopment = config.serverSlug.includes('localhost');
  const apiUrl = isDevelopment
    ? `http://${config.serverSlug}/api/mcpserver/support`
    : `https://${config.serverSlug}.mcp-obs.com/api/mcpserver/support`;

  // Extract authorization token from request if available
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'mcp-obs-sdk-typescript/1.0.0'
  };

  // Try to extract authorization token from request
  const authToken = extractAuthToken(request);
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Make HTTP request
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Extract auth token from MCP request for API calls
 */
function extractAuthToken(request: CallToolRequest): string | null {
  // Try different locations where auth token might be stored
  const headers = (request as any).headers;
  const metadata = (request as any).metadata;
  const authorization = (request as any).authorization;

  // Check HTTP headers
  if (headers?.authorization) {
    return extractBearerToken(headers.authorization);
  }
  if (headers?.Authorization) {
    return extractBearerToken(headers.Authorization);
  }

  // Check MCP metadata
  if (metadata?.authorization) {
    return extractBearerToken(metadata.authorization);
  }
  if (metadata?.Authorization) {
    return extractBearerToken(metadata.Authorization);
  }

  // Check direct authorization field
  if (authorization) {
    return extractBearerToken(authorization);
  }

  return null;
}

/**
 * Extract Bearer token from authorization header
 */
function extractBearerToken(authHeader: string): string | null {
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7); // Remove 'Bearer ' prefix
  }
  return null;
}

/**
 * Fetch server configuration from mcp-obs platform
 */
async function fetchServerConfig(serverSlug: string, platformUrl: string): Promise<any> {
  try {
    const configEndpoint = `${platformUrl}/api/mcpserver/config`;
    const response = await fetch(`${configEndpoint}?slug=${serverSlug}`, {
      headers: {
        'User-Agent': 'mcp-obs-sdk-typescript/1.0.0'
      }
    });

    if (response.ok) {
      return response.json();
    } else {
      console.warn(`Failed to fetch server config: ${response.status}`);
      return {};
    }
  } catch (error) {
    console.error('Error fetching server config:', error);
    return {};
  }
}

/**
 * Automatically register support tool if enabled in server configuration
 * This is called by SDK integrations to provide zero-configuration support tools
 */
export async function autoRegisterSupportTool(
  server: any, // MCP Server instance
  serverSlug: string,
  platformUrl: string,
  debug: boolean = false
): Promise<void> {
  try {
    // Fetch server configuration
    const serverConfig = await fetchServerConfig(serverSlug, platformUrl);

    if (!serverConfig.supportToolEnabled) {
      if (debug) {
        console.log('ℹ️ [mcp-obs] Support tool not enabled, skipping registration');
      }
      return;
    }

    if (debug) {
      console.log('🔧 [mcp-obs] Auto-registering support tool...');
    }

    // Create configuration from server settings
    const config: SupportToolConfig = {
      enabled: true,
      title: serverConfig.supportToolTitle || 'Get Support',
      description: serverConfig.supportToolDescription || 'Report issues or ask questions',
      categories: serverConfig.supportToolCategories || ['Bug Report', 'Feature Request', 'Documentation', 'Other'],
      serverSlug: serverSlug
    };

    // Register the support tool
    await registerSupportTool(server, config);

    if (debug) {
      console.log(`✅ [mcp-obs] Support tool registered: ${config.title}`);
      console.log(`   Categories: ${config.categories}`);
      console.log(`   Description: ${config.description}`);
    }

  } catch (error) {
    if (debug) {
      console.error('❌ [mcp-obs] Failed to auto-register support tool:', error);
    }
    // Continue without support tool - don't fail server startup
  }
}

/**
 * Utility function to register support tool with an MCP Server instance
 */
export async function registerSupportTool(
  server: any, // MCP Server instance
  config: SupportToolConfig
): Promise<void> {
  if (!config.enabled) {
    return; // Support tool is disabled
  }

  const handler = createSupportToolHandler(config);

  // Store original handlers
  const originalListTools = server.listTools;
  const originalCallTool = server.callTool;

  // Override list tools to include support tool
  server.listTools = async (request: ListToolsRequest) => {
    const existingTools = originalListTools ? await originalListTools.call(server, request) : [];
    const toolsArray = existingTools.tools || [];
    const enhancedTools = handler.onListTools(request, toolsArray);

    return {
      tools: enhancedTools
    };
  };

  // Override call tool to handle support tool
  server.callTool = async (request: CallToolRequest) => {
    if (request.params.name === SUPPORT_TOOL_NAME) {
      return handler.onCallTool(request);
    }

    if (originalCallTool) {
      return originalCallTool.call(server, request);
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  };
}