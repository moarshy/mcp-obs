import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { StandardAttributes } from './mcp-semantic-conventions.js'

export interface OTLPExporterConfig {
  serverSlug: string
  apiKey: string
  endpoint?: string
  serviceName?: string
  serviceVersion?: string
  headers?: Record<string, string>
  timeout?: number
  concurrencyLimit?: number
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number
  monitoringPeriod: number
}

export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN - dropping telemetry')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  getState(): string {
    return this.state
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    }
  }
}

export function createMCPOTLPExporter(config: OTLPExporterConfig): OTLPTraceExporter {
  // Default to mcp-obs platform endpoint
  const endpoint = config.endpoint || 'https://api.mcp-obs.com/otel/traces'

  // Create resource with service identification
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: config.serviceName || `${config.serverSlug}-mcp-server`,
    [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion || '1.0.0',
    'mcp.server.slug': config.serverSlug,
  })

  // Configure exporter with authentication
  const exporter = new OTLPTraceExporter({
    url: endpoint,
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...config.headers,
    },
    timeoutMillis: config.timeout || 10000, // 10 seconds
    concurrencyLimit: config.concurrencyLimit || 5,
  })

  // Attach resource to exporter
  ;(exporter as any).resource = resource

  return exporter
}

export function createCircuitBreaker(): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: 5, // Open after 5 consecutive failures
    resetTimeout: 60000, // Try again after 1 minute
    monitoringPeriod: 10000, // Monitor failures over 10 seconds
  })
}

/**
 * Wraps OTLP exporter with circuit breaker for resilient export
 */
export class ResilientOTLPExporter {
  private circuitBreaker: CircuitBreaker
  private exporter: OTLPTraceExporter

  constructor(config: OTLPExporterConfig) {
    this.exporter = createMCPOTLPExporter(config)
    this.circuitBreaker = createCircuitBreaker()
  }

  async export(spans: any[]): Promise<void> {
    if (spans.length === 0) return

    try {
      await this.circuitBreaker.execute(async () => {
        return new Promise<void>((resolve, reject) => {
          this.exporter.export(spans as any, (result) => {
            if (result.code === 0) { // SUCCESS
              resolve()
            } else {
              reject(new Error(`Export failed: ${result.error?.message || 'Unknown error'}`))
            }
          })
        })
      })
    } catch (error) {
      // Log but don't throw - telemetry failures should never impact MCP server
      console.warn('[mcp-obs] Telemetry export failed:', error)
    }
  }

  async shutdown(): Promise<void> {
    return this.exporter.shutdown()
  }

  getStats() {
    return {
      circuitBreaker: this.circuitBreaker.getStats(),
    }
  }
}