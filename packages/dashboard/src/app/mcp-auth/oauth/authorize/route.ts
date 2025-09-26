import { NextRequest, NextResponse } from 'next/server'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
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
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    if (!mcpServer.enabled) {
      return NextResponse.json(
        { error: 'Authentication is disabled for this MCP server' },
        { status: 403 }
      )
    }

    // Get OAuth parameters
    const url = new URL(request.url)
    const params = {
      client_id: url.searchParams.get('client_id'),
      redirect_uri: url.searchParams.get('redirect_uri'),
      response_type: url.searchParams.get('response_type'),
      scope: url.searchParams.get('scope'),
      state: url.searchParams.get('state'),
      code_challenge: url.searchParams.get('code_challenge'),
      code_challenge_method: url.searchParams.get('code_challenge_method'),
    }

    // Basic OAuth parameter validation
    if (!params.client_id) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing client_id parameter' },
        { status: 400 }
      )
    }

    if (!params.redirect_uri) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing redirect_uri parameter' },
        { status: 400 }
      )
    }

    if (params.response_type !== 'code') {
      return NextResponse.json(
        { error: 'unsupported_response_type', error_description: 'Only "code" response type is supported' },
        { status: 400 }
      )
    }

    // PKCE validation (required for OAuth 2.1)
    if (!params.code_challenge) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing code_challenge parameter (PKCE required)' },
        { status: 400 }
      )
    }

    if (params.code_challenge_method !== 'S256') {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Only S256 code_challenge_method is supported' },
        { status: 400 }
      )
    }

    // TODO: Validate client_id against registered clients in database
    // TODO: Validate redirect_uri against registered URIs

    // For now, return a simple authorization form
    // In a full implementation, this would render an authorization page
    const baseUrl = isDevelopment
      ? `http://${host}`
      : `https://${mcpServer.slug}.mcp-obs.com`

    return NextResponse.json({
      message: 'OAuth Authorization Endpoint',
      server: {
        id: mcpServer.id,
        name: mcpServer.name,
        slug: mcpServer.slug
      },
      parameters: params,
      next_steps: [
        'User authentication required',
        'User consent required',
        'Authorization code generation',
        'Redirect to client with code'
      ],
      auth_methods: {
        password: mcpServer.enablePasswordAuth,
        google: mcpServer.enableGoogleAuth,
        github: mcpServer.enableGithubAuth
      },
      // This would normally redirect to a login/consent page
      authorization_url: `${baseUrl}/mcp-auth/login?${url.searchParams.toString()}`
    })

  } catch (error) {
    console.error('Error in OAuth authorize endpoint:', error)
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Handle authorization form submission
  return NextResponse.json({
    error: 'not_implemented',
    error_description: 'POST method for authorization endpoint not yet implemented'
  }, { status: 501 })
}