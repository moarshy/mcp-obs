import type { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createMCPAuth } from '@/lib/auth/mcp/auth'

/**
 * Better Auth MCP Instance Endpoint
 * Following MCPlatform pattern: /mcp-oidc/auth/*
 *
 * This handles all Better Auth operations for MCP end-users:
 * - Email/password authentication
 * - Social OAuth (Google, GitHub)
 * - Session management
 * - User registration
 */

async function getMcpServerContext(host: string) {
  const { db, mcpServer } = await import('database')
  const { eq } = await import('drizzle-orm')

  const isDevelopment = process.env.NODE_ENV === 'development'
  let subdomain = null

  if (isDevelopment) {
    if (host.includes('.localhost')) {
      subdomain = host.split('.')[0]
    }
  } else {
    const baseDomain = 'mcp-obs.com'
    if (host !== baseDomain && host !== `www.${baseDomain}`) {
      subdomain = host.split('.')[0]
    }
  }

  if (!subdomain) return null

  const servers = await db
    .select()
    .from(mcpServer)
    .where(eq(mcpServer.slug, subdomain))
    .limit(1)

  return servers[0] || null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ auth: string[] }> }
) {
  return handleAuthRequest(request, await params, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ auth: string[] }> }
) {
  return handleAuthRequest(request, await params, 'POST')
}

async function handleAuthRequest(
  request: NextRequest,
  params: { auth: string[] },
  method: 'GET' | 'POST'
) {
  try {
    const headerList = await headers()
    const host = headerList.get('host') || 'localhost:3000'
    const hostWithoutPort = host.split(':')[0]

    // Get MCP server context from subdomain
    const mcpServer = await getMcpServerContext(hostWithoutPort)
    if (!mcpServer) {
      return new Response('MCP server not found', { status: 404 })
    }

    if (!mcpServer.enabled) {
      return new Response('Authentication disabled for this MCP server', { status: 403 })
    }

    // Create Better Auth instance for this MCP server
    const mcpAuth = createMCPAuth(mcpServer.id, mcpServer.organizationId)

    // Set the base URL for this specific MCP server
    const isDevelopment = process.env.NODE_ENV === 'development'
    const baseUrl = isDevelopment
      ? `http://${host}`
      : `https://${mcpServer.slug}.mcp-obs.com`

    // Update the auth instance baseURL dynamically
    mcpAuth.options.baseURL = `${baseUrl}/mcp-oidc/auth`

    // Forward request directly to Better Auth handler
    const response = await mcpAuth.handler(request)

    const authPath = `/${params.auth.join('/')}`
    console.log(`MCP Auth [${method}] ${authPath} - Status: ${response.status}`)

    return response

  } catch (error) {
    console.error('MCP auth handler error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}