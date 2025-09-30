import { type NextRequest, NextResponse } from 'next/server'
import { ingestMetricsAction } from '../../../../lib/orpc/actions/telemetry-ingestion'

/**
 * OTLP HTTP Metrics endpoint
 *
 * Accepts OpenTelemetry metrics data via HTTP POST following OTLP protocol.
 * Currently, most metrics are generated from traces, but this endpoint
 * supports custom metrics from SDKs in the future.
 */
export async function POST(request: NextRequest) {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing Authorization header' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      )
    }

    // Parse request body
    let otlpData: any
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      // JSON format OTLP
      otlpData = await request.json()
    } else if (contentType.includes('application/x-protobuf')) {
      // Protobuf format OTLP (future support)
      return NextResponse.json(
        { error: 'Protobuf format not yet supported, use JSON' },
        { status: 400 }
      )
    } else {
      // Try JSON as fallback
      try {
        otlpData = await request.json()
      } catch {
        return NextResponse.json(
          { error: 'Invalid content type, expected application/json' },
          { status: 400 }
        )
      }
    }

    // Validate OTLP data structure
    if (!otlpData.resourceMetrics || !Array.isArray(otlpData.resourceMetrics)) {
      return NextResponse.json(
        { error: 'Invalid OTLP metrics data: missing resourceMetrics array' },
        { status: 400 }
      )
    }

    // Call oRPC action for processing
    const result = await ingestMetricsAction({
      resourceMetrics: otlpData.resourceMetrics,
      apiKey: apiKey,
    })

    // Return success response in OTLP format
    return NextResponse.json({
      partialSuccess: {
        rejectedDataPoints: 0,
        errorMessage: '',
      }
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Add CORS headers for cross-origin telemetry export
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })

  } catch (error: any) {
    console.error('OTLP metrics ingestion error:', error)

    // Handle different error types
    if (error.message?.includes('Invalid or revoked API key')) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        {
          status: 401,
          headers: { 'WWW-Authenticate': 'Bearer' }
        }
      )
    }

    if (error.message?.includes('Failed to ingest')) {
      return NextResponse.json(
        { error: 'Internal server error during ingestion' },
        { status: 500 }
      )
    }

    // Generic error response
    return NextResponse.json(
      { error: 'Failed to process telemetry data' },
      { status: 500 }
    )
  }
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  })
}

/**
 * Return method not allowed for other HTTP methods
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { 'Allow': 'POST, OPTIONS' } }
  )
}