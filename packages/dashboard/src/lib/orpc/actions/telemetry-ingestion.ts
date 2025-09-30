'use server'

import { z } from 'zod'
import { base } from '../router'
import { db, telemetryTrace, telemetryMetric } from 'database'
import { validateApiKeyForTelemetry } from './telemetry-api-keys'

// OTLP Trace ingestion schema
const otlpTraceSchema = z.object({
  resourceSpans: z.array(z.object({
    resource: z.object({
      attributes: z.array(z.object({
        key: z.string(),
        value: z.object({
          stringValue: z.string().optional(),
          intValue: z.string().optional(),
          doubleValue: z.number().optional(),
          boolValue: z.boolean().optional(),
        }).optional(),
      })).optional(),
    }).optional(),
    scopeSpans: z.array(z.object({
      spans: z.array(z.object({
        traceId: z.string(),
        spanId: z.string(),
        parentSpanId: z.string().optional(),
        name: z.string(),
        startTimeUnixNano: z.string(),
        endTimeUnixNano: z.string(),
        attributes: z.array(z.object({
          key: z.string(),
          value: z.object({
            stringValue: z.string().optional(),
            intValue: z.string().optional(),
            doubleValue: z.number().optional(),
            boolValue: z.boolean().optional(),
          }).optional(),
        })).optional(),
        status: z.object({
          code: z.number().optional(),
          message: z.string().optional(),
        }).optional(),
      })),
    })),
  })),
})

const ingestTracesSchema = z.object({
  resourceSpans: z.array(z.any()), // Accept raw OTLP data
  apiKey: z.string(),
})

const ingestMetricsSchema = z.object({
  resourceMetrics: z.array(z.any()), // Accept raw OTLP data
  apiKey: z.string(),
})

// Helper function to extract attribute value
function extractAttributeValue(attribute: any): string | number | boolean | null {
  if (!attribute?.value) return null

  const value = attribute.value
  if (value.stringValue !== undefined) return value.stringValue
  if (value.intValue !== undefined) return parseInt(value.intValue)
  if (value.doubleValue !== undefined) return value.doubleValue
  if (value.boolValue !== undefined) return value.boolValue

  return null
}

// Helper function to convert attributes array to object
function attributesToObject(attributes: any[] = []): Record<string, any> {
  const result: Record<string, any> = {}

  for (const attr of attributes) {
    if (attr.key) {
      const value = extractAttributeValue(attr)
      if (value !== null) {
        result[attr.key] = value
      }
    }
  }

  return result
}

export const ingestTracesAction = base
  .input(ingestTracesSchema)
  .handler(async ({ input, errors }) => {
    try {
      // 1. Validate API key and get organization context
      const validation = await validateApiKeyForTelemetry(input.apiKey)

      if (!validation || !validation.isValid) {
        throw errors.UNAUTHORIZED({ message: 'Invalid or revoked API key' })
      }

      const { organizationId, mcpServerId, mcpServerSlug } = validation

      // 2. Process each resource span
      const traces: any[] = []
      const metrics: any[] = []

      for (const resourceSpan of input.resourceSpans) {
        // Extract resource attributes
        const resourceAttrs = attributesToObject(resourceSpan.resource?.attributes || [])

        for (const scopeSpan of resourceSpan.scopeSpans || []) {
          for (const span of scopeSpan.spans || []) {
            // Extract span attributes
            const spanAttrs = attributesToObject(span.attributes || [])

            // Calculate duration
            const startTimeNs = BigInt(span.startTimeUnixNano)
            const endTimeNs = BigInt(span.endTimeUnixNano)
            const durationNs = endTimeNs - startTimeNs

            // Prepare trace record
            const traceRecord = {
              organizationId: organizationId!,
              mcpServerId: mcpServerId!,
              traceId: span.traceId,
              spanId: span.spanId,
              parentSpanId: span.parentSpanId || null,
              operationName: span.name,
              startTime: startTimeNs,
              endTime: endTimeNs,
              durationNs: durationNs,
              // Extract MCP-specific attributes
              mcpOperationType: spanAttrs['mcp.operation.type'] || null,
              mcpToolName: spanAttrs['mcp.tool.name'] || null,
              mcpUserId: spanAttrs['mcp.user.id'] || null,
              mcpSessionId: spanAttrs['mcp.session.id'] || null,
              // Span status
              spanStatus: span.status?.code === 2 ? 'ERROR' : span.status?.code === 1 ? 'OK' : 'UNSET',
              errorMessage: span.status?.message || null,
              // Store complete span data for potential forwarding
              spanData: {
                ...span,
                resourceAttributes: resourceAttrs,
                spanAttributes: spanAttrs,
              },
            }

            traces.push(traceRecord)

            // Generate aggregated metrics
            if (spanAttrs['mcp.operation.type'] === 'tool_call') {
              // Tool call count metric
              metrics.push({
                organizationId: organizationId!,
                mcpServerId: mcpServerId!,
                metricName: 'mcp.tool.calls.count',
                metricType: 'counter',
                value: 1,
                labels: {
                  tool_name: spanAttrs['mcp.tool.name'] || 'unknown',
                  status: traceRecord.spanStatus.toLowerCase(),
                  user_id: spanAttrs['mcp.user.id'] || 'anonymous',
                },
                timestamp: new Date(Number(endTimeNs) / 1_000_000), // Convert nanoseconds to milliseconds
              })

              // Tool latency metric (in milliseconds)
              metrics.push({
                organizationId: organizationId!,
                mcpServerId: mcpServerId!,
                metricName: 'mcp.tool.latency.duration',
                metricType: 'histogram',
                value: Number(durationNs) / 1_000_000, // Convert to milliseconds
                labels: {
                  tool_name: spanAttrs['mcp.tool.name'] || 'unknown',
                  user_id: spanAttrs['mcp.user.id'] || 'anonymous',
                },
                timestamp: new Date(Number(endTimeNs) / 1_000_000),
              })
            }
          }
        }
      }

      // 3. Batch insert traces
      if (traces.length > 0) {
        await db.insert(telemetryTrace).values(traces)
      }

      // 4. Batch insert metrics
      if (metrics.length > 0) {
        await db.insert(telemetryMetric).values(metrics)
      }

      // 5. Return success response
      return {
        success: true,
        tracesIngested: traces.length,
        metricsGenerated: metrics.length,
        organizationId,
        mcpServerSlug,
      }

    } catch (error) {
      console.error('Error ingesting traces:', error)

      // Return appropriate error
      if (error.message?.includes('API key')) {
        throw errors.UNAUTHORIZED({ message: error.message })
      }

      throw errors.INTERNAL_SERVER_ERROR({
        message: 'Failed to ingest telemetry traces'
      })
    }
  })
  .actionable({})

export const ingestMetricsAction = base
  .input(ingestMetricsSchema)
  .handler(async ({ input, errors }) => {
    try {
      // 1. Validate API key and get organization context
      const validation = await validateApiKeyForTelemetry(input.apiKey)

      if (!validation || !validation.isValid) {
        throw errors.UNAUTHORIZED({ message: 'Invalid or revoked API key' })
      }

      const { organizationId, mcpServerId, mcpServerSlug } = validation

      // 2. Process metrics (future implementation)
      // For now, we primarily generate metrics from traces
      // Custom metrics from SDK can be implemented here

      return {
        success: true,
        metricsIngested: 0,
        organizationId,
        mcpServerSlug,
        note: 'Metrics ingestion currently handled via trace processing'
      }

    } catch (error) {
      console.error('Error ingesting metrics:', error)

      if (error.message?.includes('API key')) {
        throw errors.UNAUTHORIZED({ message: error.message })
      }

      throw errors.INTERNAL_SERVER_ERROR({
        message: 'Failed to ingest telemetry metrics'
      })
    }
  })
  .actionable({})

// Analytics query actions for dashboard
const getAnalyticsSchema = z.object({
  mcpServerId: z.string().uuid(),
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
})

export const getTelemetryAnalyticsAction = base
  .input(getAnalyticsSchema)
  .handler(async ({ input, errors }) => {
    // This will be implemented in Phase 4 for the dashboard
    // For now, return placeholder data structure

    return {
      mcpServerId: input.mcpServerId,
      timeRange: input.timeRange,
      summary: {
        totalCalls: 0,
        avgLatency: 0,
        errorRate: 0,
        activeUsers: 0,
      },
      topTools: [],
      latencyPercentiles: {
        p50: 0,
        p95: 0,
        p99: 0,
      },
      timeSeries: [],
    }
  })
  .actionable({})