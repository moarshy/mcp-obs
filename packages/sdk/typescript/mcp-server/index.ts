/**
 * mcp-obs Server SDK
 *
 * This SDK provides utilities for MCP servers to integrate with mcp-obs
 * for observability, analytics, OAuth authentication, and management.
 */

// OAuth exports
export * from "./src/oauth-validator.js";
export * from "./src/oauth-middleware.js";
export * from "./src/transport-adapters.js";

// Support tool exports
export * from "./src/support-tool.js";

export interface MCPServerConfig {
  serverName: string
  version: string
  platformUrl?: string
  apiKey?: string
  /** OAuth configuration for server authentication */
  oauthConfig?: {
    serverSlug: string
    platformUrl?: string // Override default platform URL
    requiredScopes?: string[]
    skipValidationFor?: string[]
    debug?: boolean
  }
}

export class McpObsSDK {
  private config: MCPServerConfig

  constructor(config: MCPServerConfig) {
    this.config = config
  }

  /**
   * Initialize the SDK connection to mcp-obs
   */
  async initialize(): Promise<void> {
    // SDK initialization logic will be implemented here
    console.log(`mcp-obs SDK initialized for server: ${this.config.serverName}`)

    if (this.config.oauthConfig) {
      console.log(`OAuth enabled for server slug: ${this.config.oauthConfig.serverSlug}`)
    }
  }

  /**
   * Report server status to mcp-obs
   */
  async reportStatus(status: 'healthy' | 'degraded' | 'down'): Promise<void> {
    // Status reporting logic will be implemented here
    console.log(`Server ${this.config.serverName} status: ${status}`)
  }

  /**
   * Track tool usage analytics
   */
  async trackToolUsage(toolName: string, metadata?: Record<string, any>): Promise<void> {
    // Tool usage tracking will be implemented here
    console.log(`Tool usage tracked: ${toolName}`, metadata)
  }

  /**
   * Track authenticated tool usage with user context
   */
  async trackAuthenticatedToolUsage(
    toolName: string,
    authContext: { userId: string; email: string; scopes: string[] },
    metadata?: Record<string, any>
  ): Promise<void> {
    // Authenticated tool usage tracking will be implemented here
    console.log(`Authenticated tool usage tracked: ${toolName}`, {
      user: authContext.userId,
      email: authContext.email,
      scopes: authContext.scopes,
      ...metadata
    })
  }

  /**
   * Create OAuth middleware for MCP request handlers
   */
  async createOAuthMiddleware(transportType: 'stdio' | 'http' | 'streamable-http' = 'stdio') {
    if (!this.config.oauthConfig) {
      throw new Error('OAuth configuration required to create OAuth middleware')
    }

    const { createOAuthAdapter, createOAuthConfig } = await import("./src/transport-adapters.js");

    const oauthConfig = createOAuthConfig(this.config.oauthConfig.serverSlug, {
      requiredScopes: this.config.oauthConfig.requiredScopes,
      skipValidationFor: this.config.oauthConfig.skipValidationFor,
      debug: this.config.oauthConfig.debug,
      platformUrl: this.config.oauthConfig.platformUrl
    });

    return createOAuthAdapter(transportType, oauthConfig);
  }

  /**
   * Validate an OAuth token directly
   */
  async validateToken(token: string): Promise<import("./src/oauth-validator.js").AuthContext | null> {
    if (!this.config.oauthConfig) {
      throw new Error('OAuth configuration required for token validation')
    }

    const { OAuthTokenValidator } = await import("./src/oauth-validator.js");
    const { createOAuthConfig } = await import("./src/transport-adapters.js");

    const oauthConfig = createOAuthConfig(this.config.oauthConfig.serverSlug, {
      debug: this.config.oauthConfig.debug,
      platformUrl: this.config.oauthConfig.platformUrl
    });

    const validator = new OAuthTokenValidator(oauthConfig);
    return validator.validateToken(token);
  }
}

// Export main SDK class and types
export default McpObsSDK