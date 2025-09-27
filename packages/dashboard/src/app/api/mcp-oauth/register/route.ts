import { type NextRequest, NextResponse } from 'next/server'
import { registerOAuthClient, getOAuthClient, updateOAuthClient, revokeOAuthClient } from '@/lib/mcp-oauth/client-registration'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'
import { headers } from 'next/headers'

async function getMcpServerContext(request: NextRequest) {
  // Try to get MCP server ID from query parameters (set by middleware)
  const mcpServerId = request.nextUrl.searchParams.get('mcp_server_id')

  if (mcpServerId) {
    // Direct server ID from middleware
    const { db, mcpServer } = await import('database')
    const { eq } = await import('drizzle-orm')

    const servers = await db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.id, mcpServerId))
      .limit(1)

    return servers[0] || null
  }

  // Fallback: extract from subdomain
  const headerList = await headers()
  const host = headerList.get('host') || ''
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (!isDevelopment) {
    const baseDomain = 'mcp-obs.com'
    const hostWithoutPort = host.replace(/:\d+$/, '')

    if (hostWithoutPort !== baseDomain && hostWithoutPort !== `www.${baseDomain}`) {
      const subdomain = hostWithoutPort.replace(`.${baseDomain}`, '')
      if (subdomain && !subdomain.includes('.')) {
        return await getMcpServerBySlug(subdomain)
      }
    }
  }

  return null
}

// POST /oauth/register - Dynamic Client Registration (RFC 7591)
export async function POST(request: NextRequest) {
  try {
    const mcpServer = await getMcpServerContext(request)

    if (!mcpServer) {
      return NextResponse.json(
        {
          error: 'invalid_server',
          error_description: 'MCP server not found'
        },
        { status: 404 }
      )
    }

    // Parse registration request
    const registrationRequest = await request.json()

    // Register the client
    const result = await registerOAuthClient(mcpServer.id, registrationRequest)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'invalid_client_metadata',
          error_description: result.error
        },
        { status: 400 }
      )
    }

    return NextResponse.json(result.client, {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('Client registration error:', error)

    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// GET /oauth/register?client_id=... - Client Configuration Retrieval
export async function GET(request: NextRequest) {
  try {
    const mcpServer = await getMcpServerContext(request)

    if (!mcpServer) {
      return NextResponse.json(
        {
          error: 'invalid_server',
          error_description: 'MCP server not found'
        },
        { status: 404 }
      )
    }

    const clientId = request.nextUrl.searchParams.get('client_id')

    if (!clientId) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'client_id parameter is required'
        },
        { status: 400 }
      )
    }

    const client = await getOAuthClient(mcpServer.id, clientId)

    if (!client) {
      return NextResponse.json(
        {
          error: 'invalid_client',
          error_description: 'Client not found'
        },
        { status: 404 }
      )
    }

    // Return client configuration (without client_secret)
    const clientConfig = {
      client_id: client.clientId,
      client_name: client.clientName,
      client_uri: client.clientUri,
      logo_uri: client.logoUri,
      redirect_uris: JSON.parse(client.redirectUris),
      scope: client.scope,
      grant_types: client.grantTypes.split(','),
      response_types: client.responseTypes.split(','),
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      client_id_issued_at: Math.floor(client.clientIdIssuedAt.getTime() / 1000),
    }

    return NextResponse.json(clientConfig, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Client configuration retrieval error:', error)

    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// PUT /oauth/register?client_id=... - Client Configuration Update
export async function PUT(request: NextRequest) {
  try {
    const mcpServer = await getMcpServerContext(request)

    if (!mcpServer) {
      return NextResponse.json(
        {
          error: 'invalid_server',
          error_description: 'MCP server not found'
        },
        { status: 404 }
      )
    }

    const clientId = request.nextUrl.searchParams.get('client_id')

    if (!clientId) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'client_id parameter is required'
        },
        { status: 400 }
      )
    }

    // Parse update request
    const updateRequest = await request.json()

    // Update the client
    const updatedClient = await updateOAuthClient(mcpServer.id, clientId, updateRequest)

    if (!updatedClient) {
      return NextResponse.json(
        {
          error: 'invalid_client',
          error_description: 'Client not found'
        },
        { status: 404 }
      )
    }

    // Return updated client configuration
    const clientConfig = {
      client_id: updatedClient.clientId,
      client_name: updatedClient.clientName,
      client_uri: updatedClient.clientUri,
      logo_uri: updatedClient.logoUri,
      redirect_uris: JSON.parse(updatedClient.redirectUris),
      scope: updatedClient.scope,
      grant_types: updatedClient.grantTypes.split(','),
      response_types: updatedClient.responseTypes.split(','),
      token_endpoint_auth_method: updatedClient.tokenEndpointAuthMethod,
      client_id_issued_at: Math.floor(updatedClient.clientIdIssuedAt.getTime() / 1000),
    }

    return NextResponse.json(clientConfig, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Client update error:', error)

    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// DELETE /oauth/register?client_id=... - Client Revocation
export async function DELETE(request: NextRequest) {
  try {
    const mcpServer = await getMcpServerContext(request)

    if (!mcpServer) {
      return NextResponse.json(
        {
          error: 'invalid_server',
          error_description: 'MCP server not found'
        },
        { status: 404 }
      )
    }

    const clientId = request.nextUrl.searchParams.get('client_id')

    if (!clientId) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'client_id parameter is required'
        },
        { status: 400 }
      )
    }

    // Revoke the client
    const revokedClient = await revokeOAuthClient(mcpServer.id, clientId)

    if (!revokedClient) {
      return NextResponse.json(
        {
          error: 'invalid_client',
          error_description: 'Client not found'
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { message: 'Client revoked successfully' },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
        },
      }
    )
  } catch (error) {
    console.error('Client revocation error:', error)

    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'Internal server error'
      },
      { status: 500 }
    )
  }
}