import { type NextRequest, NextResponse } from 'next/server'

/**
 * Centralized MCP Server API Route (MCPlatform Pattern)
 *
 * This is the equivalent of MCPlatform's /api/mcpserver/[...slug]/route.ts
 * Handles all MCP server operations with proper vhost resolution
 */

async function getMcpServerConfiguration(request: NextRequest) {
  // Dynamic import to prevent bundling issues (MCPlatform pattern)
  const { db, mcpServer } = await import('database')
  const { eq } = await import('drizzle-orm')

  // Extract subdomain from Host header (the key insight from MCPlatform)
  const requestHost = request.headers.get('host') ?? new URL(request.url).host
  const requestHostname = requestHost.split(':')[0] // Remove port

  const isDevelopment = process.env.NODE_ENV === 'development'
  let subdomain = null

  if (isDevelopment) {
    // Development: extract from test.localhost format
    if (requestHostname.includes('.localhost')) {
      subdomain = requestHostname.split('.')[0] // Get first part
    }
  } else {
    // Production: extract from test.mcp-obs.com format
    const baseDomain = 'mcp-obs.com'
    if (requestHostname !== baseDomain && requestHostname !== `www.${baseDomain}`) {
      subdomain = requestHostname.split('.')[0] // Get first part
    }
  }

  if (!subdomain || subdomain.includes('.')) {
    return null
  }

  // Database lookup by subdomain slug
  const servers = await db
    .select()
    .from(mcpServer)
    .where(eq(mcpServer.slug, subdomain))
    .limit(1)

  return servers[0] || null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  try {
    const resolvedParams = await params
    const slug = resolvedParams.slug
    const action = slug[0] // e.g., 'config', 'oauth-discovery', etc.

    // Get MCP server configuration using vhost resolution
    const serverConfig = await getMcpServerConfiguration(request)

    if (!serverConfig) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    // Route to appropriate handler based on action
    switch (action) {
      case 'config':
        return NextResponse.json({ server: serverConfig })

      case 'oauth-discovery':
        return handleOAuthDiscovery(request, serverConfig)

      case 'oauth-protected-resource':
        return handleOAuthProtectedResource(request, serverConfig)

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 404 }
        )
    }

  } catch (error) {
    console.error('Error in MCP server API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// OAuth Discovery Handler
function handleOAuthDiscovery(request: NextRequest, serverConfig: any) {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const baseUrl = isDevelopment
    ? `http://${serverConfig.slug}.localhost:3000`
    : `https://${serverConfig.slug}.mcp-obs.com`

  // RFC 8414 compliant OAuth Authorization Server Metadata
  const metadata = {
    issuer: serverConfig.issuerUrl,
    authorization_endpoint: `${baseUrl}/mcp-auth/oauth/authorize`,
    token_endpoint: `${baseUrl}/mcp-auth/oauth/token`,
    userinfo_endpoint: `${baseUrl}/mcp-auth/oauth/userinfo`,
    jwks_uri: `${baseUrl}/mcp-auth/oauth/jwks`,

    // Dynamic Client Registration (RFC 7591)
    registration_endpoint: `${baseUrl}/mcp-auth/oauth/register`,

    // Token introspection and revocation (RFC 7662, RFC 7009)
    introspection_endpoint: `${baseUrl}/mcp-auth/oauth/introspect`,
    revocation_endpoint: `${baseUrl}/mcp-auth/oauth/revoke`,

    // Supported capabilities - use schema fields or sensible defaults
    scopes_supported: serverConfig.scopesSupported.split(','),
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
    'mcp:server_id': serverConfig.id,
    'mcp:organization_id': serverConfig.organizationId,
    'mcp:server_name': serverConfig.name,
    'mcp:server_description': serverConfig.description,
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
}

// OAuth Protected Resource Handler
function handleOAuthProtectedResource(request: NextRequest, serverConfig: any) {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const baseUrl = isDevelopment
    ? `http://${serverConfig.slug}.localhost:3000`
    : `https://${serverConfig.slug}.mcp-obs.com`

  // RFC 9728 compliant OAuth 2.0 Protected Resource Metadata
  const metadata = {
    // Resource identification
    resource: serverConfig.issuerUrl,

    // Authorization servers that can issue tokens for this resource
    authorization_servers: [serverConfig.issuerUrl],

    // Supported scopes for this resource
    scopes_supported: serverConfig.scopesSupported.split(','),

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
    introspection_endpoint: `${baseUrl}/mcp-auth/oauth/introspect`,

    // Revocation endpoint
    revocation_endpoint: `${baseUrl}/mcp-auth/oauth/revoke`,

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
    'mcp:server_id': serverConfig.id,
    'mcp:organization_id': serverConfig.organizationId,
    'mcp:server_name': serverConfig.name,
    'mcp:server_description': serverConfig.description,
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
}