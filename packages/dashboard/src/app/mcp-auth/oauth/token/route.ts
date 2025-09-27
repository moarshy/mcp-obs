import { type NextRequest, NextResponse } from 'next/server'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'
import { headers } from 'next/headers'

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
        { error: 'invalid_client', error_description: 'MCP server not found' },
        { status: 400 }
      )
    }

    if (!mcpServer.enabled) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Authentication is disabled for this MCP server' },
        { status: 400 }
      )
    }

    // Parse form data or JSON body
    let params: Record<string, any> = {}
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      for (const [key, value] of formData.entries()) {
        params[key] = value.toString()
      }
    } else if (contentType.includes('application/json')) {
      params = await request.json()
    } else {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Unsupported content type' },
        { status: 400 }
      )
    }

    const {
      grant_type,
      code,
      redirect_uri,
      client_id,
      client_secret,
      code_verifier,
      refresh_token
    } = params

    // Validate grant_type
    if (!grant_type) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing grant_type parameter' },
        { status: 400 }
      )
    }

    if (grant_type === 'authorization_code') {
      // Authorization Code Grant (with PKCE)
      if (!code) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing code parameter' },
          { status: 400 }
        )
      }

      if (!redirect_uri) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing redirect_uri parameter' },
          { status: 400 }
        )
      }

      if (!client_id) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing client_id parameter' },
          { status: 400 }
        )
      }

      if (!code_verifier) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing code_verifier parameter (PKCE required)' },
          { status: 400 }
        )
      }

      try {
        const { db, mcpOauthCode, mcpOauthToken } = await import('database')
        const { eq, and } = await import('drizzle-orm')
        const crypto = await import('crypto')
        const { nanoid } = await import('nanoid')

        // 1. Validate authorization code exists and is not expired
        const [authCode] = await db.select()
          .from(mcpOauthCode)
          .where(and(
            eq(mcpOauthCode.authorizationCode, code),
            eq(mcpOauthCode.clientId, client_id),
            eq(mcpOauthCode.mcpServerId, mcpServer.id)
          ))
          .limit(1)

        if (!authCode) {
          return NextResponse.json({
            error: 'invalid_grant',
            error_description: 'Invalid authorization code'
          }, { status: 400 })
        }

        // Check if code is expired
        if (new Date() > authCode.expiresAt) {
          return NextResponse.json({
            error: 'invalid_grant',
            error_description: 'Authorization code has expired'
          }, { status: 400 })
        }

        // Check if code was already used
        if (authCode.usedAt) {
          return NextResponse.json({
            error: 'invalid_grant',
            error_description: 'Authorization code has already been used'
          }, { status: 400 })
        }

        // 2. Validate PKCE code_verifier against stored code_challenge
        const hash = crypto.createHash('sha256').update(code_verifier).digest()
        const codeChallenge = hash.toString('base64url')

        if (codeChallenge !== authCode.codeChallenge) {
          return NextResponse.json({
            error: 'invalid_grant',
            error_description: 'Invalid code_verifier'
          }, { status: 400 })
        }

        // 3. Validate redirect_uri matches stored value
        if (redirect_uri !== authCode.redirectUri) {
          return NextResponse.json({
            error: 'invalid_grant',
            error_description: 'Invalid redirect_uri'
          }, { status: 400 })
        }

        // 4. Generate access_token and refresh_token
        const accessToken = `mcp_at_${nanoid(64)}`
        const refreshToken = `mcp_rt_${nanoid(64)}`
        const expiresAt = new Date(Date.now() + (mcpServer.accessTokenExpiration * 1000))
        const refreshTokenExpiresAt = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days

        // 5. Store tokens in database
        await db.insert(mcpOauthToken).values({
          accessToken,
          refreshToken,
          tokenType: 'Bearer',
          scope: authCode.scope || mcpServer.scopesSupported,
          expiresAt,
          refreshTokenExpiresAt,
          clientId: client_id,
          userId: authCode.userId,
          mcpServerId: mcpServer.id,
        })

        // Mark authorization code as used
        await db.update(mcpOauthCode)
          .set({ usedAt: new Date() })
          .where(eq(mcpOauthCode.id, authCode.id))

        // 6. Return token response
        return NextResponse.json({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: mcpServer.accessTokenExpiration,
          refresh_token: refreshToken,
          scope: authCode.scope || mcpServer.scopesSupported,
          // OAuth 2.1 - include server info
          'mcp:server_id': mcpServer.id,
          'mcp:server_name': mcpServer.name
        })

      } catch (dbError) {
        console.error('Database error in token exchange:', dbError)
        return NextResponse.json({
          error: 'server_error',
          error_description: 'Token exchange failed'
        }, { status: 500 })
      }

    } else if (grant_type === 'refresh_token') {
      // Refresh Token Grant
      if (!refresh_token) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing refresh_token parameter' },
          { status: 400 }
        )
      }

      try {
        const { db, mcpOauthToken } = await import('database')
        const { eq, and } = await import('drizzle-orm')
        const { nanoid } = await import('nanoid')

        // 1. Validate refresh token exists and is not expired
        const [existingToken] = await db.select()
          .from(mcpOauthToken)
          .where(and(
            eq(mcpOauthToken.refreshToken, refresh_token),
            eq(mcpOauthToken.mcpServerId, mcpServer.id)
          ))
          .limit(1)

        if (!existingToken) {
          return NextResponse.json({
            error: 'invalid_grant',
            error_description: 'Invalid refresh token'
          }, { status: 400 })
        }

        // Check if refresh token is expired
        if (existingToken.refreshTokenExpiresAt && new Date() > existingToken.refreshTokenExpiresAt) {
          return NextResponse.json({
            error: 'invalid_grant',
            error_description: 'Refresh token has expired'
          }, { status: 400 })
        }

        // Check if token is revoked
        if (existingToken.revokedAt) {
          return NextResponse.json({
            error: 'invalid_grant',
            error_description: 'Refresh token has been revoked'
          }, { status: 400 })
        }

        // 2. Generate new access token
        const newAccessToken = `mcp_at_${nanoid(64)}`
        const newExpiresAt = new Date(Date.now() + (mcpServer.accessTokenExpiration * 1000))

        // 3. Optionally rotate refresh token (for better security)
        const newRefreshToken = `mcp_rt_${nanoid(64)}`
        const newRefreshTokenExpiresAt = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days

        // 4. Update tokens in database
        await db.update(mcpOauthToken)
          .set({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresAt: newExpiresAt,
            refreshTokenExpiresAt: newRefreshTokenExpiresAt,
          })
          .where(eq(mcpOauthToken.id, existingToken.id))

        return NextResponse.json({
          access_token: newAccessToken,
          token_type: 'Bearer',
          expires_in: mcpServer.accessTokenExpiration,
          refresh_token: newRefreshToken,
          scope: existingToken.scope || mcpServer.scopesSupported,
          'mcp:server_id': mcpServer.id,
          'mcp:server_name': mcpServer.name
        })

      } catch (dbError) {
        console.error('Database error in refresh token flow:', dbError)
        return NextResponse.json({
          error: 'server_error',
          error_description: 'Token refresh failed'
        }, { status: 500 })
      }

    } else {
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: `Grant type "${grant_type}" is not supported` },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error in OAuth token endpoint:', error)
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'invalid_request', error_description: 'Token endpoint only supports POST method' },
    { status: 405 }
  )
}