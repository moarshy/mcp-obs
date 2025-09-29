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

  // Support tool configuration
  supportToolEnabled: boolean('support_tool_enabled').default(false).notNull(),
  supportToolTitle: text('support_tool_title').default('Get Support'),
  supportToolDescription: text('support_tool_description').default('Report issues or ask questions'),
  supportToolCategories: text('support_tool_categories').default('["Bug Report", "Feature Request", "Documentation", "Other"]'), // JSON array

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Support Ticket - Links to existing MCP auth system for user tracking
export const supportTicket = pgTable('support_ticket', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Organization and MCP server scoping
  organizationId: text('organization_id').notNull(), // References platform auth
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id, { onDelete: 'cascade' }),

  // Ticket content
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').default('Other'), // Bug Report, Feature Request, Documentation, Other

  // User identification (flexible for OAuth vs non-OAuth)
  mcpUserId: text('mcp_user_id'), // For OAuth users - references mcpServerUser.id from mcp-auth-schema
  userEmail: text('user_email'), // For non-OAuth users or as backup
  sessionId: text('session_id'), // MCP session for context

  // Session context capture (minimal for MVP - current tool call only)
  contextData: text('context_data'), // JSON string of current tool call context
  userAgent: text('user_agent'), // MCP client information

  // Ticket management
  status: text('status').notNull().default('open'), // open, in_progress, closed
  priority: text('priority').default('normal'), // low, normal, high

  // Audit trail
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
  closedBy: text('closed_by'), // Platform user who closed it
})

// Type exports
export type McpServer = typeof mcpServer.$inferSelect
export type NewMcpServer = typeof mcpServer.$inferInsert

export type SupportTicket = typeof supportTicket.$inferSelect
export type NewSupportTicket = typeof supportTicket.$inferInsert