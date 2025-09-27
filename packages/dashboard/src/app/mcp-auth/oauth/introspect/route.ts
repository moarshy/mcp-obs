import { type NextRequest, NextResponse } from 'next/server'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'
import { headers } from 'next/headers'
import { db, mcpOauthToken, mcpOauthClient } from 'database'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    // Get MCP server context from subdomain
    const headerList = await headers()
    const host = headerList.get('host') || ''

    let mcpServer = null
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (isDevelopment) {
      // Development: extract subdomain from localhost
      const hostWithoutPort = host.replace(/:\d+$/, '')

      if (hostWithoutPort.includes('.localhost')) {
        const subdomain = hostWithoutPort.replace('.localhost', '')
        if (subdomain && !subdomain.includes('.')) {
          mcpServer = await getMcpServerBySlug(subdomain)
        }
      }
    } else {
      // Production: extract subdomain
      const baseDomain = 'mcp-obs.com'
      const hostWithoutPort = host.replace(/:\d+$/, '')

      if (hostWithoutPort !== baseDomain && hostWithoutPort !== `www.${baseDomain}`) {
        const subdomain = hostWithoutPort.replace(`.${baseDomain}`, '')
        if (subdomain && !subdomain.includes('.')) {
          mcpServer = await getMcpServerBySlug(subdomain)
        }
      }
    }

    if (!mcpServer) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'MCP server not found' },
        { status: 400 }
      )
    }

    if (!mcpServer.enabled) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Authentication is disabled for this MCP server' },
        { status: 400 }
      )
    }

    // Parse form data (RFC 7662 requires form encoding)
    const params: Record<string, any> = {}
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      for (const [key, value] of formData.entries()) {
        params[key] = value.toString()
      }
    } else {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Content-Type must be application/x-www-form-urlencoded' },
        { status: 400 }
      )
    }

    const { token, token_type_hint } = params

    if (!token) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing token parameter' },
        { status: 400 }
      )
    }

    // TODO: Authenticate the client making the introspection request
    // This would typically require client credentials or other authentication

    // Look up token in database
    let tokenRecord = null

    try {
      const tokens = await db
        .select({
          token: mcpOauthToken,
          client: mcpOauthClient
        })
        .from(mcpOauthToken)
        .leftJoin(mcpOauthClient, eq(mcpOauthToken.clientId, mcpOauthClient.clientId))
        .where(and(
          eq(mcpOauthToken.accessToken, token),
          eq(mcpOauthToken.mcpServerId, mcpServer.id)
        ))
        .limit(1)

      tokenRecord = tokens[0]
    } catch (error) {
      console.error('Error looking up token:', error)
    }

    // If token not found or expired, return inactive
    if (!tokenRecord || !tokenRecord.token) {
      return NextResponse.json({
        active: false
      })
    }

    const tokenData = tokenRecord.token
    const clientData = tokenRecord.client

    // Check if token is expired
    const now = new Date()
    const isExpired = tokenData.expiresAt && new Date(tokenData.expiresAt) < now
    const isRevoked = tokenData.revokedAt !== null

    if (isExpired || isRevoked) {
      return NextResponse.json({
        active: false
      })
    }

    // Token is active, return introspection response (RFC 7662)
    const response: any = {
      active: true,
      scope: tokenData.scope,
      client_id: tokenData.clientId,
      token_type: tokenData.tokenType,
      exp: Math.floor(new Date(tokenData.expiresAt).getTime() / 1000),
      iat: Math.floor(new Date(tokenData.createdAt).getTime() / 1000),
      sub: tokenData.userId,

      // MCP-specific extensions
      'mcp:server_id': mcpServer.id,
      'mcp:server_name': mcpServer.name,
      'mcp:organization_id': mcpServer.organizationId
    }

    // Add client information if available
    if (clientData) {
      response.client_name = clientData.clientName
      response.client_uri = clientData.clientUri
    }

    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Error in OAuth token introspection:', error)
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'invalid_request', error_description: 'Token introspection endpoint only supports POST method' },
    { status: 405 }
  )
}