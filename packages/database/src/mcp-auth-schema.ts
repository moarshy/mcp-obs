import { boolean, integer, pgTable, text, timestamp, uuid, bigint, jsonb } from 'drizzle-orm/pg-core'
import { mcpServer } from './schema'

// MCP OAuth-specific tables following MCPlatform user capture pattern

// MCP Server Users (distinct from platform/dashboard users)
// This is the core user capture table for analytics and deduplication
export const mcpServerUser = pgTable('mcp_server_user', {
  id: text('id').primaryKey().$defaultFn(() => `mcpu_${Math.random().toString(36).slice(2, 14)}`),
  trackingId: text('tracking_id').unique().$defaultFn(() => Math.random().toString(36).slice(2, 18)),

  // OAuth Provider Data
  email: text('email'),
  upstreamSub: text('upstream_sub'), // OAuth provider's sub claim
  profileData: jsonb('profile_data'), // Full OAuth profile response

  // Timestamps
  firstSeenAt: bigint('first_seen_at', { mode: 'number' }).$defaultFn(() => Date.now()),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Links users to their OAuth tokens across providers
export const upstreamOAuthTokens = pgTable('upstream_oauth_tokens', {
  id: text('id').primaryKey().$defaultFn(() => `uot_${Math.random().toString(36).slice(2, 14)}`),
  mcpServerUserId: text('mcp_server_user_id').notNull().references(() => mcpServerUser.id, { onDelete: 'cascade' }),
  oauthConfigId: text('oauth_config_id').notNull(), // Links to OAuth provider config

  // Encrypted tokens (TODO: Implement encryption in production)
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: bigint('expires_at', { mode: 'number' }),

  // Timestamps
  createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
  updatedAt: bigint('updated_at', { mode: 'number' }).$defaultFn(() => Date.now()),
})

// MCP Server Sessions link users to specific servers
export const mcpServerSession = pgTable('mcp_server_session', {
  mcpServerSessionId: text('mcp_server_session_id').primaryKey().$defaultFn(() => `mcps_${Math.random().toString(36).slice(2, 14)}`),
  mcpServerSlug: text('mcp_server_slug').notNull(),
  mcpServerUserId: text('mcp_server_user_id').notNull().references(() => mcpServerUser.id, { onDelete: 'cascade' }),

  // Session metadata
  sessionData: jsonb('session_data'),
  connectionDate: timestamp('connection_date', { mode: 'date' }).defaultNow(),
  connectionTimestamp: bigint('connection_timestamp', { mode: 'number' }).$defaultFn(() => Date.now()),
  expiresAt: bigint('expires_at', { mode: 'number' }),
  revokedAt: bigint('revoked_at', { mode: 'number' }),
})

// Analytics tables that reference captured users
export const mcpToolCalls = pgTable('mcp_tool_calls', {
  id: text('id').primaryKey().$defaultFn(() => `mtc_${Math.random().toString(36).slice(2, 14)}`),
  mcpServerUserId: text('mcp_server_user_id').notNull().references(() => mcpServerUser.id, { onDelete: 'cascade' }),
  mcpServerSlug: text('mcp_server_slug').notNull(),

  // Tool execution data
  toolName: text('tool_name').notNull(),
  input: jsonb('input'),
  output: jsonb('output'),
  executionTimeMs: integer('execution_time_ms'),
  success: boolean('success'),
  errorMessage: text('error_message'),

  createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
})


// Original OAuth tables (keeping existing structure but updating references)

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

// Better Auth MCP Compatible Tables (MCPlatform Pattern)

// MCP End Users (Better Auth compatible - no server constraints)
export const mcpEndUser = pgTable('mcp_end_user', {
  id: uuid('id').defaultRandom().primaryKey(),
  // NO mcp_server_id constraint - server context handled in sessions

  // User Identity (nullable for Better Auth compatibility)
  email: text('email'),
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

// MCP Sessions (Better Auth compatible)
export const mcpSession = pgTable('mcp_session', {
  id: text('id').primaryKey().$defaultFn(() => `mcps_${Math.random().toString(36).slice(2, 14)}`),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => mcpEndUser.id, { onDelete: 'cascade' }),

  // Better Auth required fields
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  // MCP-specific context fields
  activeOrganizationId: text('active_organization_id'), // Organization context
  mcpServerId: text('mcp_server_id'), // MCP server context

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// MCP Accounts (Better Auth compatible for social OAuth)
export const mcpAccount = pgTable('mcp_account', {
  id: text('id').primaryKey().$defaultFn(() => `mcpa_${Math.random().toString(36).slice(2, 14)}`),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id').notNull().references(() => mcpEndUser.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// MCP Verification (Better Auth compatible)
export const mcpVerification = pgTable('mcp_verification', {
  id: text('id').primaryKey().$defaultFn(() => `mcpv_${Math.random().toString(36).slice(2, 14)}`),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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

// Type exports for user capture system
export type McpServerUser = typeof mcpServerUser.$inferSelect
export type UpstreamOAuthToken = typeof upstreamOAuthTokens.$inferSelect
export type McpServerSession = typeof mcpServerSession.$inferSelect
export type McpToolCall = typeof mcpToolCalls.$inferSelect

export type NewMcpServerUser = typeof mcpServerUser.$inferInsert
export type NewUpstreamOAuthToken = typeof upstreamOAuthTokens.$inferInsert
export type NewMcpServerSession = typeof mcpServerSession.$inferInsert
export type NewMcpToolCall = typeof mcpToolCalls.$inferInsert

// Type exports for OAuth system
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