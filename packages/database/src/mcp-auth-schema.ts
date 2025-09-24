import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// MCP Servers with OAuth configuration
export const mcpServer = pgTable('mcp_server', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // Global slug for subdomain
  description: text('description'),
  logoUrl: text('logo_url'),
  organizationId: text('organization_id').notNull(), // References auth-schema organization

  // OAuth Configuration
  issuerUrl: text('issuer_url').notNull(), // https://slug.mcp-obs.com
  authorizationEndpoint: text('authorization_endpoint').notNull(),
  tokenEndpoint: text('token_endpoint').notNull(),
  registrationEndpoint: text('registration_endpoint').notNull(),
  introspectionEndpoint: text('introspection_endpoint'),
  revocationEndpoint: text('revocation_endpoint'),

  // Supported capabilities
  scopesSupported: text('scopes_supported').notNull().default('read,write'),
  grantTypesSupported: text('grant_types_supported').notNull().default('authorization_code,refresh_token'),
  responseTypesSupported: text('response_types_supported').notNull().default('code'),
  codeChallengeMethodsSupported: text('code_challenge_methods_supported').notNull().default('S256'),

  // Settings
  accessTokenExpiration: integer('access_token_expiration').notNull().default(7200), // 2 hours
  refreshTokenExpiration: integer('refresh_token_expiration').notNull().default(604800), // 7 days
  requirePkce: boolean('require_pkce').notNull().default(true),
  enabled: boolean('enabled').notNull().default(true),
  allowRegistration: boolean('allow_registration').notNull().default(true),
  requireEmailVerification: boolean('require_email_verification').notNull().default(false),

  // Authentication methods
  enablePasswordAuth: boolean('enable_password_auth').notNull().default(true),
  enableGoogleAuth: boolean('enable_google_auth').notNull().default(true),
  enableGithubAuth: boolean('enable_github_auth').notNull().default(true),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// OAuth Clients (dynamically registered)
export const mcpOauthClient = pgTable('mcp_oauth_client', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret'), // NULL for PKCE-only clients

  // Client Metadata (RFC 7591)
  clientName: text('client_name').notNull(),
  clientUri: text('client_uri'),
  logoUri: text('logo_uri'),
  redirectUris: text('redirect_uris').notNull(), // JSON array
  scope: text('scope'),
  grantTypes: text('grant_types').notNull().default('authorization_code,refresh_token'),
  responseTypes: text('response_types').notNull().default('code'),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull().default('client_secret_basic'),

  // Registration info
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id, { onDelete: 'cascade' }),
  clientIdIssuedAt: timestamp('client_id_issued_at').notNull().defaultNow(),
  clientSecretExpiresAt: timestamp('client_secret_expires_at'), // NULL = never expires

  // Management
  disabled: boolean('disabled').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// End Users (per MCP server context)
export const mcpEndUser = pgTable('mcp_end_user', {
  id: uuid('id').defaultRandom().primaryKey(),
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id, { onDelete: 'cascade' }),

  // User Identity
  email: text('email').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  image: text('image'),

  // Authentication Methods
  passwordHash: text('password_hash'),
  googleId: text('google_id'),
  githubId: text('github_id'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// OAuth Access Tokens
export const mcpOauthToken = pgTable('mcp_oauth_token', {
  id: uuid('id').defaultRandom().primaryKey(),
  accessToken: text('access_token').notNull().unique(),
  refreshToken: text('refresh_token').unique(),
  tokenType: text('token_type').notNull().default('Bearer'),

  // Token Metadata
  scope: text('scope'),
  expiresAt: timestamp('expires_at').notNull(),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),

  // Relationships
  clientId: text('client_id').notNull().references(() => mcpOauthClient.clientId, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => mcpEndUser.id, { onDelete: 'cascade' }),
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id, { onDelete: 'cascade' }),

  // OAuth Flow Metadata
  codeChallenge: text('code_challenge'),
  codeChallengeMethod: text('code_challenge_method'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
})

// OAuth Consent Records
export const mcpOauthConsent = pgTable('mcp_oauth_consent', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => mcpEndUser.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => mcpOauthClient.clientId, { onDelete: 'cascade' }),
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id, { onDelete: 'cascade' }),

  // Consent Details
  scope: text('scope').notNull(),
  granted: boolean('granted').notNull(),
  expiresAt: timestamp('expires_at'), // NULL = permanent consent

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// OAuth Authorization Codes (temporary)
export const mcpOauthCode = pgTable('mcp_oauth_code', {
  id: uuid('id').defaultRandom().primaryKey(),
  authorizationCode: text('authorization_code').notNull().unique(),

  // PKCE
  codeChallenge: text('code_challenge').notNull(),
  codeChallengeMethod: text('code_challenge_method').notNull(),

  // OAuth Flow
  clientId: text('client_id').notNull().references(() => mcpOauthClient.clientId, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => mcpEndUser.id, { onDelete: 'cascade' }),
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  scope: text('scope'),
  state: text('state'),

  // Expiration
  expiresAt: timestamp('expires_at').notNull(), // Short-lived: 10 minutes
  usedAt: timestamp('used_at'), // NULL = unused

  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type McpServer = typeof mcpServer.$inferSelect
export type McpOauthClient = typeof mcpOauthClient.$inferSelect
export type McpEndUser = typeof mcpEndUser.$inferSelect
export type McpOauthToken = typeof mcpOauthToken.$inferSelect
export type McpOauthConsent = typeof mcpOauthConsent.$inferSelect
export type McpOauthCode = typeof mcpOauthCode.$inferSelect

export type NewMcpServer = typeof mcpServer.$inferInsert
export type NewMcpOauthClient = typeof mcpOauthClient.$inferInsert
export type NewMcpEndUser = typeof mcpEndUser.$inferInsert
export type NewMcpOauthToken = typeof mcpOauthToken.$inferInsert
export type NewMcpOauthConsent = typeof mcpOauthConsent.$inferInsert
export type NewMcpOauthCode = typeof mcpOauthCode.$inferInsert