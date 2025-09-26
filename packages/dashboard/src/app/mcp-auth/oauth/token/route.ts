import { NextRequest, NextResponse } from 'next/server'
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

      // TODO:
      // 1. Validate authorization code exists and is not expired
      // 2. Validate PKCE code_verifier against stored code_challenge
      // 3. Validate client_id and redirect_uri match stored values
      // 4. Generate access_token and refresh_token
      // 5. Store tokens in database
      // 6. Return token response

      return NextResponse.json({
        access_token: 'mock_access_token_' + Date.now(),
        token_type: 'Bearer',
        expires_in: mcpServer.accessTokenExpiration,
        refresh_token: 'mock_refresh_token_' + Date.now(),
        scope: mcpServer.scopesSupported,
        // OAuth 2.1 - include server info
        'mcp:server_id': mcpServer.id,
        'mcp:server_name': mcpServer.name
      })

    } else if (grant_type === 'refresh_token') {
      // Refresh Token Grant
      if (!refresh_token) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing refresh_token parameter' },
          { status: 400 }
        )
      }

      // TODO:
      // 1. Validate refresh token exists and is not expired
      // 2. Generate new access token
      // 3. Optionally rotate refresh token
      // 4. Update tokens in database

      return NextResponse.json({
        access_token: 'mock_new_access_token_' + Date.now(),
        token_type: 'Bearer',
        expires_in: mcpServer.accessTokenExpiration,
        refresh_token: refresh_token, // Could be rotated
        scope: mcpServer.scopesSupported,
        'mcp:server_id': mcpServer.id,
        'mcp:server_name': mcpServer.name
      })

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