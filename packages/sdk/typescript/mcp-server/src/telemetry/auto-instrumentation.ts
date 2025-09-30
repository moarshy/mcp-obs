import { NodeSDK } from '@opentelemetry/sdk-node'
import { trace, context, SpanKind, SpanStatusCode } from '@opentelemetry/api'
import { ResilientOTLPExporter } from './otlp-exporter.js'
import { MCPAttributes, MCPOperationType, MCPSpanNames } from './mcp-semantic-conventions.js'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js'

export interface MCPTelemetryConfig {
  serverSlug: string
  apiKey: string
  endpoint?: string
  serviceName?: string
  serviceVersion?: string
  sampling?: {
    rate?: number // 0.0 to 1.0
  }
  skipInstrumentation?: string[]
  debug?: boolean
}

export interface AuthContext {
  userId?: string
  email?: string
  sessionId?: string
}

let globalTelemetryConfig: MCPTelemetryConfig | null = null
let globalNodeSDK: NodeSDK | null = null
let globalTracer: any = null

/**
 * Initialize OpenTelemetry with MCP-specific configuration
 */
export function configureMCPTelemetry(config: MCPTelemetryConfig): void {
  if (globalNodeSDK) {
    console.warn('[mcp-obs] Telemetry already configured')
    return
  }

  globalTelemetryConfig = config

  try {
    // Create OTLP exporter with circuit breaker
    const exporter = new ResilientOTLPExporter({
      serverSlug: config.serverSlug,
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
    })

    // Initialize OpenTelemetry SDK
    const sdk = new NodeSDK({
      traceExporter: exporter,
      instrumentations: [], // We'll do custom MCP instrumentation
      sampler: createSampler(config.sampling?.rate ?? 1.0),
    })

    sdk.start()
    globalNodeSDK = sdk
    globalTracer = trace.getTracer('mcp-obs-server-sdk', '1.0.0')

    if (config.debug) {
      console.log('[mcp-obs] Telemetry initialized:', {
        serverSlug: config.serverSlug,
        endpoint: config.endpoint || 'https://api.mcp-obs.com/otel/traces',
        sampling: config.sampling?.rate ?? 1.0,
      })
    }
  } catch (error) {
    console.error('[mcp-obs] Failed to initialize telemetry:', error)
  }
}

/**
 * Create sampling configuration
 */
function createSampler(rate: number) {
  if (rate >= 1.0) {
    const { AlwaysOnSampler } = require('@opentelemetry/sdk-node')
    return new AlwaysOnSampler()
  } else if (rate <= 0) {
    const { AlwaysOffSampler } = require('@opentelemetry/sdk-node')
    return new AlwaysOffSampler()
  } else {
    const { TraceIdRatioBasedSampler } = require('@opentelemetry/sdk-node')
    return new TraceIdRatioBasedSampler(rate)
  }
}

/**
 * Instrument an MCP server with automatic telemetry
 */
export function instrumentMCPServer(server: Server, authContext?: AuthContext): void {
  if (!globalTracer || !globalTelemetryConfig) {
    console.warn('[mcp-obs] Telemetry not configured - skipping instrumentation')
    return
  }

  const config = globalTelemetryConfig
  const tracer = globalTracer

  if (config.debug) {
    console.log('[mcp-obs] Instrumenting MCP server')
  }

  // Wrap tool call handler
  const originalSetRequestHandler = server.setRequestHandler.bind(server)
  server.setRequestHandler = function(schema: any, handler: any) {
    if (schema === CallToolRequestSchema) {
      const wrappedHandler = wrapToolCallHandler(tracer, handler, config, authContext)
      return originalSetRequestHandler(schema, wrappedHandler)
    } else if (schema === ReadResourceRequestSchema) {
      const wrappedHandler = wrapResourceReadHandler(tracer, handler, config, authContext)
      return originalSetRequestHandler(schema, wrappedHandler)
    } else if (schema === ListResourcesRequestSchema) {
      const wrappedHandler = wrapResourceListHandler(tracer, handler, config, authContext)
      return originalSetRequestHandler(schema, wrappedHandler)
    } else if (schema === GetPromptRequestSchema) {
      const wrappedHandler = wrapPromptGetHandler(tracer, handler, config, authContext)
      return originalSetRequestHandler(schema, wrappedHandler)
    } else if (schema === ListPromptsRequestSchema) {
      const wrappedHandler = wrapPromptListHandler(tracer, handler, config, authContext)
      return originalSetRequestHandler(schema, wrappedHandler)
    }

    // For other handlers, use original
    return originalSetRequestHandler(schema, handler)
  }

  if (config.debug) {
    console.log('[mcp-obs] MCP server instrumented successfully')
  }
}

/**
 * Wrap tool call handler with telemetry
 */
function wrapToolCallHandler(tracer: any, originalHandler: any, config: MCPTelemetryConfig, authContext?: AuthContext) {
  return async function(request: any) {
    const toolName = request.params.name

    // Check if this tool should be skipped
    if (config.skipInstrumentation?.includes(toolName)) {
      return originalHandler(request)
    }

    const span = tracer.startSpan(MCPSpanNames.TOOL_CALL, {
      kind: SpanKind.SERVER,
      attributes: {
        [MCPAttributes.MCP_OPERATION_TYPE]: MCPOperationType.TOOL_CALL,
        [MCPAttributes.MCP_TOOL_NAME]: toolName,
        [MCPAttributes.MCP_SERVER_SLUG]: config.serverSlug,
        [MCPAttributes.MCP_TOOL_INPUT_SIZE]: JSON.stringify(request.params.arguments || {}).length,
        ...(authContext?.userId && { [MCPAttributes.MCP_USER_ID]: authContext.userId }),
        ...(authContext?.email && { [MCPAttributes.MCP_USER_EMAIL]: authContext.email }),
        ...(authContext?.sessionId && { [MCPAttributes.MCP_SESSION_ID]: authContext.sessionId }),
      },
    })

    return context.with(trace.setSpan(context.active(), span), async () => {
      const startTime = Date.now()

      try {
        const result = await originalHandler(request)

        // Add success attributes
        span.setAttributes({
          [MCPAttributes.MCP_TOOL_SUCCESS]: true,
          [MCPAttributes.MCP_TOOL_OUTPUT_SIZE]: JSON.stringify(result).length,
        })

        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error: any) {
        // Add error attributes
        span.setAttributes({
          [MCPAttributes.MCP_TOOL_SUCCESS]: false,
          [MCPAttributes.MCP_ERROR_TYPE]: error.constructor.name,
          [MCPAttributes.MCP_ERROR_MESSAGE]: error.message || 'Unknown error',
        })

        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
        throw error
      } finally {
        const duration = Date.now() - startTime
        span.setAttributes({
          'duration_ms': duration,
        })
        span.end()
      }
    })
  }
}

/**
 * Wrap resource read handler with telemetry
 */
function wrapResourceReadHandler(tracer: any, originalHandler: any, config: MCPTelemetryConfig, authContext?: AuthContext) {
  return async function(request: any) {
    const resourceUri = request.params.uri

    const span = tracer.startSpan(MCPSpanNames.RESOURCE_READ, {
      kind: SpanKind.SERVER,
      attributes: {
        [MCPAttributes.MCP_OPERATION_TYPE]: MCPOperationType.RESOURCE_READ,
        [MCPAttributes.MCP_RESOURCE_URI]: resourceUri,
        [MCPAttributes.MCP_SERVER_SLUG]: config.serverSlug,
        ...(authContext?.userId && { [MCPAttributes.MCP_USER_ID]: authContext.userId }),
        ...(authContext?.sessionId && { [MCPAttributes.MCP_SESSION_ID]: authContext.sessionId }),
      },
    })

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await originalHandler(request)

        span.setAttributes({
          [MCPAttributes.MCP_RESOURCE_SIZE]: JSON.stringify(result).length,
        })

        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error: any) {
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
        throw error
      } finally {
        span.end()
      }
    })
  }
}

/**
 * Wrap resource list handler with telemetry
 */
function wrapResourceListHandler(tracer: any, originalHandler: any, config: MCPTelemetryConfig, authContext?: AuthContext) {
  return async function(request: any) {
    const span = tracer.startSpan(MCPSpanNames.RESOURCE_LIST, {
      kind: SpanKind.SERVER,
      attributes: {
        [MCPAttributes.MCP_OPERATION_TYPE]: MCPOperationType.RESOURCE_LIST,
        [MCPAttributes.MCP_SERVER_SLUG]: config.serverSlug,
        ...(authContext?.userId && { [MCPAttributes.MCP_USER_ID]: authContext.userId }),
        ...(authContext?.sessionId && { [MCPAttributes.MCP_SESSION_ID]: authContext.sessionId }),
      },
    })

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await originalHandler(request)

        span.setAttributes({
          'mcp.resource.count': result.resources?.length || 0,
        })

        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error: any) {
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
        throw error
      } finally {
        span.end()
      }
    })
  }
}

/**
 * Wrap prompt get handler with telemetry
 */
function wrapPromptGetHandler(tracer: any, originalHandler: any, config: MCPTelemetryConfig, authContext?: AuthContext) {
  return async function(request: any) {
    const promptName = request.params.name

    const span = tracer.startSpan(MCPSpanNames.PROMPT_GET, {
      kind: SpanKind.SERVER,
      attributes: {
        [MCPAttributes.MCP_OPERATION_TYPE]: MCPOperationType.PROMPT_GET,
        [MCPAttributes.MCP_PROMPT_NAME]: promptName,
        [MCPAttributes.MCP_SERVER_SLUG]: config.serverSlug,
        [MCPAttributes.MCP_PROMPT_ARGS_COUNT]: Object.keys(request.params.arguments || {}).length,
        ...(authContext?.userId && { [MCPAttributes.MCP_USER_ID]: authContext.userId }),
        ...(authContext?.sessionId && { [MCPAttributes.MCP_SESSION_ID]: authContext.sessionId }),
      },
    })

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await originalHandler(request)
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error: any) {
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
        throw error
      } finally {
        span.end()
      }
    })
  }
}

/**
 * Wrap prompt list handler with telemetry
 */
function wrapPromptListHandler(tracer: any, originalHandler: any, config: MCPTelemetryConfig, authContext?: AuthContext) {
  return async function(request: any) {
    const span = tracer.startSpan(MCPSpanNames.PROMPT_LIST, {
      kind: SpanKind.SERVER,
      attributes: {
        [MCPAttributes.MCP_OPERATION_TYPE]: MCPOperationType.PROMPT_LIST,
        [MCPAttributes.MCP_SERVER_SLUG]: config.serverSlug,
        ...(authContext?.userId && { [MCPAttributes.MCP_USER_ID]: authContext.userId }),
        ...(authContext?.sessionId && { [MCPAttributes.MCP_SESSION_ID]: authContext.sessionId }),
      },
    })

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await originalHandler(request)

        span.setAttributes({
          'mcp.prompt.count': result.prompts?.length || 0,
        })

        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error: any) {
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
        throw error
      } finally {
        span.end()
      }
    })
  }
}

/**
 * Shutdown telemetry
 */
export async function shutdownTelemetry(): Promise<void> {
  if (globalNodeSDK) {
    await globalNodeSDK.shutdown()
    globalNodeSDK = null
    globalTracer = null
    globalTelemetryConfig = null
  }
}

/**
 * Get telemetry statistics
 */
export function getTelemetryStats() {
  return {
    configured: !!globalTelemetryConfig,
    serverSlug: globalTelemetryConfig?.serverSlug,
    sampling: globalTelemetryConfig?.sampling?.rate ?? 1.0,
  }
}