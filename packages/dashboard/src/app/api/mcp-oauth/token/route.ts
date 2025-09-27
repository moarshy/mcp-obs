import { type NextRequest, NextResponse } from 'next/server'
import { handleTokenRequest } from '@/lib/mcp-oauth/token-exchange'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'
import { headers } from 'next/headers'

async function getMcpServerContext(request: NextRequest) {
  // Try to get MCP server ID from query parameters (set by middleware)
  const mcpServerId = request.nextUrl.searchParams.get('mcp_server_id')

  if (mcpServerId) {
    // Direct server ID from middleware
    const { db, mcpServer } = await import('database')
    const { eq } = await import('drizzle-orm')

    const servers = await db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.id, mcpServerId))
      .limit(1)

    return servers[0] || null
  }

  // Fallback: extract from subdomain
  const headerList = await headers()
  const host = headerList.get('host') || ''
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (!isDevelopment) {
    const baseDomain = 'mcp-obs.com'
    const hostWithoutPort = host.replace(/:\d+$/, '')

    if (hostWithoutPort !== baseDomain && hostWithoutPort !== `www.${baseDomain}`) {
      const subdomain = hostWithoutPort.replace(`.${baseDomain}`, '')
      if (subdomain && !subdomain.includes('.')) {
        return await getMcpServerBySlug(subdomain)
      }
    }
  }

  return null
}

// POST /oauth/token - OAuth 2.1 Token Endpoint
export async function POST(request: NextRequest) {
  try {
    const mcpServer = await getMcpServerContext(request)

    if (!mcpServer) {
      return NextResponse.json(
        {
          error: 'invalid_server',
          error_description: 'MCP server not found'
        },
        { status: 404 }
      )
    }

    // Parse request body
    let requestBody: Record<string, any>

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Standard OAuth form-encoded request
      const formData = await request.formData()
      requestBody = {}

      formData.forEach((value, key) => {
        requestBody[key] = value
      })
    } else if (contentType.includes('application/json')) {
      // JSON request (non-standard but sometimes used)
      requestBody = await request.json()
    } else {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'Content-Type must be application/x-www-form-urlencoded or application/json'
        },
        { status: 400 }
      )
    }

    // Handle client authentication via Authorization header (HTTP Basic)
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Basic ')) {
      try {
        const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8')
        const [clientId, clientSecret] = credentials.split(':', 2)

        if (clientId && clientSecret) {
          requestBody.client_id = clientId
          requestBody.client_secret = clientSecret
        }
      } catch (error) {
        return NextResponse.json(
          {
            error: 'invalid_client',
            error_description: 'Invalid Authorization header'
          },
          { status: 401 }
        )
      }
    }

    // Handle token request
    const result = await handleTokenRequest(mcpServer.id, requestBody)

    if (!result.success) {
      return NextResponse.json(result.error, {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    return NextResponse.json(result.response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })

  } catch (error) {
    console.error('Token endpoint error:', error)

    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'Internal server error'
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
        },
      }
    )
  }
}

// OPTIONS /oauth/token - CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  })
}