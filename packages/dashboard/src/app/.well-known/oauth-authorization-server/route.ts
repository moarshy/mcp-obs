import { NextRequest, NextResponse } from 'next/server'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Get MCP server context from middleware or request
    const mcpServerId = request.nextUrl.searchParams.get('mcp_server_id')
    const headerList = await headers()
    const host = headerList.get('host') || ''

    let mcpServer = null

    if (mcpServerId) {
      // Direct server ID from query parameter
      const { db, mcpServer: mcpServerTable } = await import('database')
      const { eq } = await import('drizzle-orm')

      const servers = await db
        .select()
        .from(mcpServerTable)
        .where(eq(mcpServerTable.id, mcpServerId))
        .limit(1)

      mcpServer = servers[0]
    } else {
      // Try to extract from subdomain
      const isDevelopment = process.env.NODE_ENV === 'development'

      if (!isDevelopment) {
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
    }

    if (!mcpServer) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    // Generate base URL for this MCP server
    const isDevelopment = process.env.NODE_ENV === 'development'
    const baseUrl = isDevelopment
      ? `http://localhost:3000?mcp_server=${mcpServer.id}`
      : `https://${mcpServer.slug}.mcp-obs.com`

    // RFC 8414 compliant OAuth Authorization Server Metadata
    const metadata = {
      issuer: mcpServer.issuerUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
      jwks_uri: `${baseUrl}/oauth/jwks`,

      // Dynamic Client Registration (RFC 7591)
      registration_endpoint: `${baseUrl}/oauth/register`,

      // Token introspection and revocation (RFC 7662, RFC 7009)
      introspection_endpoint: `${baseUrl}/oauth/introspect`,
      revocation_endpoint: `${baseUrl}/oauth/revoke`,

      // Supported capabilities
      scopes_supported: mcpServer.scopesSupported.split(','),
      response_types_supported: mcpServer.responseTypesSupported.split(','),
      grant_types_supported: mcpServer.grantTypesSupported.split(','),

      // PKCE support (mandatory for MCP)
      code_challenge_methods_supported: mcpServer.codeChallengeMethodsSupported.split(','),

      // Client authentication methods
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none' // For PKCE-only clients
      ],

      // Token endpoint auth signing alg values
      token_endpoint_auth_signing_alg_values_supported: ['RS256', 'HS256'],

      // Supported subject types
      subject_types_supported: ['public'],

      // ID Token signing algorithms
      id_token_signing_alg_values_supported: ['RS256'],

      // Claims supported
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'auth_time',
        'email',
        'email_verified',
        'name',
        'preferred_username'
      ],

      // Service documentation
      service_documentation: 'https://mcp-obs.com/docs/oauth',
      op_policy_uri: 'https://mcp-obs.com/privacy',
      op_tos_uri: 'https://mcp-obs.com/terms',

      // Request parameter supported
      request_parameter_supported: false,
      request_uri_parameter_supported: false,
      require_request_uri_registration: false,

      // Additional OAuth 2.1 features
      resource_parameter_supported: true, // RFC 8707 Resource Indicators

      // MCP-specific extensions
      'mcp:server_id': mcpServer.id,
      'mcp:organization_id': mcpServer.organizationId,
      'mcp:server_name': mcpServer.name,
      'mcp:server_description': mcpServer.description,
    }

    return NextResponse.json(metadata, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('Error in OAuth authorization server metadata:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}