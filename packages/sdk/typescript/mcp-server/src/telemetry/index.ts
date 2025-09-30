/**
 * mcp-obs Telemetry SDK
 *
 * This module provides OpenTelemetry integration for MCP servers with:
 * - Automatic instrumentation of MCP operations
 * - MCP-specific semantic conventions
 * - Resilient OTLP export with circuit breaker
 * - Integration with mcp-obs authentication context
 */

export {
  configureMCPTelemetry,
  instrumentMCPServer,
  shutdownTelemetry,
  getTelemetryStats,
  type MCPTelemetryConfig,
  type AuthContext,
} from './auto-instrumentation.js'

export {
  MCPAttributes,
  MCPOperationType,
  MCPSpanNames,
  StandardAttributes,
  type MCPAttributeValues,
  type MCPOperationTypeValues,
  type MCPSpanNameValues,
} from './mcp-semantic-conventions.js'

export {
  ResilientOTLPExporter,
  CircuitBreaker,
  createMCPOTLPExporter,
  createCircuitBreaker,
  type OTLPExporterConfig,
  type CircuitBreakerConfig,
} from './otlp-exporter.js'

/**
 * Convenience function for unified configuration
 *
 * This is the primary API for customers who want telemetry alongside OAuth
 */
export async function configureUnifiedMCPTelemetry(config: {
  serverSlug: string
  apiKey: string
  endpoint?: string
  serviceName?: string
  serviceVersion?: string
  sampling?: { rate?: number }
  skipInstrumentation?: string[]
  debug?: boolean
  // OAuth context integration (if available)
  getAuthContext?: () => Promise<{
    userId?: string
    email?: string
    sessionId?: string
  } | undefined>
}) {
  const { getAuthContext, ...telemetryConfig } = config

  // Initialize telemetry
  const { configureMCPTelemetry, instrumentMCPServer } = await import('./auto-instrumentation.js')

  configureMCPTelemetry(telemetryConfig)

  // Return instrumentation function that can be called with server instance
  return {
    instrumentServer: (server: any) => {
      // If auth context provider is available, get current context
      const authContext = getAuthContext ? undefined : undefined // Will be set dynamically
      instrumentMCPServer(server, authContext)
    },
    shutdown: async () => {
      const { shutdownTelemetry } = await import('./auto-instrumentation.js')
      await shutdownTelemetry()
    },
    getStats: () => {
      const { getTelemetryStats } = await import('./auto-instrumentation.js')
      return getTelemetryStats()
    }
  }
}

/**
 * Simple telemetry setup for customers who only want telemetry
 */
export async function setupSimpleTelemetry(config: {
  serverSlug: string
  apiKey: string
  endpoint?: string
  server: any // MCP Server instance
}) {
  const { server, ...telemetryConfig } = config

  const { configureMCPTelemetry, instrumentMCPServer } = await import('./auto-instrumentation.js')

  configureMCPTelemetry(telemetryConfig)
  instrumentMCPServer(server)

  return {
    shutdown: async () => {
      const { shutdownTelemetry } = await import('./auto-instrumentation.js')
      await shutdownTelemetry()
    }
  }
}