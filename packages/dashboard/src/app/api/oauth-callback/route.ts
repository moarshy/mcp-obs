import { type NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { nanoid } from 'nanoid'

/**
 * Centralized OAuth Callback Handler
 * Following MCPlatform's user capture pattern
 *
 * This endpoint handles callbacks from all OAuth providers (Google, GitHub, etc.)
 * and implements the sophisticated user capture and deduplication logic.
 */

async function getMcpServerByHost(host: string) {
  const { db, mcpServer } = await import('database')
  const { eq } = await import('drizzle-orm')

  const isDevelopment = process.env.NODE_ENV === 'development'
  let subdomain = null

  if (isDevelopment) {
    // Development: extract from test.localhost format
    if (host.includes('.localhost')) {
      subdomain = host.split('.')[0]
    }
  } else {
    // Production: extract from test.mcp-obs.com format
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

export async function GET(request: NextRequest) {
  try {
    const headerList = await headers()
    const host = headerList.get('host') || 'localhost:3000'
    const hostWithoutPort = host.split(':')[0]

    // Get MCP server configuration from subdomain
    const mcpServer = await getMcpServerByHost(hostWithoutPort)
    if (!mcpServer) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    // Extract OAuth callback parameters
    const url = new URL(request.url)
    const authorizationCode = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    // Handle OAuth error responses
    if (error) {
      console.error('OAuth error:', error)
      const errorDescription = url.searchParams.get('error_description')
      return NextResponse.redirect(
        `${url.origin}/mcp-auth/error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`
      )
    }

    if (!authorizationCode || !state) {
      return NextResponse.json(
        { error: 'Missing required OAuth parameters' },
        { status: 400 }
      )
    }

    // Perform user capture flow following MCPlatform pattern
    const result = await performUserCapture({
      mcpServer,
      authorizationCode,
      state,
      request,
    })

    if (!result.success) {
      console.error('User capture failed:', result.error)
      return NextResponse.redirect(
        `${url.origin}/mcp-auth/error?error=server_error&description=${encodeURIComponent(result.error)}`
      )
    }

    // Redirect back to client application with authorization code
    const { authCode, redirectUri } = result
    const redirectUrl = new URL(redirectUri)
    redirectUrl.searchParams.set('code', authCode)
    redirectUrl.searchParams.set('state', state)

    return NextResponse.redirect(redirectUrl.toString())

  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface UserCaptureParams {
  mcpServer: any
  authorizationCode: string
  state: string
  request: NextRequest
}

async function performUserCapture({
  mcpServer,
  authorizationCode,
  state,
  request,
}: UserCaptureParams) {
  const {
    db,
    mcpServerUser,
    upstreamOAuthTokens,
    mcpServerSession,
    mcpOauthCode
  } = await import('database')
  const { eq, and, sql } = await import('drizzle-orm')

  try {
    // Step 1: Look up authorization session by state
    // TODO: Implement authorization session storage
    // For now, we'll mock this part
    const mockAuthSession = {
      id: 'mock_session',
      clientId: 'mock_client',
      redirectUri: 'http://localhost:8080/callback',
      scope: 'read,write',
      codeChallenge: 'mock_challenge',
      codeChallengeMethod: 'S256',
    }

    // Step 2: Exchange authorization code for access token with OAuth provider
    // This would typically be done with Google, GitHub, etc. APIs
    // For demonstration, we'll mock the token exchange
    const tokenData = {
      access_token: `mock_access_token_${nanoid(32)}`,
      refresh_token: `mock_refresh_token_${nanoid(32)}`,
      expires_in: 3600,
      token_type: 'Bearer',
    }

    // Step 3: Fetch user profile from OAuth provider
    // This would typically call userinfo endpoints
    const profileData = {
      sub: `oauth_user_${nanoid(16)}`,
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
      email_verified: true,
    }

    const email = profileData.email
    const upstreamSub = profileData.sub

    console.log('OAuth Profile Data:', {
      sub: upstreamSub,
      email,
      name: profileData.name,
      mcpServer: mcpServer.slug,
    })

    // Step 4: Organization-scoped user deduplication (MCPlatform pattern)
    const existingUserQuery = db
      .selectDistinct({ userId: mcpServerUser.id })
      .from(mcpServerUser)
      .leftJoin(
        mcpServerSession,
        eq(mcpServerSession.mcpServerUserId, mcpServerUser.id)
      )
      .leftJoin(
        { servers: await import('database').then(m => m.mcpServer) },
        eq(sql`servers.slug`, mcpServerSession.mcpServerSlug)
      )
      .where(
        and(
          // CRITICAL: Organization boundary enforcement
          eq(sql`servers.organization_id`, mcpServer.organizationId),

          // Flexible user matching - email OR upstream_sub
          email && upstreamSub
            ? sql`(${mcpServerUser.email} = ${email} OR ${mcpServerUser.upstreamSub} = ${upstreamSub})`
            : email
              ? eq(mcpServerUser.email, email)
              : eq(mcpServerUser.upstreamSub, upstreamSub)
        )
      )
      .limit(1)

    const [existingUser] = await existingUserQuery
    let mcpServerUserId: string

    // Step 5A: Update existing user
    if (existingUser) {
      mcpServerUserId = existingUser.userId
      console.log('Found existing MCP user:', mcpServerUserId)

      await db
        .update(mcpServerUser)
        .set({
          email: email || undefined,
          upstreamSub: upstreamSub || undefined,
          profileData: profileData,
          updatedAt: new Date(),
        })
        .where(eq(mcpServerUser.id, mcpServerUserId))

      console.log('Updated existing user profile')
    }
    // Step 5B: Create new user
    else {
      console.log('Creating new MCP user:', { email, upstreamSub })

      const [newUser] = await db
        .insert(mcpServerUser)
        .values({
          email: email,
          upstreamSub: upstreamSub,
          profileData: profileData,
        })
        .returning()

      mcpServerUserId = newUser.id
      console.log('Created new MCP user:', mcpServerUserId)
    }

    // Step 6: Store upstream OAuth tokens
    await db
      .insert(upstreamOAuthTokens)
      .values({
        mcpServerUserId: mcpServerUserId,
        oauthConfigId: `google_${mcpServer.id}`, // This would be dynamic based on provider
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in
          ? Date.now() + tokenData.expires_in * 1000
          : null,
      })
      .onConflictDoUpdate({
        target: [upstreamOAuthTokens.mcpServerUserId, upstreamOAuthTokens.oauthConfigId],
        set: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: tokenData.expires_in
            ? Date.now() + tokenData.expires_in * 1000
            : null,
          updatedAt: Date.now(),
        },
      })

    console.log('Stored/updated upstream OAuth tokens')

    // Step 7: Create MCP server session
    const [session] = await db
      .insert(mcpServerSession)
      .values({
        mcpServerSlug: mcpServer.slug,
        mcpServerUserId: mcpServerUserId,
        sessionData: {
          oauthProvider: 'google', // This would be dynamic
          loginMethod: 'oauth_callback',
          userAgent: request.headers.get('user-agent'),
          oauthConfigId: `google_${mcpServer.id}`,
        },
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
      })
      .returning()

    console.log('Created MCP server session:', session.mcpServerSessionId)

    // Step 8: Generate authorization code for client
    const authCode = nanoid(64)
    await db
      .insert(mcpOauthCode)
      .values({
        authorizationCode: authCode,
        codeChallenge: mockAuthSession.codeChallenge,
        codeChallengeMethod: mockAuthSession.codeChallengeMethod,
        clientId: mockAuthSession.clientId,
        userId: mcpServerUserId,
        mcpServerId: mcpServer.id,
        redirectUri: mockAuthSession.redirectUri,
        scope: mockAuthSession.scope,
        state: state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      })

    console.log('Generated authorization code for client application')

    // Log user capture event for auditing
    console.log('User Capture Event:', {
      action: existingUser ? 'user_updated' : 'user_created',
      mcpServerUserId: mcpServerUserId,
      organizationId: mcpServer.organizationId,
      oauthProvider: 'google',
      timestamp: Date.now(),
      sessionId: session.mcpServerSessionId,
    })

    return {
      success: true,
      authCode,
      redirectUri: mockAuthSession.redirectUri,
    }

  } catch (error) {
    console.error('User capture error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}