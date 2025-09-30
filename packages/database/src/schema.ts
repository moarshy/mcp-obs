import { boolean, integer, pgTable, text, timestamp, uuid, bigint, doublePrecision, jsonb } from 'drizzle-orm/pg-core'

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

  // Telemetry configuration
  telemetryEnabled: boolean('telemetry_enabled').default(false).notNull(),

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

// MCP Server API Keys - For telemetry authentication
export const mcpServerApiKey = pgTable('mcp_server_api_key', {
  id: uuid('id').defaultRandom().primaryKey(),
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull(), // References platform auth organization

  // API key management
  apiKeyHash: text('api_key_hash').notNull(), // bcrypt hashed API key
  name: text('name').default('Telemetry API Key'), // User-friendly name
  lastUsedAt: timestamp('last_used_at'),

  // Security and auditing
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'), // null = active, non-null = revoked
})

// Telemetry Traces - Stores OpenTelemetry trace data
export const telemetryTrace = pgTable('telemetry_trace', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id, { onDelete: 'cascade' }),

  // OpenTelemetry standard fields
  traceId: text('trace_id').notNull(),
  spanId: text('span_id').notNull(),
  parentSpanId: text('parent_span_id'),
  operationName: text('operation_name').notNull(),
  startTime: bigint('start_time', { mode: 'bigint' }).notNull(), // nanoseconds since epoch
  endTime: bigint('end_time', { mode: 'bigint' }).notNull(), // nanoseconds since epoch
  durationNs: bigint('duration_ns', { mode: 'bigint' }).notNull(), // duration in nanoseconds

  // MCP semantic conventions
  mcpOperationType: text('mcp_operation_type'), // "tool_call", "resource_read", "prompt_get"
  mcpToolName: text('mcp_tool_name'),
  mcpUserId: text('mcp_user_id'), // From OAuth authentication
  mcpSessionId: text('mcp_session_id'),

  // Span attributes and status
  spanStatus: text('span_status').default('OK'), // OK, ERROR, TIMEOUT
  errorMessage: text('error_message'),

  // Raw span data for export forwarding (future)
  spanData: jsonb('span_data').notNull(),

  // Export tracking (future feature)
  exportedToCustomer: boolean('exported_to_customer').default(false),
  exportError: text('export_error'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Telemetry Metrics - Aggregated metrics for dashboard analytics
export const telemetryMetric = pgTable('telemetry_metric', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id, { onDelete: 'cascade' }),

  // Metric identification
  metricName: text('metric_name').notNull(), // "mcp.tool.calls.count", "mcp.tool.latency.p95"
  metricType: text('metric_type').notNull(), // "counter", "histogram", "gauge"
  value: doublePrecision('value').notNull(),

  // Metric labels/dimensions
  labels: jsonb('labels'), // {"tool_name": "get_docs", "status": "success", "user_id": "123"}

  // Time bucketing for dashboard queries
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Type exports
export type McpServer = typeof mcpServer.$inferSelect
export type NewMcpServer = typeof mcpServer.$inferInsert

export type SupportTicket = typeof supportTicket.$inferSelect
export type NewSupportTicket = typeof supportTicket.$inferInsert

export type McpServerApiKey = typeof mcpServerApiKey.$inferSelect
export type NewMcpServerApiKey = typeof mcpServerApiKey.$inferInsert

export type TelemetryTrace = typeof telemetryTrace.$inferSelect
export type NewTelemetryTrace = typeof telemetryTrace.$inferInsert

export type TelemetryMetric = typeof telemetryMetric.$inferSelect
export type NewTelemetryMetric = typeof telemetryMetric.$inferInsert