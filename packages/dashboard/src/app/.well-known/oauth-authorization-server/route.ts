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
    }

    if (!mcpServer) {
      // In development, provide a generic OAuth discovery response
      // In production, this should only be accessible via subdomains
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          error: 'No MCP server specified',
          message: 'Access this endpoint with ?mcp_server_id=<id> parameter or via subdomain in production',
          example_url: 'http://localhost:3000/.well-known/oauth-authorization-server?mcp_server_id=<server-id>'
        }, { status: 404 })
      }

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

      // Supported capabilities - use schema fields or sensible defaults
      scopes_supported: mcpServer.scopesSupported.split(','),
      response_types_supported: ['code'], // OAuth 2.1 standard
      grant_types_supported: ['authorization_code', 'refresh_token'], // OAuth 2.1 standard

      // PKCE support (mandatory for OAuth 2.1)
      code_challenge_methods_supported: ['S256'], // OAuth 2.1 requires S256

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