import { db, mcpOauthToken, mcpEndUser, mcpOauthClient, mcpServer } from 'database'
import { eq, and } from 'drizzle-orm'

export interface TokenIntrospectionResponse {
  active: boolean
  scope?: string
  client_id?: string
  username?: string
  token_type?: string
  exp?: number
  iat?: number
  nbf?: number
  sub?: string
  aud?: string
  iss?: string
  jti?: string

  // MCP-specific extensions
  'mcp:server_id'?: string
  'mcp:organization_id'?: string
  'mcp:user_id'?: string
}

export interface TokenValidationResult {
  valid: boolean
  token?: {
    id: string
    accessToken: string
    tokenType: string
    scope?: string
    expiresAt: Date
    clientId: string
    userId?: string
    mcpServerId: string
  }
  user?: {
    id: string
    email: string
    name?: string
    image?: string
  }
  client?: {
    id: string
    clientId: string
    clientName: string
    clientUri?: string
  }
  server?: {
    id: string
    name: string
    slug: string
    organizationId: string
    issuerUrl: string
  }
  error?: string
}

export async function validateAccessToken(
  serverId: string,
  accessToken: string
): Promise<TokenValidationResult> {
  try {
    // Get token with related data
    const tokenData = await db
      .select({
        token: mcpOauthToken,
        user: mcpEndUser,
        client: mcpOauthClient,
        server: mcpServer,
      })
      .from(mcpOauthToken)
      .leftJoin(mcpEndUser, eq(mcpOauthToken.userId, mcpEndUser.id))
      .leftJoin(mcpOauthClient, eq(mcpOauthToken.clientId, mcpOauthClient.clientId))
      .leftJoin(mcpServer, eq(mcpOauthToken.mcpServerId, mcpServer.id))
      .where(and(
        eq(mcpOauthToken.accessToken, accessToken),
        eq(mcpOauthToken.mcpServerId, serverId)
      ))
      .limit(1)

    const data = tokenData[0]

    if (!data || !data.token) {
      return { valid: false, error: 'Token not found' }
    }

    // Check if token is revoked
    if (data.token.revokedAt) {
      return { valid: false, error: 'Token has been revoked' }
    }

    // Check if token has expired
    if (data.token.expiresAt < new Date()) {
      return { valid: false, error: 'Token has expired' }
    }

    // Check if client is disabled
    if (data.client?.disabled) {
      return { valid: false, error: 'Client has been disabled' }
    }

    return {
      valid: true,
      token: {
        id: data.token.id,
        accessToken: data.token.accessToken,
        tokenType: data.token.tokenType,
        scope: data.token.scope || undefined,
        expiresAt: data.token.expiresAt,
        clientId: data.token.clientId,
        userId: data.token.userId || undefined,
        mcpServerId: data.token.mcpServerId,
      },
      user: data.user ? {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || undefined,
        image: data.user.image || undefined,
      } : undefined,
      client: data.client ? {
        id: data.client.id,
        clientId: data.client.clientId,
        clientName: data.client.clientName,
        clientUri: data.client.clientUri || undefined,
      } : undefined,
      server: data.server ? {
        id: data.server.id,
        name: data.server.name,
        slug: data.server.slug,
        organizationId: data.server.organizationId,
        issuerUrl: data.server.issuerUrl,
      } : undefined,
    }
  } catch (error) {
    console.error('Token validation error:', error)
    return { valid: false, error: 'Internal server error' }
  }
}

export async function introspectToken(
  serverId: string,
  token: string,
  tokenTypeHint?: 'access_token' | 'refresh_token'
): Promise<TokenIntrospectionResponse> {
  try {
    // Try to validate as access token first (or if hinted)
    if (!tokenTypeHint || tokenTypeHint === 'access_token') {
      const validation = await validateAccessToken(serverId, token)

      if (validation.valid && validation.token) {
        return {
          active: true,
          scope: validation.token.scope,
          client_id: validation.token.clientId,
          username: validation.user?.email,
          token_type: validation.token.tokenType,
          exp: Math.floor(validation.token.expiresAt.getTime() / 1000),
          iat: Math.floor(new Date(validation.token.id).getTime() / 1000), // Using token ID creation time as issued at
          sub: validation.token.userId || validation.token.clientId,
          aud: validation.server?.issuerUrl,
          iss: validation.server?.issuerUrl,
          jti: validation.token.id,

          // MCP-specific extensions
          'mcp:server_id': validation.server?.id,
          'mcp:organization_id': validation.server?.organizationId,
          'mcp:user_id': validation.token.userId,
        }
      }
    }

    // Try to validate as refresh token
    if (!tokenTypeHint || tokenTypeHint === 'refresh_token') {
      const refreshTokenData = await db
        .select({
          token: mcpOauthToken,
          user: mcpEndUser,
          client: mcpOauthClient,
          server: mcpServer,
        })
        .from(mcpOauthToken)
        .leftJoin(mcpEndUser, eq(mcpOauthToken.userId, mcpEndUser.id))
        .leftJoin(mcpOauthClient, eq(mcpOauthToken.clientId, mcpOauthClient.clientId))
        .leftJoin(mcpServer, eq(mcpOauthToken.mcpServerId, mcpServer.id))
        .where(and(
          eq(mcpOauthToken.refreshToken, token),
          eq(mcpOauthToken.mcpServerId, serverId)
        ))
        .limit(1)

      const data = refreshTokenData[0]

      if (data && data.token && !data.token.revokedAt) {
        // Check refresh token expiration
        const isExpired = data.token.refreshTokenExpiresAt && data.token.refreshTokenExpiresAt < new Date()

        if (!isExpired) {
          return {
            active: true,
            scope: data.token.scope,
            client_id: data.token.clientId,
            username: data.user?.email,
            token_type: 'refresh_token',
            exp: data.token.refreshTokenExpiresAt
              ? Math.floor(data.token.refreshTokenExpiresAt.getTime() / 1000)
              : undefined,
            iat: Math.floor(new Date(data.token.id).getTime() / 1000),
            sub: data.token.userId || data.token.clientId,
            aud: data.server?.issuerUrl,
            iss: data.server?.issuerUrl,
            jti: data.token.id,

            // MCP-specific extensions
            'mcp:server_id': data.server?.id,
            'mcp:organization_id': data.server?.organizationId,
            'mcp:user_id': data.token.userId,
          }
        }
      }
    }

    // Token not found or inactive
    return { active: false }
  } catch (error) {
    console.error('Token introspection error:', error)
    return { active: false }
  }
}

export async function checkTokenScope(
  serverId: string,
  accessToken: string,
  requiredScope: string
): Promise<{ authorized: boolean; scopes: string[]; error?: string }> {
  try {
    const validation = await validateAccessToken(serverId, accessToken)

    if (!validation.valid) {
      return {
        authorized: false,
        scopes: [],
        error: validation.error
      }
    }

    const tokenScopes = validation.token?.scope?.split(' ') || []

    // Check if required scope is present
    const hasRequiredScope = requiredScope.split(' ').every(scope =>
      tokenScopes.includes(scope)
    )

    return {
      authorized: hasRequiredScope,
      scopes: tokenScopes,
    }
  } catch (error) {
    console.error('Scope check error:', error)
    return {
      authorized: false,
      scopes: [],
      error: 'Internal server error'
    }
  }
}

// Helper function for MCP Server SDK integration
export async function extractUserFromToken(
  serverId: string,
  accessToken: string
): Promise<{
  user?: {
    id: string
    email: string
    name?: string
    image?: string
  }
  client?: {
    id: string
    name: string
  }
  scopes: string[]
  error?: string
}> {
  const validation = await validateAccessToken(serverId, accessToken)

  if (!validation.valid) {
    return {
      scopes: [],
      error: validation.error
    }
  }

  return {
    user: validation.user,
    client: validation.client ? {
      id: validation.client.clientId,
      name: validation.client.clientName
    } : undefined,
    scopes: validation.token?.scope?.split(' ') || [],
  }
}

// Generate WWW-Authenticate header for 401 responses
export function generateWWWAuthenticateHeader(
  serverId: string,
  realm?: string,
  error?: string,
  errorDescription?: string,
  scope?: string
): string {
  const server = db
    .select({ issuerUrl: mcpServer.issuerUrl })
    .from(mcpServer)
    .where(eq(mcpServer.id, serverId))
    .limit(1)

  let header = `Bearer realm="${realm || 'MCP Server'}"`

  if (error) {
    header += `, error="${error}"`
  }

  if (errorDescription) {
    header += `, error_description="${errorDescription}"`
  }

  if (scope) {
    header += `, scope="${scope}"`
  }

  // Add resource metadata URL as per MCP specification
  header += `, resource_metadata="${process.env.NODE_ENV === 'development'
    ? `http://localhost:3000/.well-known/oauth-protected-resource?mcp_server=${serverId}`
    : `https://mcp-server.mcp-obs.com/.well-known/oauth-protected-resource`}"`

  return header
}