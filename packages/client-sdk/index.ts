/**
 * mcp-obs Client SDK
 *
 * This SDK provides utilities for frontend applications to interact with
 * mcp-obs APIs and services.
 */

export interface MCPClientConfig {
  apiUrl: string
  organizationId?: string
  apiKey?: string
}

export class McpObsClient {
  private config: MCPClientConfig

  constructor(config: MCPClientConfig) {
    this.config = config
  }

  /**
   * Get server analytics and metrics
   */
  async getServerAnalytics(serverId: string, timeRange?: string): Promise<any> {
    // Analytics fetching logic will be implemented here
    console.log(`Fetching analytics for server: ${serverId}`, { timeRange })
    return {
      serverId,
      metrics: {},
      timeRange: timeRange || '24h'
    }
  }

  /**
   * List MCP servers for the organization
   */
  async listServers(): Promise<any[]> {
    // Server listing logic will be implemented here
    console.log('Fetching server list for organization:', this.config.organizationId)
    return []
  }

  /**
   * Get server details by ID
   */
  async getServer(serverId: string): Promise<any> {
    // Server details fetching logic will be implemented here
    console.log(`Fetching server details: ${serverId}`)
    return { id: serverId }
  }
}

// Export main client class and types
export default McpObsClient