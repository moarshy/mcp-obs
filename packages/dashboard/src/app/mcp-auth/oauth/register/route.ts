import { NextRequest, NextResponse } from 'next/server'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'
import { headers } from 'next/headers'
import { db, mcpOauthClient } from 'database'
import { eq } from 'drizzle-orm'

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

    // Parse client registration request (RFC 7591)
    const registrationRequest = await request.json()

    const {
      client_name,
      client_uri,
      logo_uri,
      redirect_uris,
      scope,
      grant_types = ['authorization_code', 'refresh_token'],
      response_types = ['code'],
      token_endpoint_auth_method = 'none' // PKCE-only by default
    } = registrationRequest

    // Validate required fields
    if (!client_name) {
      return NextResponse.json(
        { error: 'invalid_client_metadata', error_description: 'client_name is required' },
        { status: 400 }
      )
    }

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return NextResponse.json(
        { error: 'invalid_redirect_uri', error_description: 'At least one redirect_uri is required' },
        { status: 400 }
      )
    }

    // Validate redirect URIs
    for (const uri of redirect_uris) {
      try {
        const url = new URL(uri)
        // OAuth 2.1 security: HTTPS required in production (except localhost)
        if (!isDevelopment && url.protocol !== 'https:' && url.hostname !== 'localhost') {
          return NextResponse.json(
            { error: 'invalid_redirect_uri', error_description: 'HTTPS required for redirect URIs (except localhost)' },
            { status: 400 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'invalid_redirect_uri', error_description: `Invalid redirect URI: ${uri}` },
          { status: 400 }
        )
      }
    }

    // Validate grant types
    const supportedGrantTypes = ['authorization_code', 'refresh_token']
    for (const grantType of grant_types) {
      if (!supportedGrantTypes.includes(grantType)) {
        return NextResponse.json(
          { error: 'invalid_client_metadata', error_description: `Unsupported grant type: ${grantType}` },
          { status: 400 }
        )
      }
    }

    // Validate response types
    const supportedResponseTypes = ['code']
    for (const responseType of response_types) {
      if (!supportedResponseTypes.includes(responseType)) {
        return NextResponse.json(
          { error: 'invalid_client_metadata', error_description: `Unsupported response type: ${responseType}` },
          { status: 400 }
        )
      }
    }

    // Generate client credentials
    const clientId = `mcp_${mcpServer.slug}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const clientSecret = token_endpoint_auth_method === 'none' ? null :
      `secret_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

    // Store client in database
    const newClient = await db.insert(mcpOauthClient).values({
      clientId,
      clientSecret,
      clientName: client_name,
      clientUri: client_uri,
      logoUri: logo_uri,
      redirectUris: JSON.stringify(redirect_uris),
      scope: scope || mcpServer.scopesSupported,
      grantTypes: grant_types.join(','),
      responseTypes: response_types.join(','),
      tokenEndpointAuthMethod: token_endpoint_auth_method,
      mcpServerId: mcpServer.id,
      clientIdIssuedAt: new Date(),
      clientSecretExpiresAt: null, // Never expires for now
      disabled: false
    }).returning()

    // Build response (RFC 7591)
    const response: any = {
      client_id: clientId,
      client_name,
      client_uri,
      logo_uri,
      redirect_uris,
      scope: scope || mcpServer.scopesSupported,
      grant_types,
      response_types,
      token_endpoint_auth_method,
      client_id_issued_at: Math.floor(new Date().getTime() / 1000),

      // MCP-specific extensions
      'mcp:server_id': mcpServer.id,
      'mcp:server_name': mcpServer.name,
      'mcp:organization_id': mcpServer.organizationId
    }

    // Only include client_secret if it was generated
    if (clientSecret) {
      response.client_secret = clientSecret
      response.client_secret_expires_at = 0 // 0 means never expires
    }

    return NextResponse.json(response, {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Error in OAuth client registration:', error)
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'invalid_request', error_description: 'Client registration endpoint only supports POST method' },
    { status: 405 }
  )
}