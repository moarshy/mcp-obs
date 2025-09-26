import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// MCP Server - Business Logic Schema
export const mcpServer = pgTable('mcp_server', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // Global slug for subdomain
  description: text('description'),
  organizationId: text('organization_id').notNull(), // References auth organization

  // Server status
  enabled: boolean('enabled').default(true).notNull(),

  // OAuth endpoints
  issuerUrl: text('issuer_url').notNull(),
  authorizationEndpoint: text('authorization_endpoint').notNull(),
  tokenEndpoint: text('token_endpoint').notNull(),
  registrationEndpoint: text('registration_endpoint').notNull(),
  introspectionEndpoint: text('introspection_endpoint').notNull(),
  revocationEndpoint: text('revocation_endpoint').notNull(),

  // Authentication configuration
  allowRegistration: boolean('allow_registration').default(true).notNull(),
  requireEmailVerification: boolean('require_email_verification').default(false).notNull(),
  enablePasswordAuth: boolean('enable_password_auth').default(true).notNull(),
  enableGoogleAuth: boolean('enable_google_auth').default(true).notNull(),
  enableGithubAuth: boolean('enable_github_auth').default(true).notNull(),

  // Token configuration (in seconds)
  accessTokenExpiration: integer('access_token_expiration').default(7200).notNull(), // 2 hours
  refreshTokenExpiration: integer('refresh_token_expiration').default(604800).notNull(), // 7 days

  // OAuth scopes
  scopesSupported: text('scopes_supported').default('read,write').notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})