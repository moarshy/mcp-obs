import { z } from 'zod'
import { db, mcpOauthClient, mcpOauthCode, mcpOauthToken, mcpEndUser, mcpServer } from 'database'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// OAuth 2.1 Token Request schemas
const authorizationCodeTokenRequestSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  redirect_uri: z.string().url(),
  client_id: z.string().min(1),
  client_secret: z.string().optional(),

  // PKCE parameters (mandatory for MCP)
  code_verifier: z.string().min(43).max(128),

  // Resource Indicators (RFC 8707)
  resource: z.string().url().optional(),
})

const refreshTokenRequestSchema = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: z.string().min(1),
  client_id: z.string().min(1),
  client_secret: z.string().optional(),
  scope: z.string().optional(),

  // Resource Indicators (RFC 8707)
  resource: z.string().url().optional(),
})

const clientCredentialsRequestSchema = z.object({
  grant_type: z.literal('client_credentials'),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  scope: z.string().optional(),

  // Resource Indicators (RFC 8707)
  resource: z.string().url().optional(),
})

export interface TokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token?: string
  scope?: string
  id_token?: string // OpenID Connect
  audience?: string // Resource server
}

export interface TokenErrorResponse {
  error: string
  error_description?: string
  error_uri?: string
}

export async function handleTokenRequest(
  serverId: string,
  requestBody: Record<string, any>
): Promise<{ success: true; response: TokenResponse } | { success: false; error: TokenErrorResponse; status: number }> {
  try {
    const grantType = requestBody.grant_type

    switch (grantType) {
      case 'authorization_code':
        return await handleAuthorizationCodeGrant(serverId, requestBody)
      case 'refresh_token':
        return await handleRefreshTokenGrant(serverId, requestBody)
      case 'client_credentials':
        return await handleClientCredentialsGrant(serverId, requestBody)
      default:
        return {
          success: false,
          error: {
            error: 'unsupported_grant_type',
            error_description: `Grant type '${grantType}' is not supported`
          },
          status: 400
        }
    }
  } catch (error) {
    console.error('Token request error:', error)
    return {
      success: false,
      error: {
        error: 'server_error',
        error_description: 'Internal server error'
      },
      status: 500
    }
  }
}

async function handleAuthorizationCodeGrant(
  serverId: string,
  requestBody: Record<string, any>
): Promise<{ success: true; response: TokenResponse } | { success: false; error: TokenErrorResponse; status: number }> {
  try {
    // Validate request
    const request = authorizationCodeTokenRequestSchema.parse(requestBody)

    // Get authorization code
    const codes = await db
      .select()
      .from(mcpOauthCode)
      .where(and(
        eq(mcpOauthCode.authorizationCode, request.code),
        eq(mcpOauthCode.mcpServerId, serverId)
      ))
      .limit(1)

    const authCode = codes[0]

    if (!authCode || authCode.usedAt) {
      return {
        success: false,
        error: {
          error: 'invalid_grant',
          error_description: 'Authorization code is invalid or has been used'
        },
        status: 400
      }
    }

    // Check expiration
    if (authCode.expiresAt < new Date()) {
      return {
        success: false,
        error: {
          error: 'invalid_grant',
          error_description: 'Authorization code has expired'
        },
        status: 400
      }
    }

    // Verify client
    if (authCode.clientId !== request.client_id) {
      return {
        success: false,
        error: {
          error: 'invalid_grant',
          error_description: 'Authorization code was not issued to this client'
        },
        status: 400
      }
    }

    // Verify redirect URI
    if (authCode.redirectUri !== request.redirect_uri) {
      return {
        success: false,
        error: {
          error: 'invalid_grant',
          error_description: 'redirect_uri does not match'
        },
        status: 400
      }
    }

    // Verify PKCE code verifier
    const expectedChallenge = crypto
      .createHash('sha256')
      .update(request.code_verifier)
      .digest('base64url')

    if (expectedChallenge !== authCode.codeChallenge) {
      return {
        success: false,
        error: {
          error: 'invalid_grant',
          error_description: 'PKCE code verification failed'
        },
        status: 400
      }
    }

    // Get client for authentication
    const clients = await db
      .select()
      .from(mcpOauthClient)
      .where(and(
        eq(mcpOauthClient.clientId, request.client_id),
        eq(mcpOauthClient.mcpServerId, serverId)
      ))
      .limit(1)

    const client = clients[0]
    if (!client) {
      return {
        success: false,
        error: {
          error: 'invalid_client',
          error_description: 'Client not found'
        },
        status: 401
      }
    }

    // Authenticate client if required
    if (client.tokenEndpointAuthMethod !== 'none') {
      if (!request.client_secret || request.client_secret !== client.clientSecret) {
        return {
          success: false,
          error: {
            error: 'invalid_client',
            error_description: 'Client authentication failed'
          },
          status: 401
        }
      }
    }

    // Mark authorization code as used
    await db
      .update(mcpOauthCode)
      .set({ usedAt: new Date() })
      .where(eq(mcpOauthCode.id, authCode.id))

    // Generate tokens
    const tokenResult = await generateTokens(serverId, {
      userId: authCode.userId,
      clientId: request.client_id,
      scope: authCode.scope || 'read',
      audience: request.resource,
    })

    if (!tokenResult.success) {
      return {
        success: false,
        error: {
          error: 'server_error',
          error_description: tokenResult.error
        },
        status: 500
      }
    }

    return { success: true, response: tokenResult.tokens }
  } catch (error) {
    console.error('Authorization code grant error:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return {
        success: false,
        error: {
          error: 'invalid_request',
          error_description: `${firstError.path.join('.')}: ${firstError.message}`
        },
        status: 400
      }
    }

    return {
      success: false,
      error: {
        error: 'server_error',
        error_description: 'Internal server error'
      },
      status: 500
    }
  }
}

async function handleRefreshTokenGrant(
  serverId: string,
  requestBody: Record<string, any>
): Promise<{ success: true; response: TokenResponse } | { success: false; error: TokenErrorResponse; status: number }> {
  try {
    // Validate request
    const request = refreshTokenRequestSchema.parse(requestBody)

    // Get existing token by refresh token
    const tokens = await db
      .select()
      .from(mcpOauthToken)
      .where(and(
        eq(mcpOauthToken.refreshToken, request.refresh_token),
        eq(mcpOauthToken.mcpServerId, serverId)
      ))
      .limit(1)

    const existingToken = tokens[0]

    if (!existingToken || existingToken.revokedAt) {
      return {
        success: false,
        error: {
          error: 'invalid_grant',
          error_description: 'Refresh token is invalid or has been revoked'
        },
        status: 400
      }
    }

    // Check refresh token expiration
    if (existingToken.refreshTokenExpiresAt && existingToken.refreshTokenExpiresAt < new Date()) {
      return {
        success: false,
        error: {
          error: 'invalid_grant',
          error_description: 'Refresh token has expired'
        },
        status: 400
      }
    }

    // Verify client
    if (existingToken.clientId !== request.client_id) {
      return {
        success: false,
        error: {
          error: 'invalid_grant',
          error_description: 'Refresh token was not issued to this client'
        },
        status: 400
      }
    }

    // Get client for authentication
    const clients = await db
      .select()
      .from(mcpOauthClient)
      .where(and(
        eq(mcpOauthClient.clientId, request.client_id),
        eq(mcpOauthClient.mcpServerId, serverId)
      ))
      .limit(1)

    const client = clients[0]
    if (!client) {
      return {
        success: false,
        error: {
          error: 'invalid_client',
          error_description: 'Client not found'
        },
        status: 401
      }
    }

    // Authenticate client if required
    if (client.tokenEndpointAuthMethod !== 'none') {
      if (!request.client_secret || request.client_secret !== client.clientSecret) {
        return {
          success: false,
          error: {
            error: 'invalid_client',
            error_description: 'Client authentication failed'
          },
          status: 401
        }
      }
    }

    // Determine scope (use requested scope if provided and it's a subset of original)
    let scope = existingToken.scope || 'read'
    if (request.scope) {
      const originalScopes = existingToken.scope?.split(' ') || []
      const requestedScopes = request.scope.split(' ')
      const invalidScopes = requestedScopes.filter(s => !originalScopes.includes(s))

      if (invalidScopes.length > 0) {
        return {
          success: false,
          error: {
            error: 'invalid_scope',
            error_description: 'Requested scope exceeds originally granted scope'
          },
          status: 400
        }
      }

      scope = request.scope
    }

    // Revoke old token (refresh token rotation)
    await db
      .update(mcpOauthToken)
      .set({ revokedAt: new Date() })
      .where(eq(mcpOauthToken.id, existingToken.id))

    // Generate new tokens
    const tokenResult = await generateTokens(serverId, {
      userId: existingToken.userId,
      clientId: request.client_id,
      scope,
      audience: request.resource,
    })

    if (!tokenResult.success) {
      return {
        success: false,
        error: {
          error: 'server_error',
          error_description: tokenResult.error
        },
        status: 500
      }
    }

    return { success: true, response: tokenResult.tokens }
  } catch (error) {
    console.error('Refresh token grant error:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return {
        success: false,
        error: {
          error: 'invalid_request',
          error_description: `${firstError.path.join('.')}: ${firstError.message}`
        },
        status: 400
      }
    }

    return {
      success: false,
      error: {
        error: 'server_error',
        error_description: 'Internal server error'
      },
      status: 500
    }
  }
}

async function handleClientCredentialsGrant(
  serverId: string,
  requestBody: Record<string, any>
): Promise<{ success: true; response: TokenResponse } | { success: false; error: TokenErrorResponse; status: number }> {
  try {
    // Validate request
    const request = clientCredentialsRequestSchema.parse(requestBody)

    // Get client
    const clients = await db
      .select()
      .from(mcpOauthClient)
      .where(and(
        eq(mcpOauthClient.clientId, request.client_id),
        eq(mcpOauthClient.mcpServerId, serverId)
      ))
      .limit(1)

    const client = clients[0]
    if (!client) {
      return {
        success: false,
        error: {
          error: 'invalid_client',
          error_description: 'Client not found'
        },
        status: 401
      }
    }

    // Client credentials grant requires client authentication
    if (!request.client_secret || request.client_secret !== client.clientSecret) {
      return {
        success: false,
        error: {
          error: 'invalid_client',
          error_description: 'Client authentication failed'
        },
        status: 401
      }
    }

    // Verify client supports client credentials grant
    const supportedGrantTypes = client.grantTypes.split(',')
    if (!supportedGrantTypes.includes('client_credentials')) {
      return {
        success: false,
        error: {
          error: 'unauthorized_client',
          error_description: 'Client is not authorized for client credentials grant'
        },
        status: 400
      }
    }

    // Generate tokens (no user context for client credentials)
    const tokenResult = await generateTokens(serverId, {
      userId: null, // No user for client credentials
      clientId: request.client_id,
      scope: request.scope || client.scope || 'read',
      audience: request.resource,
    })

    if (!tokenResult.success) {
      return {
        success: false,
        error: {
          error: 'server_error',
          error_description: tokenResult.error
        },
        status: 500
      }
    }

    // Client credentials tokens typically don't have refresh tokens
    const tokens = { ...tokenResult.tokens }
    delete tokens.refresh_token

    return { success: true, response: tokens }
  } catch (error) {
    console.error('Client credentials grant error:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return {
        success: false,
        error: {
          error: 'invalid_request',
          error_description: `${firstError.path.join('.')}: ${firstError.message}`
        },
        status: 400
      }
    }

    return {
      success: false,
      error: {
        error: 'server_error',
        error_description: 'Internal server error'
      },
      status: 500
    }
  }
}

async function generateTokens(
  serverId: string,
  params: {
    userId: string | null
    clientId: string
    scope: string
    audience?: string
  }
): Promise<{ success: true; tokens: TokenResponse } | { success: false; error: string }> {
  try {
    // Get server configuration
    const servers = await db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.id, serverId))
      .limit(1)

    const server = servers[0]
    if (!server) {
      return { success: false, error: 'MCP server not found' }
    }

    // Generate access token
    const accessToken = nanoid(64)
    const refreshToken = params.userId ? nanoid(64) : undefined

    // Calculate expiration
    const accessTokenExpiresAt = new Date(Date.now() + server.accessTokenExpiration * 1000)
    const refreshTokenExpiresAt = refreshToken
      ? new Date(Date.now() + server.refreshTokenExpiration * 1000)
      : null

    // Store token in database
    await db.insert(mcpOauthToken).values({
      accessToken,
      refreshToken: refreshToken || null,
      tokenType: 'Bearer',
      scope: params.scope,
      expiresAt: accessTokenExpiresAt,
      refreshTokenExpiresAt,
      clientId: params.clientId,
      userId: params.userId,
      mcpServerId: serverId,
    })

    // Prepare response
    const tokenResponse: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: server.accessTokenExpiration,
      scope: params.scope,
    }

    if (refreshToken) {
      tokenResponse.refresh_token = refreshToken
    }

    if (params.audience) {
      tokenResponse.audience = params.audience
    }

    return { success: true, tokens: tokenResponse }
  } catch (error) {
    console.error('Token generation error:', error)
    return { success: false, error: 'Failed to generate tokens' }
  }
}

export async function revokeToken(
  serverId: string,
  token: string,
  tokenTypeHint?: 'access_token' | 'refresh_token'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Try to find and revoke the token
    const result = await db
      .update(mcpOauthToken)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(mcpOauthToken.mcpServerId, serverId),
        tokenTypeHint === 'refresh_token'
          ? eq(mcpOauthToken.refreshToken, token)
          : eq(mcpOauthToken.accessToken, token)
      ))
      .returning()

    if (result.length === 0 && tokenTypeHint !== 'refresh_token') {
      // Try refresh token if access token wasn't found
      const refreshResult = await db
        .update(mcpOauthToken)
        .set({ revokedAt: new Date() })
        .where(and(
          eq(mcpOauthToken.mcpServerId, serverId),
          eq(mcpOauthToken.refreshToken, token)
        ))
        .returning()

      if (refreshResult.length === 0) {
        // Token not found, but still return success per RFC 7009
        return { success: true }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Token revocation error:', error)
    return { success: false, error: 'Failed to revoke token' }
  }
}