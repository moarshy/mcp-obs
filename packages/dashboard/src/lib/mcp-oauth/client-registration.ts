import { z } from 'zod'
import { db, mcpOauthClient, mcpServer } from 'database'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import crypto from 'crypto'

// RFC 7591 Dynamic Client Registration request schema
const clientRegistrationSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  client_uri: z.string().url().optional(),
  logo_uri: z.string().url().optional(),
  redirect_uris: z.array(z.string().url()).min(1, 'At least one redirect URI is required'),
  scope: z.string().optional(),
  grant_types: z.array(z.enum(['authorization_code', 'refresh_token'])).optional(),
  response_types: z.array(z.enum(['code'])).optional(),
  token_endpoint_auth_method: z.enum(['client_secret_basic', 'client_secret_post', 'none']).optional(),
  contacts: z.array(z.string().email()).optional(),
  tos_uri: z.string().url().optional(),
  policy_uri: z.string().url().optional(),
  jwks_uri: z.string().url().optional(),
  software_id: z.string().optional(),
  software_version: z.string().optional(),
})

// RFC 7591 Client Registration Response
interface ClientRegistrationResponse {
  client_id: string
  client_secret?: string
  client_id_issued_at: number
  client_secret_expires_at?: number
  client_name: string
  client_uri?: string
  logo_uri?: string
  redirect_uris: string[]
  scope?: string
  grant_types: string[]
  response_types: string[]
  token_endpoint_auth_method: string
  registration_access_token?: string
  registration_client_uri?: string
}

export async function registerOAuthClient(
  serverId: string,
  registrationRequest: unknown
): Promise<{ success: true; client: ClientRegistrationResponse } | { success: false; error: string }> {
  try {
    // Validate request
    const validatedRequest = clientRegistrationSchema.parse(registrationRequest)

    // Verify MCP server exists
    const servers = await db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.id, serverId))
      .limit(1)

    const server = servers[0]
    if (!server) {
      return { success: false, error: 'MCP server not found' }
    }

    // Generate client credentials
    const clientId = `mcp_${nanoid(24)}`
    const needsSecret = validatedRequest.token_endpoint_auth_method !== 'none'
    const clientSecret = needsSecret ? crypto.randomBytes(32).toString('hex') : null

    // Validate redirect URIs
    for (const redirectUri of validatedRequest.redirect_uris) {
      if (!isValidRedirectUri(redirectUri)) {
        return { success: false, error: `Invalid redirect URI: ${redirectUri}` }
      }
    }

    // Create client in database
    const newClient = await db.insert(mcpOauthClient).values({
      clientId,
      clientSecret,
      clientName: validatedRequest.client_name,
      clientUri: validatedRequest.client_uri || null,
      logoUri: validatedRequest.logo_uri || null,
      redirectUris: JSON.stringify(validatedRequest.redirect_uris),
      scope: validatedRequest.scope || server.scopesSupported,
      grantTypes: validatedRequest.grant_types?.join(',') || 'authorization_code,refresh_token',
      responseTypes: validatedRequest.response_types?.join(',') || 'code',
      tokenEndpointAuthMethod: validatedRequest.token_endpoint_auth_method || 'client_secret_basic',
      mcpServerId: serverId,
    }).returning()

    const client = newClient[0]

    // Prepare response according to RFC 7591
    const response: ClientRegistrationResponse = {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.clientIdIssuedAt.getTime() / 1000),
      client_name: client.clientName,
      redirect_uris: JSON.parse(client.redirectUris),
      grant_types: client.grantTypes.split(','),
      response_types: client.responseTypes.split(','),
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
    }

    // Add optional fields
    if (client.clientSecret) {
      response.client_secret = client.clientSecret
      // Client secrets don't expire by default (can be configured)
      if (client.clientSecretExpiresAt) {
        response.client_secret_expires_at = Math.floor(client.clientSecretExpiresAt.getTime() / 1000)
      } else {
        response.client_secret_expires_at = 0 // Never expires
      }
    }

    if (client.clientUri) response.client_uri = client.clientUri
    if (client.logoUri) response.logo_uri = client.logoUri
    if (client.scope) response.scope = client.scope

    // TODO: Add registration access token for client management
    // This would allow clients to update their registration later

    return { success: true, client: response }
  } catch (error) {
    console.error('Client registration error:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return { success: false, error: `${firstError.path.join('.')}: ${firstError.message}` }
    }

    return { success: false, error: 'Internal server error' }
  }
}

export async function getOAuthClient(serverId: string, clientId: string) {
  const clients = await db
    .select()
    .from(mcpOauthClient)
    .where(and(
      eq(mcpOauthClient.clientId, clientId),
      eq(mcpOauthClient.mcpServerId, serverId)
    ))
    .limit(1)

  return clients[0] || null
}

export async function listOAuthClients(serverId: string) {
  return await db
    .select()
    .from(mcpOauthClient)
    .where(eq(mcpOauthClient.mcpServerId, serverId))
    .orderBy(mcpOauthClient.createdAt)
}

export async function updateOAuthClient(
  serverId: string,
  clientId: string,
  updates: Partial<z.infer<typeof clientRegistrationSchema>>
) {
  const validatedUpdates = clientRegistrationSchema.partial().parse(updates)

  const updateData: any = {
    updatedAt: new Date(),
  }

  if (validatedUpdates.client_name) updateData.clientName = validatedUpdates.client_name
  if (validatedUpdates.client_uri !== undefined) updateData.clientUri = validatedUpdates.client_uri
  if (validatedUpdates.logo_uri !== undefined) updateData.logoUri = validatedUpdates.logo_uri
  if (validatedUpdates.redirect_uris) updateData.redirectUris = JSON.stringify(validatedUpdates.redirect_uris)
  if (validatedUpdates.scope !== undefined) updateData.scope = validatedUpdates.scope
  if (validatedUpdates.grant_types) updateData.grantTypes = validatedUpdates.grant_types.join(',')
  if (validatedUpdates.response_types) updateData.responseTypes = validatedUpdates.response_types.join(',')
  if (validatedUpdates.token_endpoint_auth_method) updateData.tokenEndpointAuthMethod = validatedUpdates.token_endpoint_auth_method

  const updatedClients = await db
    .update(mcpOauthClient)
    .set(updateData)
    .where(and(
      eq(mcpOauthClient.clientId, clientId),
      eq(mcpOauthClient.mcpServerId, serverId)
    ))
    .returning()

  return updatedClients[0] || null
}

export async function revokeOAuthClient(serverId: string, clientId: string) {
  // Soft delete by disabling the client
  const disabledClients = await db
    .update(mcpOauthClient)
    .set({
      disabled: true,
      updatedAt: new Date()
    })
    .where(and(
      eq(mcpOauthClient.clientId, clientId),
      eq(mcpOauthClient.mcpServerId, serverId)
    ))
    .returning()

  return disabledClients[0] || null
}

function isValidRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri)

    // Security requirements for redirect URIs
    // 1. Must be HTTPS in production (except localhost)
    if (process.env.NODE_ENV === 'production') {
      if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
        return false
      }
    }

    // 2. No fragments allowed in redirect URIs
    if (url.hash) {
      return false
    }

    // 3. Common redirect URI patterns are allowed
    const allowedSchemes = ['https:', 'http:', 'mcp:', 'app:']
    if (!allowedSchemes.includes(url.protocol)) {
      return false
    }

    return true
  } catch {
    return false
  }
}

export { clientRegistrationSchema }