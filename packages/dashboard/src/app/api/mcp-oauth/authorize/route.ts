import { type NextRequest, NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { validateAuthorizationRequest, generateAuthorizationCode, checkExistingConsent, buildAuthorizationResponse } from '@/lib/mcp-oauth/authorization-flow'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'
import { createMCPAuth } from '@/lib/auth/mcp/auth'
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

// GET /oauth/authorize - OAuth 2.1 Authorization Endpoint
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const params: Record<string, string> = {}

    searchParams.forEach((value, key) => {
      params[key] = value
    })

    // Validate authorization request
    const validation = await validateAuthorizationRequest(mcpServer.id, params)

    if (!validation.success) {
      // Build error response URL
      const redirectUri = params.redirect_uri
      if (redirectUri) {
        const errorUrl = new URL(redirectUri)
        errorUrl.searchParams.set('error', validation.error)
        if (validation.errorDescription) {
          errorUrl.searchParams.set('error_description', validation.errorDescription)
        }
        if (params.state) {
          errorUrl.searchParams.set('state', params.state)
        }
        return NextResponse.redirect(errorUrl.toString())
      }

      return NextResponse.json(
        {
          error: validation.error,
          error_description: validation.errorDescription
        },
        { status: 400 }
      )
    }

    const { context } = validation

    // Check if user is already authenticated for this MCP server
    const mcpAuth = createMCPAuth(mcpServer.id, mcpServer.organizationId)

    let session
    try {
      session = await mcpAuth.api.getSession({
        headers: await headers()
      })
    } catch (error) {
      session = null
    }

    // If user is not authenticated, redirect to login
    if (!session?.user) {
      // Store authorization request in session/state and redirect to login
      const loginUrl = new URL(`${request.nextUrl.origin}/mcp-auth/login`)
      loginUrl.searchParams.set('mcp_server_id', mcpServer.id)

      // Store authorization parameters for after login
      Object.entries(params).forEach(([key, value]) => {
        loginUrl.searchParams.set(key, value)
      })

      return NextResponse.redirect(loginUrl.toString())
    }

    // Check existing consent
    const requestedScopes = context.request.scope?.split(' ') || ['read']
    const consentCheck = await checkExistingConsent(
      mcpServer.id,
      session.user.id,
      context.request.client_id,
      requestedScopes
    )

    // If user has already consented and no new consent is required
    if (consentCheck.hasConsent && !consentCheck.requiresNewConsent) {
      // Generate authorization code directly
      const codeResult = await generateAuthorizationCode(context, session.user.id, consentCheck.approvedScopes)

      if (!codeResult.success) {
        const errorUrl = buildAuthorizationResponse(context, { approved: false, error: 'server_error' })
        return NextResponse.redirect(errorUrl)
      }

      const successUrl = buildAuthorizationResponse(context, { approved: true, code: codeResult.code })
      return NextResponse.redirect(successUrl)
    }

    // Redirect to consent screen
    const consentUrl = new URL(`${request.nextUrl.origin}/mcp-auth/consent`)
    consentUrl.searchParams.set('mcp_server_id', mcpServer.id)

    // Pass through authorization parameters
    Object.entries(params).forEach(([key, value]) => {
      consentUrl.searchParams.set(key, value)
    })

    return NextResponse.redirect(consentUrl.toString())

  } catch (error) {
    console.error('Authorization endpoint error:', error)

    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// POST /oauth/authorize - Handle consent form submission
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

    const formData = await request.formData()
    const action = formData.get('action') as string
    const clientId = formData.get('client_id') as string
    const redirectUri = formData.get('redirect_uri') as string
    const state = formData.get('state') as string
    const codeChallenge = formData.get('code_challenge') as string
    const codeChallengeMethod = formData.get('code_challenge_method') as string
    const scope = formData.get('scope') as string
    const rememberConsent = formData.get('remember_consent') === 'on'

    // Reconstruct authorization context
    const context = {
      serverId: mcpServer.id,
      organizationId: mcpServer.organizationId,
      request: {
        response_type: 'code' as const,
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod as 'S256',
      },
      client: null, // We'll fetch this if needed
    }

    // Check authentication
    const mcpAuth = createMCPAuth(mcpServer.id, mcpServer.organizationId)

    let session
    try {
      session = await mcpAuth.api.getSession({
        headers: await headers()
      })
    } catch (error) {
      session = null
    }

    if (!session?.user) {
      const errorUrl = buildAuthorizationResponse(context, { approved: false, error: 'access_denied' })
      return NextResponse.redirect(errorUrl)
    }

    if (action === 'deny') {
      // User denied consent
      const errorUrl = buildAuthorizationResponse(context, { approved: false, error: 'access_denied' })
      return NextResponse.redirect(errorUrl)
    }

    if (action === 'approve') {
      // User approved consent
      const approvedScopes = scope.split(' ')

      // Store consent
      const { storeUserConsent } = await import('@/lib/mcp-oauth/authorization-flow')
      await storeUserConsent(
        mcpServer.id,
        session.user.id,
        clientId,
        approvedScopes,
        true,
        rememberConsent
      )

      // Generate authorization code
      const codeResult = await generateAuthorizationCode(context, session.user.id, approvedScopes)

      if (!codeResult.success) {
        const errorUrl = buildAuthorizationResponse(context, { approved: false, error: 'server_error' })
        return NextResponse.redirect(errorUrl)
      }

      const successUrl = buildAuthorizationResponse(context, { approved: true, code: codeResult.code })
      return NextResponse.redirect(successUrl)
    }

    // Invalid action
    const errorUrl = buildAuthorizationResponse(context, { approved: false, error: 'invalid_request' })
    return NextResponse.redirect(errorUrl)

  } catch (error) {
    console.error('Authorization consent error:', error)

    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'Internal server error'
      },
      { status: 500 }
    )
  }
}