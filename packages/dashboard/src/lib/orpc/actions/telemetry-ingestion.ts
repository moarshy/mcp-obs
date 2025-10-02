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
    try {
      // Calculate time window for queries
      const now = new Date()
      let startTime: Date

      switch (input.timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case '6h':
          startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000)
          break
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }

      const { gte, count, desc, sql, avg, countDistinct, eq, and } = await import('drizzle-orm')

      // Base filter conditions
      const baseConditions = [
        eq(telemetryTrace.mcpServerId, input.mcpServerId),
        gte(telemetryTrace.createdAt, startTime),
        eq(telemetryTrace.mcpOperationType, 'tool_call')
      ]

      // 1. Summary metrics
      const [summaryResult] = await db
        .select({
          totalCalls: count().as('totalCalls'),
          avgLatency: avg(telemetryTrace.durationNs).as('avgLatency'),
          activeUsers: countDistinct(telemetryTrace.mcpUserId).as('activeUsers'),
        })
        .from(telemetryTrace)
        .where(and(...baseConditions))

      // 2. Error rate calculation
      const [errorResult] = await db
        .select({
          totalCalls: count().as('totalCalls'),
          errorCalls: count(sql`CASE WHEN ${telemetryTrace.spanStatus} = 'ERROR' THEN 1 END`).as('errorCalls'),
        })
        .from(telemetryTrace)
        .where(and(...baseConditions))

      // 3. Top tools by usage
      const topToolsResult = await db
        .select({
          name: telemetryTrace.mcpToolName,
          calls: count().as('calls'),
          avgLatency: avg(telemetryTrace.durationNs).as('avgLatency'),
          errorRate: sql<number>`(COUNT(CASE WHEN ${telemetryTrace.spanStatus} = 'ERROR' THEN 1 END)::float / COUNT(*)::float * 100)`.as('errorRate'),
        })
        .from(telemetryTrace)
        .where(and(...baseConditions))
        .groupBy(telemetryTrace.mcpToolName)
        .orderBy(desc(count()))
        .limit(10)

      // 4. Latency percentiles calculation
      const latencyValues = await db
        .select({
          durationMs: sql<number>`(${telemetryTrace.durationNs} / 1000000.0)`.as('durationMs')
        })
        .from(telemetryTrace)
        .where(and(...baseConditions))
        .orderBy(telemetryTrace.durationNs)

      // Calculate percentiles
      const calculatePercentile = (values: number[], percentile: number) => {
        if (values.length === 0) return 0
        const index = Math.ceil((percentile / 100) * values.length) - 1
        return Math.round(values[Math.max(0, index)] || 0)
      }

      const durations = latencyValues.map(v => v.durationMs)
      const latencyPercentiles = {
        p50: calculatePercentile(durations, 50),
        p95: calculatePercentile(durations, 95),
        p99: calculatePercentile(durations, 99),
      }

      // 5. Time series data (simplified - hourly buckets for now)
      const timeBucket = input.timeRange === '1h' || input.timeRange === '6h'
        ? "date_trunc('minute', created_at)"
        : input.timeRange === '24h'
        ? "date_trunc('hour', created_at)"
        : "date_trunc('day', created_at)"

      const timeSeriesResult = await db
        .select({
          timestamp: sql<string>`${sql.raw(timeBucket)}::text`.as('timestamp'),
          calls: count().as('calls'),
          avgLatency: avg(telemetryTrace.durationNs).as('avgLatency'),
          errors: count(sql`CASE WHEN ${telemetryTrace.spanStatus} = 'ERROR' THEN 1 END`).as('errors'),
        })
        .from(telemetryTrace)
        .where(and(...baseConditions))
        .groupBy(sql.raw(timeBucket))
        .orderBy(sql.raw(timeBucket))
        .limit(100)

      // Process results
      const totalCalls = Number(summaryResult?.totalCalls || 0)
      const avgLatencyNs = Number(summaryResult?.avgLatency || 0)
      const avgLatency = Math.round(avgLatencyNs / 1_000_000) // Convert nanoseconds to milliseconds
      const activeUsers = Number(summaryResult?.activeUsers || 0)

      const totalCallsForError = Number(errorResult?.totalCalls || 0)
      const errorCalls = Number(errorResult?.errorCalls || 0)
      const errorRate = totalCallsForError > 0 ? Math.round((errorCalls / totalCallsForError) * 100 * 10) / 10 : 0

      const topTools = topToolsResult
        .filter(tool => tool.name) // Filter out null tool names
        .map(tool => ({
          name: tool.name!,
          calls: Number(tool.calls),
          avgLatency: Math.round(Number(tool.avgLatency || 0) / 1_000_000),
          errorRate: Math.round((Number(tool.errorRate) || 0) * 10) / 10,
        }))

      const timeSeries = timeSeriesResult.map(ts => ({
        timestamp: ts.timestamp,
        calls: Number(ts.calls),
        latency: Math.round(Number(ts.avgLatency || 0) / 1_000_000),
        errors: Number(ts.errors),
      }))

      return {
        mcpServerId: input.mcpServerId,
        timeRange: input.timeRange,
        summary: {
          totalCalls,
          avgLatency,
          errorRate,
          activeUsers,
        },
        topTools,
        latencyPercentiles,
        timeSeries,
      }
    } catch (error) {
      console.error('Error fetching telemetry analytics:', error)
      throw errors.INTERNAL_SERVER_ERROR({
        message: 'Failed to fetch telemetry analytics data'
      })
    }
  })
  .actionable({})

// Organization-level analytics (cross-server)
const getOrganizationAnalyticsSchema = z.object({
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
})

export const getOrganizationTelemetryAction = base
  .input(getOrganizationAnalyticsSchema)
  .handler(async ({ input, errors }) => {
    try {
      // Import all dependencies first
      const { requireSession } = await import('../../auth/session')
      const { member, mcpServer } = await import('database')
      const { gte, count, desc, sql, avg, countDistinct, eq, and } = await import('drizzle-orm')

      // Get user's organization from session
      const session = await requireSession()

      if (!session?.user) {
        throw errors.UNAUTHORIZED({ message: 'Authentication required' })
      }

      // Get user's organization
      const userMemberships = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, session.user.id))

      if (userMemberships.length === 0) {
        throw errors.UNAUTHORIZED({ message: 'No organization membership found' })
      }

      const organizationId = userMemberships[0].organizationId


      // Calculate time window for queries
      const now = new Date()
      let startTime: Date

      switch (input.timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case '6h':
          startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000)
          break
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }


      // Base filter conditions for organization
      const baseConditions = [
        eq(telemetryTrace.organizationId, organizationId),
        gte(telemetryTrace.createdAt, startTime),
        eq(telemetryTrace.mcpOperationType, 'tool_call')
      ]

      // 1. Organization-wide summary metrics
      const [summaryResult] = await db
        .select({
          totalCalls: count().as('totalCalls'),
          avgLatency: avg(telemetryTrace.durationNs).as('avgLatency'),
          activeUsers: countDistinct(telemetryTrace.mcpUserId).as('activeUsers'),
          activeServers: countDistinct(telemetryTrace.mcpServerId).as('activeServers'),
        })
        .from(telemetryTrace)
        .where(and(...baseConditions))

      // 2. Error rate calculation
      const [errorResult] = await db
        .select({
          totalCalls: count().as('totalCalls'),
          errorCalls: count(sql`CASE WHEN ${telemetryTrace.spanStatus} = 'ERROR' THEN 1 END`).as('errorCalls'),
        })
        .from(telemetryTrace)
        .where(and(...baseConditions))

      // 3. Most used server
      const topServersResult = await db
        .select({
          serverId: telemetryTrace.mcpServerId,
          serverName: mcpServer.name,
          serverSlug: mcpServer.slug,
          calls: count().as('calls'),
          avgLatency: avg(telemetryTrace.durationNs).as('avgLatency'),
          errorRate: sql<number>`(COUNT(CASE WHEN ${telemetryTrace.spanStatus} = 'ERROR' THEN 1 END)::float / COUNT(*)::float * 100)`.as('errorRate'),
        })
        .from(telemetryTrace)
        .innerJoin(mcpServer, eq(telemetryTrace.mcpServerId, mcpServer.id))
        .where(and(...baseConditions))
        .groupBy(telemetryTrace.mcpServerId, mcpServer.name, mcpServer.slug)
        .orderBy(desc(count()))
        .limit(5)

      // 4. Most called tool (with server context)
      const topToolsResult = await db
        .select({
          toolName: telemetryTrace.mcpToolName,
          serverId: telemetryTrace.mcpServerId,
          serverName: mcpServer.name,
          serverSlug: mcpServer.slug,
          calls: count().as('calls'),
          avgLatency: avg(telemetryTrace.durationNs).as('avgLatency'),
          errorRate: sql<number>`(COUNT(CASE WHEN ${telemetryTrace.spanStatus} = 'ERROR' THEN 1 END)::float / COUNT(*)::float * 100)`.as('errorRate'),
        })
        .from(telemetryTrace)
        .innerJoin(mcpServer, eq(telemetryTrace.mcpServerId, mcpServer.id))
        .where(and(...baseConditions))
        .groupBy(telemetryTrace.mcpToolName, telemetryTrace.mcpServerId, mcpServer.name, mcpServer.slug)
        .orderBy(desc(count()))
        .limit(10)


      // Process results
      const totalCalls = Number(summaryResult?.totalCalls || 0)
      const avgLatencyNs = Number(summaryResult?.avgLatency || 0)
      const avgLatency = Math.round(avgLatencyNs / 1_000_000) // Convert nanoseconds to milliseconds
      const activeUsers = Number(summaryResult?.activeUsers || 0)
      const activeServers = Number(summaryResult?.activeServers || 0)

      const totalCallsForError = Number(errorResult?.totalCalls || 0)
      const errorCalls = Number(errorResult?.errorCalls || 0)
      const errorRate = totalCallsForError > 0 ? Math.round((errorCalls / totalCallsForError) * 100 * 10) / 10 : 0

      const topServers = topServersResult.map(server => ({
        serverId: server.serverId,
        serverName: server.serverName,
        serverSlug: server.serverSlug,
        calls: Number(server.calls),
        avgLatency: Math.round(Number(server.avgLatency || 0) / 1_000_000),
        errorRate: Math.round((Number(server.errorRate) || 0) * 10) / 10,
      }))

      const topTools = topToolsResult
        .filter(tool => tool.toolName) // Filter out null tool names
        .map(tool => ({
          toolName: tool.toolName!,
          serverId: tool.serverId,
          serverName: tool.serverName,
          serverSlug: tool.serverSlug,
          calls: Number(tool.calls),
          avgLatency: Math.round(Number(tool.avgLatency || 0) / 1_000_000),
          errorRate: Math.round((Number(tool.errorRate) || 0) * 10) / 10,
        }))

      return {
        organizationId,
        timeRange: input.timeRange,
        summary: {
          totalCalls,
          avgLatency,
          errorRate,
          activeUsers,
          activeServers,
        },
        topServers,
        topTools,
        mostUsedServer: topServers[0] || null,
        mostCalledTool: topTools[0] || null,
      }
    } catch (error) {
      console.error('Error fetching organization telemetry analytics:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        organizationId,
        timeRange: input.timeRange
      })
      throw errors.INTERNAL_SERVER_ERROR({
        message: `Failed to fetch organization telemetry analytics data: ${error.message}`
      })
    }
  })
  .actionable({})