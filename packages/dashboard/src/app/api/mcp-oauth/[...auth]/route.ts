import { type NextRequest, NextResponse } from 'next/server'
import { createMCPAuth } from '@/lib/auth/mcp/auth'
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

export async function GET(request: NextRequest) {
  try {
    const mcpServer = await getMcpServerContext(request)

    if (!mcpServer) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    // Create MCP-specific auth instance
    const mcpAuth = createMCPAuth(mcpServer.id, mcpServer.organizationId)

    // Handle the request using Better Auth
    const response = await mcpAuth.handler(request)
    return response
  } catch (error) {
    console.error('MCP OAuth error:', error)
    return NextResponse.json(
      { error: 'OAuth server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const mcpServer = await getMcpServerContext(request)

    if (!mcpServer) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    // Create MCP-specific auth instance
    const mcpAuth = createMCPAuth(mcpServer.id, mcpServer.organizationId)

    // Handle the request using Better Auth
    const response = await mcpAuth.handler(request)
    return response
  } catch (error) {
    console.error('MCP OAuth error:', error)
    return NextResponse.json(
      { error: 'OAuth server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const mcpServer = await getMcpServerContext(request)

    if (!mcpServer) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    // Create MCP-specific auth instance
    const mcpAuth = createMCPAuth(mcpServer.id, mcpServer.organizationId)

    // Handle the request using Better Auth
    const response = await mcpAuth.handler(request)
    return response
  } catch (error) {
    console.error('MCP OAuth error:', error)
    return NextResponse.json(
      { error: 'OAuth server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const mcpServer = await getMcpServerContext(request)

    if (!mcpServer) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    // Create MCP-specific auth instance
    const mcpAuth = createMCPAuth(mcpServer.id, mcpServer.organizationId)

    // Handle the request using Better Auth
    const response = await mcpAuth.handler(request)
    return response
  } catch (error) {
    console.error('MCP OAuth error:', error)
    return NextResponse.json(
      { error: 'OAuth server error' },
      { status: 500 }
    )
  }
}