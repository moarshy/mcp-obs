import { NextRequest, NextResponse } from 'next/server'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'
import { headers } from 'next/headers'
import { db, mcpOauthToken } from 'database'
import { eq, and, or } from 'drizzle-orm'

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

    // Parse form data (RFC 7009 requires form encoding)
    let params: Record<string, any> = {}
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

    // TODO: Authenticate the client making the revocation request
    // This would typically require client credentials or other authentication

    try {
      // Find and revoke the token
      // RFC 7009: The token can be either an access token or refresh token
      const result = await db
        .update(mcpOauthToken)
        .set({
          revokedAt: new Date()
        })
        .where(and(
          or(
            eq(mcpOauthToken.accessToken, token),
            eq(mcpOauthToken.refreshToken, token)
          ),
          eq(mcpOauthToken.mcpServerId, mcpServer.id),
          // Only revoke if not already revoked
          eq(mcpOauthToken.revokedAt, null)
        ))
        .returning()

      // RFC 7009: If the token was revoked successfully or if the client
      // provided an invalid token, return 200 OK (don't leak info about token validity)
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache'
        }
      })

    } catch (error) {
      console.error('Error revoking token:', error)

      // Even on error, return 200 to not leak information
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache'
        }
      })
    }

  } catch (error) {
    console.error('Error in OAuth token revocation:', error)

    // RFC 7009: Even on server error, we should return 200 to not leak info
    // But in this case, it's a server error, so 500 is appropriate
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'invalid_request', error_description: 'Token revocation endpoint only supports POST method' },
    { status: 405 }
  )
}