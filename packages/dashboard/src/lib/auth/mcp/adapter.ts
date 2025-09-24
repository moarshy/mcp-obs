import {
  db,
  mcpEndUser,
  mcpOauthClient,
  mcpOauthToken,
  mcpOauthConsent,
  mcpOauthCode,
  McpEndUser,
  McpOauthClient,
  McpOauthToken,
  McpOauthConsent,
  McpOauthCode
} from 'database'
import { eq, and } from 'drizzle-orm'
import type { Adapter } from 'better-auth'

export function createMCPDrizzleAdapter(serverId: string): Adapter {
  return {
    id: 'drizzle-mcp',

    // User operations (mapped to MCP end users)
    async createUser(user) {
      const newUser = await db.insert(mcpEndUser).values({
        mcpServerId: serverId,
        email: user.email,
        name: user.name || null,
        image: user.image || null,
        emailVerified: user.emailVerified || false,
        // Map social provider IDs
        googleId: user.accounts?.find(a => a.providerId === 'google')?.accountId || null,
        githubId: user.accounts?.find(a => a.providerId === 'github')?.accountId || null,
      }).returning()

      return {
        id: newUser[0].id,
        email: newUser[0].email,
        name: newUser[0].name,
        image: newUser[0].image,
        emailVerified: newUser[0].emailVerified,
        createdAt: newUser[0].createdAt,
        updatedAt: newUser[0].updatedAt,
      }
    },

    async getUserById(id) {
      const users = await db
        .select()
        .from(mcpEndUser)
        .where(and(eq(mcpEndUser.id, id), eq(mcpEndUser.mcpServerId, serverId)))
        .limit(1)

      const user = users[0]
      if (!user) return null

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    },

    async getUserByEmail(email) {
      const users = await db
        .select()
        .from(mcpEndUser)
        .where(and(eq(mcpEndUser.email, email), eq(mcpEndUser.mcpServerId, serverId)))
        .limit(1)

      const user = users[0]
      if (!user) return null

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    },

    async updateUser(id, updates) {
      const updatedUsers = await db
        .update(mcpEndUser)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(and(eq(mcpEndUser.id, id), eq(mcpEndUser.mcpServerId, serverId)))
        .returning()

      const user = updatedUsers[0]
      if (!user) return null

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    },

    async deleteUser(id) {
      await db
        .delete(mcpEndUser)
        .where(and(eq(mcpEndUser.id, id), eq(mcpEndUser.mcpServerId, serverId)))
    },

    // OAuth Client operations
    async createOAuthClient(client) {
      const newClient = await db.insert(mcpOauthClient).values({
        clientId: client.clientId,
        clientSecret: client.clientSecret || null,
        clientName: client.clientName,
        clientUri: client.clientUri || null,
        logoUri: client.logoUri || null,
        redirectUris: JSON.stringify(client.redirectUris || []),
        scope: client.scope || null,
        grantTypes: client.grantTypes || 'authorization_code,refresh_token',
        responseTypes: client.responseTypes || 'code',
        tokenEndpointAuthMethod: client.tokenEndpointAuthMethod || 'client_secret_basic',
        mcpServerId: serverId,
      }).returning()

      return {
        id: newClient[0].id,
        clientId: newClient[0].clientId,
        clientSecret: newClient[0].clientSecret,
        clientName: newClient[0].clientName,
        clientUri: newClient[0].clientUri,
        logoUri: newClient[0].logoUri,
        redirectUris: JSON.parse(newClient[0].redirectUris),
        scope: newClient[0].scope,
        grantTypes: newClient[0].grantTypes,
        responseTypes: newClient[0].responseTypes,
        tokenEndpointAuthMethod: newClient[0].tokenEndpointAuthMethod,
        createdAt: newClient[0].createdAt,
        updatedAt: newClient[0].updatedAt,
      }
    },

    async getOAuthClientById(clientId) {
      const clients = await db
        .select()
        .from(mcpOauthClient)
        .where(and(eq(mcpOauthClient.clientId, clientId), eq(mcpOauthClient.mcpServerId, serverId)))
        .limit(1)

      const client = clients[0]
      if (!client) return null

      return {
        id: client.id,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        clientName: client.clientName,
        clientUri: client.clientUri,
        logoUri: client.logoUri,
        redirectUris: JSON.parse(client.redirectUris),
        scope: client.scope,
        grantTypes: client.grantTypes,
        responseTypes: client.responseTypes,
        tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      }
    },

    // OAuth Token operations
    async createOAuthToken(token) {
      const newToken = await db.insert(mcpOauthToken).values({
        accessToken: token.accessToken,
        refreshToken: token.refreshToken || null,
        tokenType: token.tokenType || 'Bearer',
        scope: token.scope || null,
        expiresAt: token.expiresAt,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt || null,
        clientId: token.clientId,
        userId: token.userId,
        mcpServerId: serverId,
        codeChallenge: token.codeChallenge || null,
        codeChallengeMethod: token.codeChallengeMethod || null,
      }).returning()

      return {
        id: newToken[0].id,
        accessToken: newToken[0].accessToken,
        refreshToken: newToken[0].refreshToken,
        tokenType: newToken[0].tokenType,
        scope: newToken[0].scope,
        expiresAt: newToken[0].expiresAt,
        refreshTokenExpiresAt: newToken[0].refreshTokenExpiresAt,
        clientId: newToken[0].clientId,
        userId: newToken[0].userId,
        createdAt: newToken[0].createdAt,
      }
    },

    async getOAuthTokenByAccessToken(accessToken) {
      const tokens = await db
        .select()
        .from(mcpOauthToken)
        .where(and(
          eq(mcpOauthToken.accessToken, accessToken),
          eq(mcpOauthToken.mcpServerId, serverId)
        ))
        .limit(1)

      const token = tokens[0]
      if (!token) return null

      return {
        id: token.id,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenType: token.tokenType,
        scope: token.scope,
        expiresAt: token.expiresAt,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        clientId: token.clientId,
        userId: token.userId,
        createdAt: token.createdAt,
      }
    },

    async deleteOAuthToken(accessToken) {
      await db
        .delete(mcpOauthToken)
        .where(and(
          eq(mcpOauthToken.accessToken, accessToken),
          eq(mcpOauthToken.mcpServerId, serverId)
        ))
    },

    // OAuth Authorization Code operations
    async createOAuthCode(code) {
      const newCode = await db.insert(mcpOauthCode).values({
        authorizationCode: code.code,
        codeChallenge: code.codeChallenge,
        codeChallengeMethod: code.codeChallengeMethod,
        clientId: code.clientId,
        userId: code.userId,
        mcpServerId: serverId,
        redirectUri: code.redirectUri,
        scope: code.scope || null,
        state: code.state || null,
        expiresAt: code.expiresAt,
      }).returning()

      return {
        id: newCode[0].id,
        code: newCode[0].authorizationCode,
        codeChallenge: newCode[0].codeChallenge,
        codeChallengeMethod: newCode[0].codeChallengeMethod,
        clientId: newCode[0].clientId,
        userId: newCode[0].userId,
        redirectUri: newCode[0].redirectUri,
        scope: newCode[0].scope,
        state: newCode[0].state,
        expiresAt: newCode[0].expiresAt,
        createdAt: newCode[0].createdAt,
      }
    },

    async getOAuthCodeByCode(code) {
      const codes = await db
        .select()
        .from(mcpOauthCode)
        .where(and(
          eq(mcpOauthCode.authorizationCode, code),
          eq(mcpOauthCode.mcpServerId, serverId)
        ))
        .limit(1)

      const authCode = codes[0]
      if (!authCode || authCode.usedAt) return null

      return {
        id: authCode.id,
        code: authCode.authorizationCode,
        codeChallenge: authCode.codeChallenge,
        codeChallengeMethod: authCode.codeChallengeMethod,
        clientId: authCode.clientId,
        userId: authCode.userId,
        redirectUri: authCode.redirectUri,
        scope: authCode.scope,
        state: authCode.state,
        expiresAt: authCode.expiresAt,
        createdAt: authCode.createdAt,
      }
    },

    async markOAuthCodeAsUsed(code) {
      await db
        .update(mcpOauthCode)
        .set({ usedAt: new Date() })
        .where(and(
          eq(mcpOauthCode.authorizationCode, code),
          eq(mcpOauthCode.mcpServerId, serverId)
        ))
    },

    // OAuth Consent operations
    async createOAuthConsent(consent) {
      const newConsent = await db.insert(mcpOauthConsent).values({
        userId: consent.userId,
        clientId: consent.clientId,
        mcpServerId: serverId,
        scope: consent.scope,
        granted: consent.granted,
        expiresAt: consent.expiresAt || null,
      }).returning()

      return {
        id: newConsent[0].id,
        userId: newConsent[0].userId,
        clientId: newConsent[0].clientId,
        scope: newConsent[0].scope,
        granted: newConsent[0].granted,
        expiresAt: newConsent[0].expiresAt,
        createdAt: newConsent[0].createdAt,
        updatedAt: newConsent[0].updatedAt,
      }
    },

    async getOAuthConsent(userId, clientId) {
      const consents = await db
        .select()
        .from(mcpOauthConsent)
        .where(and(
          eq(mcpOauthConsent.userId, userId),
          eq(mcpOauthConsent.clientId, clientId),
          eq(mcpOauthConsent.mcpServerId, serverId)
        ))
        .limit(1)

      const consent = consents[0]
      if (!consent) return null

      return {
        id: consent.id,
        userId: consent.userId,
        clientId: consent.clientId,
        scope: consent.scope,
        granted: consent.granted,
        expiresAt: consent.expiresAt,
        createdAt: consent.createdAt,
        updatedAt: consent.updatedAt,
      }
    },
  }
}