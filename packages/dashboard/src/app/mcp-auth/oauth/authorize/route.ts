import { type NextRequest, NextResponse } from 'next/server'
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

    // Check if user is already authenticated with Better Auth
    try {
      const { createMCPAuth } = await import('@/lib/auth/mcp/auth')
      const mcpAuth = createMCPAuth(mcpServer.id, mcpServer.organizationId)

      const session = await mcpAuth.api.getSession({
        headers: request.headers
      })

      if (session?.user) {
        // User is authenticated, proceed with consent and authorization code generation
        return await handleAuthenticatedUser({
          mcpServer,
          params,
          isDevelopment,
          host,
          user: session.user
        })
      }
    } catch (authError) {
      console.log('No active session found, redirecting to login:', authError.message)
    }

    // User needs to authenticate first - redirect to MCP-OIDC login
    const baseUrl = isDevelopment
      ? `http://${host}`
      : `https://${mcpServer.slug}.mcp-obs.com`

    const loginUrl = new URL(`${baseUrl}/mcp-oidc/login`)

    // Forward all OAuth parameters to login page
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        loginUrl.searchParams.set(key, value)
      }
    })

    console.log('Redirecting to MCP-OIDC login:', loginUrl.toString())
    return NextResponse.redirect(loginUrl.toString())

  } catch (error) {
    console.error('Error in OAuth authorize endpoint:', error)
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleAuthenticatedUser({
  mcpServer,
  params,
  isDevelopment,
  host,
  user
}: {
  mcpServer: any
  params: any
  isDevelopment: boolean
  host: string
  user: any
}) {
  try {
    const { nanoid } = await import('nanoid')
    const { db, mcpOauthCode, mcpServerUser, mcpServerSession } = await import('database')
    const { eq, and } = await import('drizzle-orm')

    // Generate authorization code following MCPlatform pattern
    const authorizationCode = nanoid(64)

    // Implement user capture following MCPlatform pattern
    // Check if custom MCP user exists by email
    let mcpUser = null
    if (user.email) {
      const [existingUser] = await db.select()
        .from(mcpServerUser)
        .where(eq(mcpServerUser.email, user.email))
        .limit(1)

      if (existingUser) {
        mcpUser = existingUser
      } else {
        // Create custom MCP user for business logic
        const [newUser] = await db.insert(mcpServerUser).values({
          email: user.email,
          upstreamSub: user.id, // Link to Better Auth user
          profileData: {
            name: user.name,
            image: user.image,
            emailVerified: user.emailVerified
          }
        }).returning()

        mcpUser = newUser

        // Create MCP server session linking user to organization
        await db.insert(mcpServerSession).values({
          mcpServerSlug: mcpServer.slug,
          mcpServerUserId: mcpUser.id,
          sessionData: {
            betterAuthUserId: user.id, // Bridge to auth system
            organizationId: mcpServer.organizationId
          }
        })
      }
    }

    await db.insert(mcpOauthCode).values({
      authorizationCode,
      codeChallenge: params.code_challenge,
      codeChallengeMethod: params.code_challenge_method,
      clientId: params.client_id,
      userId: user.id, // Use actual Better Auth user ID
      mcpServerId: mcpServer.id,
      redirectUri: params.redirect_uri,
      scope: params.scope || 'read,write',
      state: params.state,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    })

    console.log('Generated authorization code for authenticated user')

    // Redirect back to client application with authorization code
    const redirectUrl = new URL(params.redirect_uri)
    redirectUrl.searchParams.set('code', authorizationCode)
    if (params.state) {
      redirectUrl.searchParams.set('state', params.state)
    }

    console.log('Redirecting to client with authorization code:', redirectUrl.toString())
    return NextResponse.redirect(redirectUrl.toString())

  } catch (error) {
    console.error('Error handling authenticated user:', error)
    return NextResponse.json({
      error: 'server_error',
      error_description: 'Failed to generate authorization code'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Handle authorization form submission (consent page)
  return NextResponse.json({
    error: 'not_implemented',
    error_description: 'POST method for authorization endpoint not yet implemented'
  }, { status: 501 })
}