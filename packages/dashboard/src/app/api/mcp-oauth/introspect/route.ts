import { NextRequest, NextResponse } from 'next/server'
import { introspectToken } from '@/lib/mcp-oauth/token-validation'
import { getOAuthClient } from '@/lib/mcp-oauth/client-registration'
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

// POST /oauth/introspect - RFC 7662 Token Introspection
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
      const formData = await request.formData()
      requestBody = {}

      formData.forEach((value, key) => {
        requestBody[key] = value
      })
    } else if (contentType.includes('application/json')) {
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

    const { token, token_type_hint, client_id, client_secret } = requestBody

    if (!token) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'token parameter is required'
        },
        { status: 400 }
      )
    }

    // Handle client authentication via Authorization header (HTTP Basic)
    const authHeader = request.headers.get('authorization')
    let authenticatedClientId = client_id
    let authenticatedClientSecret = client_secret

    if (authHeader?.startsWith('Basic ')) {
      try {
        const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8')
        const [clientId, clientSecret] = credentials.split(':', 2)

        if (clientId && clientSecret) {
          authenticatedClientId = clientId
          authenticatedClientSecret = clientSecret
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

    // Authenticate client if credentials provided
    if (authenticatedClientId) {
      const client = await getOAuthClient(mcpServer.id, authenticatedClientId)

      if (!client) {
        return NextResponse.json(
          {
            error: 'invalid_client',
            error_description: 'Client not found'
          },
          { status: 401 }
        )
      }

      if (client.disabled) {
        return NextResponse.json(
          {
            error: 'invalid_client',
            error_description: 'Client has been disabled'
          },
          { status: 401 }
        )
      }

      // Check client secret if provided
      if (authenticatedClientSecret !== undefined) {
        if (client.tokenEndpointAuthMethod !== 'none' && client.clientSecret !== authenticatedClientSecret) {
          return NextResponse.json(
            {
              error: 'invalid_client',
              error_description: 'Client authentication failed'
            },
            { status: 401 }
          )
        }
      }
    }

    // Perform token introspection
    const introspectionResult = await introspectToken(
      mcpServer.id,
      token,
      token_type_hint as 'access_token' | 'refresh_token' | undefined
    )

    return NextResponse.json(introspectionResult, {
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
    console.error('Token introspection error:', error)

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

// OPTIONS /oauth/introspect - CORS preflight
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