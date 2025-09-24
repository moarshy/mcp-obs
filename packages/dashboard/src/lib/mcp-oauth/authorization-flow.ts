import { z } from 'zod'
import { db, mcpOauthClient, mcpOauthCode, mcpEndUser, mcpOauthConsent } from 'database'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import crypto from 'crypto'

// OAuth 2.1 Authorization Request schema with PKCE (RFC 7636)
const authorizationRequestSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),

  // PKCE parameters (mandatory for MCP)
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),

  // Resource Indicators (RFC 8707) - optional
  resource: z.string().url().optional(),

  // Additional parameters
  prompt: z.enum(['none', 'login', 'consent', 'select_account']).optional(),
  max_age: z.number().int().min(0).optional(),
  login_hint: z.string().email().optional(),
})

export interface AuthorizationRequest extends z.infer<typeof authorizationRequestSchema> {}

export interface AuthorizationContext {
  serverId: string
  organizationId: string
  request: AuthorizationRequest
  client: any
  user?: any
}

export async function validateAuthorizationRequest(
  serverId: string,
  params: Record<string, string | string[]>
): Promise<{ success: true; context: AuthorizationContext } | { success: false; error: string; errorDescription?: string }> {
  try {
    // Convert query parameters to proper types
    const requestParams = {
      response_type: params.response_type as string,
      client_id: params.client_id as string,
      redirect_uri: params.redirect_uri as string,
      scope: params.scope as string,
      state: params.state as string,
      code_challenge: params.code_challenge as string,
      code_challenge_method: params.code_challenge_method as string,
      resource: params.resource as string,
      prompt: params.prompt as string,
      max_age: params.max_age ? parseInt(params.max_age as string) : undefined,
      login_hint: params.login_hint as string,
    }

    // Remove undefined values
    const cleanParams = Object.fromEntries(
      Object.entries(requestParams).filter(([_, value]) => value !== undefined)
    )

    // Validate request parameters
    const validatedRequest = authorizationRequestSchema.parse(cleanParams)

    // Verify client exists and is active
    const clients = await db
      .select()
      .from(mcpOauthClient)
      .where(and(
        eq(mcpOauthClient.clientId, validatedRequest.client_id),
        eq(mcpOauthClient.mcpServerId, serverId),
        eq(mcpOauthClient.disabled, false)
      ))
      .limit(1)

    const client = clients[0]
    if (!client) {
      return {
        success: false,
        error: 'invalid_client',
        errorDescription: 'Client not found or disabled'
      }
    }

    // Verify redirect URI matches registered URIs
    const registeredUris = JSON.parse(client.redirectUris) as string[]
    if (!registeredUris.includes(validatedRequest.redirect_uri)) {
      return {
        success: false,
        error: 'invalid_request',
        errorDescription: 'redirect_uri does not match registered URIs'
      }
    }

    // Verify supported response type
    const supportedResponseTypes = client.responseTypes.split(',')
    if (!supportedResponseTypes.includes(validatedRequest.response_type)) {
      return {
        success: false,
        error: 'unsupported_response_type',
        errorDescription: 'response_type not supported by client'
      }
    }

    // Validate PKCE code challenge
    if (!isValidCodeChallenge(validatedRequest.code_challenge)) {
      return {
        success: false,
        error: 'invalid_request',
        errorDescription: 'Invalid code_challenge format'
      }
    }

    // Validate requested scopes
    const requestedScopes = validatedRequest.scope?.split(' ') || ['read']
    const { db: database, mcpServer } = await import('database')

    const servers = await database
      .select({ scopesSupported: mcpServer.scopesSupported, organizationId: mcpServer.organizationId })
      .from(mcpServer)
      .where(eq(mcpServer.id, serverId))
      .limit(1)

    const server = servers[0]
    if (!server) {
      return {
        success: false,
        error: 'server_error',
        errorDescription: 'MCP server configuration not found'
      }
    }

    const supportedScopes = server.scopesSupported.split(',')
    const invalidScopes = requestedScopes.filter(scope => !supportedScopes.includes(scope))

    if (invalidScopes.length > 0) {
      return {
        success: false,
        error: 'invalid_scope',
        errorDescription: `Unsupported scopes: ${invalidScopes.join(', ')}`
      }
    }

    return {
      success: true,
      context: {
        serverId,
        organizationId: server.organizationId,
        request: validatedRequest,
        client,
      }
    }
  } catch (error) {
    console.error('Authorization request validation error:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return {
        success: false,
        error: 'invalid_request',
        errorDescription: `${firstError.path.join('.')}: ${firstError.message}`
      }
    }

    return {
      success: false,
      error: 'server_error',
      errorDescription: 'Internal server error'
    }
  }
}

export async function generateAuthorizationCode(
  context: AuthorizationContext,
  userId: string,
  approvedScopes: string[]
): Promise<{ success: true; code: string } | { success: false; error: string }> {
  try {
    // Generate secure authorization code
    const authorizationCode = nanoid(32)

    // Store authorization code with PKCE parameters
    await db.insert(mcpOauthCode).values({
      authorizationCode,
      codeChallenge: context.request.code_challenge,
      codeChallengeMethod: context.request.code_challenge_method,
      clientId: context.request.client_id,
      userId,
      mcpServerId: context.serverId,
      redirectUri: context.request.redirect_uri,
      scope: approvedScopes.join(' '),
      state: context.request.state || null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    })

    return { success: true, code: authorizationCode }
  } catch (error) {
    console.error('Authorization code generation error:', error)
    return { success: false, error: 'Failed to generate authorization code' }
  }
}

export async function checkExistingConsent(
  serverId: string,
  userId: string,
  clientId: string,
  requestedScopes: string[]
): Promise<{
  hasConsent: boolean
  approvedScopes: string[]
  requiresNewConsent: boolean
}> {
  try {
    const consents = await db
      .select()
      .from(mcpOauthConsent)
      .where(and(
        eq(mcpOauthConsent.userId, userId),
        eq(mcpOauthConsent.clientId, clientId),
        eq(mcpOauthConsent.mcpServerId, serverId),
        eq(mcpOauthConsent.granted, true)
      ))
      .limit(1)

    const consent = consents[0]

    if (!consent) {
      return {
        hasConsent: false,
        approvedScopes: [],
        requiresNewConsent: true
      }
    }

    // Check if consent has expired
    if (consent.expiresAt && consent.expiresAt < new Date()) {
      return {
        hasConsent: false,
        approvedScopes: [],
        requiresNewConsent: true
      }
    }

    const approvedScopes = consent.scope.split(' ')

    // Check if all requested scopes are already approved
    const newScopes = requestedScopes.filter(scope => !approvedScopes.includes(scope))

    return {
      hasConsent: newScopes.length === 0,
      approvedScopes,
      requiresNewConsent: newScopes.length > 0
    }
  } catch (error) {
    console.error('Error checking existing consent:', error)
    return {
      hasConsent: false,
      approvedScopes: [],
      requiresNewConsent: true
    }
  }
}

export async function storeUserConsent(
  serverId: string,
  userId: string,
  clientId: string,
  approvedScopes: string[],
  granted: boolean,
  rememberConsent: boolean = false
): Promise<void> {
  try {
    // Remove any existing consent for this user-client combination
    await db
      .delete(mcpOauthConsent)
      .where(and(
        eq(mcpOauthConsent.userId, userId),
        eq(mcpOauthConsent.clientId, clientId),
        eq(mcpOauthConsent.mcpServerId, serverId)
      ))

    // Store new consent
    await db.insert(mcpOauthConsent).values({
      userId,
      clientId,
      mcpServerId: serverId,
      scope: approvedScopes.join(' '),
      granted,
      expiresAt: rememberConsent ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days if not remembered
    })
  } catch (error) {
    console.error('Error storing user consent:', error)
    throw new Error('Failed to store consent')
  }
}

export function buildAuthorizationResponse(
  context: AuthorizationContext,
  result: { approved: true; code: string } | { approved: false; error: string }
): string {
  const url = new URL(context.request.redirect_uri)

  if (result.approved) {
    url.searchParams.set('code', result.code)
    if (context.request.state) {
      url.searchParams.set('state', context.request.state)
    }
  } else {
    url.searchParams.set('error', result.error)
    if (context.request.state) {
      url.searchParams.set('state', context.request.state)
    }
  }

  return url.toString()
}

function isValidCodeChallenge(codeChallenge: string): boolean {
  // Code challenge must be 43-128 characters long and base64url encoded
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/
  return (
    codeChallenge.length >= 43 &&
    codeChallenge.length <= 128 &&
    base64UrlRegex.test(codeChallenge)
  )
}

export function generateState(): string {
  return nanoid(32)
}

export function generateCodeVerifier(): string {
  return nanoid(128)
}

export function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest()
  return hash.toString('base64url')
}