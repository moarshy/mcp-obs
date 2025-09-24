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

    // Generate authorization server URL
    const isDevelopment = process.env.NODE_ENV === 'development'
    const baseUrl = isDevelopment
      ? `http://localhost:3000?mcp_server=${mcpServer.id}`
      : `https://${mcpServer.slug}.mcp-obs.com`

    // RFC 9728 compliant OAuth 2.0 Protected Resource Metadata
    const metadata = {
      // Resource identification
      resource: mcpServer.issuerUrl,

      // Authorization servers that can issue tokens for this resource
      authorization_servers: [mcpServer.issuerUrl],

      // Supported scopes for this resource
      scopes_supported: mcpServer.scopesSupported.split(','),

      // Bearer token methods supported
      bearer_methods_supported: [
        'header', // Authorization: Bearer <token>
        'body',   // In request body as access_token parameter
        'query'   // In query string as access_token parameter
      ],

      // Resource server capabilities
      resource_documentation: `${baseUrl}/docs`,
      resource_policy_uri: 'https://mcp-obs.com/privacy',

      // Token introspection endpoint for this resource
      introspection_endpoint: `${baseUrl}/oauth/introspect`,

      // Revocation endpoint
      revocation_endpoint: `${baseUrl}/oauth/revoke`,

      // Supported token introspection authentication methods
      introspection_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none'
      ],

      // Supported token revocation authentication methods
      revocation_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none'
      ],

      // Resource-specific information
      resource_signing_alg_values_supported: ['RS256', 'HS256'],

      // MCP-specific extensions
      'mcp:server_id': mcpServer.id,
      'mcp:organization_id': mcpServer.organizationId,
      'mcp:server_name': mcpServer.name,
      'mcp:server_description': mcpServer.description,
      'mcp:resource_version': '1.0',

      // Supported OAuth features
      'oauth:resource_indicators_supported': true, // RFC 8707
      'oauth:incremental_authz_supported': false,
      'oauth:dpop_supported': false,
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
    console.error('Error in OAuth protected resource metadata:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}