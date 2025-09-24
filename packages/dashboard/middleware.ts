import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'

// Subdomain configuration
const SUBDOMAIN_CONFIG = {
  // Production configuration
  production: {
    wildcardDomain: '*.mcp-obs.com',
    baseDomain: 'mcp-obs.com',
    requireHttps: true,
  },

  // Development configuration
  development: {
    wildcardDomain: '*.localhost:3000',
    baseDomain: 'localhost:3000',
    requireHttps: false,
    // Use port-based routing for local dev: localhost:3001, localhost:3002, etc.
    usePortRouting: true,
    startPort: 3001,
  },

  // Reserved subdomains that cannot be used for MCP servers
  reservedSubdomains: [
    'www', 'api', 'admin', 'docs', 'status', 'blog',
    'mail', 'ftp', 'mx', 'ns1', 'ns2', 'test', 'dev',
    'dashboard', 'console', 'panel', 'support', 'help',
    'auth', 'oauth', 'login', 'logout', 'register', 'signup'
  ]
}

function extractSubdomain(host: string): string | null {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const config = isDevelopment ? SUBDOMAIN_CONFIG.development : SUBDOMAIN_CONFIG.production

  const baseDomain = config.baseDomain.replace(/:\d+$/, '') // Remove port for comparison
  const hostWithoutPort = host.replace(/:\d+$/, '')

  if (hostWithoutPort === baseDomain || hostWithoutPort === `www.${baseDomain}`) {
    return null
  }

  const subdomain = hostWithoutPort.replace(`.${baseDomain}`, '')
  return subdomain.includes('.') ? null : subdomain
}

async function getMcpServerByPort(port: number) {
  // For development port-based routing, we could map ports to slugs
  // This is a placeholder - actual implementation would depend on dev setup
  const devSlugMapping: Record<number, string> = {
    3001: 'dev1',
    3002: 'dev2',
    3003: 'dev3',
  }

  const slug = devSlugMapping[port]
  if (!slug) return null

  return getMcpServerBySlug(slug)
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const host = request.headers.get('host') || ''

  // Check for MCP server subdomain routing
  const isDevelopment = process.env.NODE_ENV === 'development'
  const config = isDevelopment ? SUBDOMAIN_CONFIG.development : SUBDOMAIN_CONFIG.production

  let mcpServer = null

  if (isDevelopment && config.usePortRouting) {
    // Development: Use port-based routing (localhost:3001, localhost:3002, etc.)
    const portMatch = host.match(/:(\d+)$/)
    if (portMatch) {
      const port = parseInt(portMatch[1])
      if (port >= config.startPort) {
        mcpServer = await getMcpServerByPort(port)
      }
    }
  } else {
    // Production: Use subdomain routing (slug.mcp-obs.com)
    const subdomain = extractSubdomain(host)
    if (subdomain && !config.reservedSubdomains.includes(subdomain)) {
      try {
        mcpServer = await getMcpServerBySlug(subdomain)
      } catch (error) {
        console.error('Error looking up MCP server:', error)
      }
    }
  }

  // Handle MCP server subdomain requests
  if (mcpServer) {
    // Add MCP server context to request
    const response = NextResponse.next()
    response.headers.set('x-mcp-server-id', mcpServer.id)
    response.headers.set('x-mcp-org-id', mcpServer.organizationId)

    // Route OAuth endpoints to MCP OAuth handlers
    if (pathname.startsWith('/.well-known/')) {
      const url = request.nextUrl.clone()
      url.pathname = `/api/mcp-oauth${pathname}`
      url.searchParams.set('mcp_server_id', mcpServer.id)
      return NextResponse.rewrite(url)
    }

    if (pathname.startsWith('/oauth/')) {
      const url = request.nextUrl.clone()
      url.pathname = `/api/mcp-oauth${pathname}`
      url.searchParams.set('mcp_server_id', mcpServer.id)
      return NextResponse.rewrite(url)
    }

    // For other MCP server requests, just pass through with context
    return response
  }

  // Check for reserved subdomains (return 404)
  const subdomain = extractSubdomain(host)
  if (subdomain && config.reservedSubdomains.includes(subdomain)) {
    return new NextResponse('Subdomain not available', { status: 404 })
  }

  // Invalid subdomain that doesn't match any MCP server
  if (subdomain && subdomain !== 'www' && !mcpServer) {
    return new NextResponse('MCP server not found', { status: 404 })
  }

  // Continue with existing platform authentication for main domain
  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/auth/sign-in',
    '/auth/sign-up',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/pricing',
    '/docs',
    '/about'
  ]

  // API routes that should be handled by their own auth
  const apiRoutes = [
    '/api/auth/',
    '/api/rpc/'
  ]

  // Check if this is a public route
  if (publicRoutes.includes(pathname) || apiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Protected routes - require authentication
  try {
    const session = await auth.api.getSession({
      headers: request.headers
    })

    if (!session?.user) {
      const url = new URL('/auth/sign-in', request.url)
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }

    // Check for organization context in URL
    const orgSlug = request.nextUrl.searchParams.get('org')
    if (orgSlug) {
      // Verify user has access to this organization
      try {
        const membership = await auth.api.getUserOrganization({
          userId: session.user.id,
          organizationSlug: orgSlug,
        })

        if (!membership) {
          // User doesn't have access to this organization, redirect to dashboard
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      } catch (error) {
        console.error('Error checking organization membership:', error)
        // On error, redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware auth error:', error)
    const url = new URL('/auth/sign-in', request.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}