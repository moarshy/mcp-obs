---
date: 2025-09-29T10:45:00-07:00
researcher: Claude
git_commit: 00433df
branch: main
repository: mcp-obs
topic: "Support Ticket System Feature Specification"
tags: [feature, requirements, specification, support, customer-service, sdk-integration]
status: complete
last_updated: 2025-09-29
last_updated_by: Claude
type: feature
---

# Support Ticket System Feature

## Overview
Enable end-users of customer MCP servers to raise support tickets directly through MCP tool calls, captured and managed through the mcp-obs platform dashboard. This creates a seamless support channel that integrates naturally into AI workflows while providing customers valuable insights into user pain points.

## Business Value

### For mcp-obs Customers
- **Direct User Feedback**: Capture support requests directly from AI interactions without requiring users to leave their workflow
- **User Pain Point Analytics**: Understand what users struggle with most in their MCP server interactions
- **Reduced Support Burden**: Centralized ticket management with full context of user sessions and tool usage
- **Product Improvement Insights**: Identify common issues to prioritize fixes and documentation improvements

### For End-Users
- **Seamless Support**: Get help without breaking their AI workflow or switching applications
- **Rich Context**: Support requests automatically include session context and recent tool usage
- **Familiar Interface**: Use natural language through their existing MCP client (Claude Desktop, etc.)
- **Quick Resolution**: Support teams have full context to resolve issues faster

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions:
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
- **Database Schema**: `packages/database/src/schema.ts` - Contains `mcpServer` table with organization scoping
- **SDK Integration**: `packages/sdk/typescript/mcp-server/src/oauth-middleware.ts` - OAuth middleware that wraps MCP tools
- **Platform Auth**: Separate authentication systems for platform customers vs end-users
- **Subdomain Routing**: Each customer gets `{slug}.mcp-obs.com` for their MCP server

### Composition Pattern
Async server component pattern with promises passed to client components; oRPC server actions for mutations using `.actionable` modifier for database operations; client-side data fetches using standard oRPC calls.

### Data Model
Support tickets will be stored in a new `supportTicket` table with proper organization and MCP server scoping, referencing existing authentication systems.

## User Stories
(in given/when/then format)

### End-User (Alex, Developer using DocuAPI's MCP Server)
1. **Support Tool Discovery**: **Given** Alex is using DocuAPI's MCP server through Claude Desktop, **when** they list available tools, **then** they see a "get_support_tool" with description "Report issues or ask questions about using DocuAPI" - Tool appears naturally alongside other MCP tools

2. **Authenticated Support Request**: **Given** Alex is authenticated via platform OAuth, **when** they call get_support_tool with title "API authentication not working" and description "Getting 401 errors when trying to authenticate with /api/users endpoint", **then** a support ticket is created linked to their authenticated session with full user context

3. **Anonymous Support Request**: **Given** Alex is using an MCP server without platform OAuth, **when** they call get_support_tool providing their email "alex@company.com" along with the issue details, **then** a support ticket is created with the provided email for follow-up

4. **Session Context Capture**: **Given** Alex recently made several failed API calls before raising a support ticket, **when** the ticket is created, **then** it includes recent tool usage context and error information for faster resolution

### Platform Customer (Sarah, Engineering Manager at DocuAPI)
1. **Ticket Management Dashboard**: **Given** Sarah logs into the mcp-obs dashboard, **when** she navigates to the Support section, **then** she sees all support tickets for her organization's MCP servers with user context and session information

2. **Ticket Status Management**: **Given** Sarah is viewing a support ticket, **when** she marks it as "closed" or changes its status, **then** the ticket status is updated and reflected in the dashboard with timestamp and user tracking

3. **Support Analytics**: **Given** multiple users have raised tickets about API authentication, **when** Sarah views the support analytics, **then** she can identify patterns and common pain points to prioritize fixes

## Core Functionality

### Support Tool SDK Integration
- Automatic registration of `get_support_tool` for MCP servers with support enabled
- Configurable tool description and categories per customer
- Smart input schema based on authentication type (collects email if no OAuth)
- Session context capture including recent tool calls and errors

### Ticket Creation & Management
- oRPC actionable mutations for type-safe database operations
- Automatic organization and MCP server scoping
- User attribution via MCP auth sessions or collected email
- Status management (open, in-progress, closed)

### Platform Dashboard Integration
- Support ticket dashboard view for customers
- Ticket details with full session context
- Status update capabilities
- Basic analytics on ticket patterns

## Requirements

### Functional Requirements
- Support tool automatically added to MCP servers when feature is enabled
- Ticket creation via subdomain-routed API calls (e.g., `docuapi.mcp-obs.com/api/support`)
- Proper data scoping to organization and MCP server
- Session context capture for authenticated users
- Email collection fallback for non-OAuth servers
- Customer dashboard for ticket viewing and status management
- oRPC actionable database mutations for type-safe operations

### Non-Functional Requirements

#### Performance
- Support tool calls must not significantly impact MCP server response times
- Dashboard should load tickets efficiently even with large volumes

#### Security & Permissions
- All tickets properly scoped to organization boundaries
- No cross-organization data leakage
- Secure handling of collected email addresses
- Authentication context properly validated before ticket creation

#### User Experience
- Support tool discovery feels natural within MCP tool list
- Ticket creation process requires minimal user input
- Dashboard provides clear overview of support requests

## Design Considerations

### Layout & UI
- Support section integrated into existing dashboard navigation
- Ticket list view with filtering and search capabilities
- Detailed ticket view showing session context and user information
- Status update interface with confirmation feedback

### Responsive Behavior
- Dashboard adapts to mobile screens for support team access
- Ticket details collapsible on smaller screens
- Touch-friendly status update controls

### State Management
- URL state for ticket filtering and pagination using nuqs
- Optimistic updates for status changes using oRPC hooks
- Real-time updates not required for MVP (polling acceptable)

## Implementation Considerations

### Technical Architecture
- Database table with proper foreign key relationships
- API endpoint routing based on MCP server subdomain
- oRPC procedures for ticket CRUD operations
- SDK extension to automatically register support tool

### Dependencies
- oRPC actionable mutations for database operations
- Existing authentication systems (platform and MCP OAuth)
- Current SDK OAuth middleware integration
- Dashboard routing and navigation system

## Success Criteria

### Core Functionality
- End-users can successfully raise tickets through MCP tool calls
- Tickets appear correctly in customer dashboards with proper scoping
- Status updates work reliably with audit trail
- Email collection works for non-OAuth servers

### Technical Implementation
- All database operations properly scoped to prevent cross-organization access
- Support tool registration integrated seamlessly with SDK
- API endpoints handle authentication validation correctly
- Dashboard performance acceptable with reasonable ticket volumes

### Engagement Metrics
- Support tool usage rates among end-users
- Customer adoption of support feature
- Time to resolution improvement with session context

### Business Impact
- Reduced support burden through better context capture
- Customer satisfaction with integrated support workflow
- Insights generated from ticket pattern analysis

## Scope Boundaries

### Definitely In Scope
- Basic support tool registration through SDK
- Ticket creation via MCP tool calls with proper scoping
- Customer dashboard for viewing and managing tickets
- Status management (open, in-progress, closed)
- Session context capture for authenticated users
- Email collection for non-OAuth servers

### Definitely Out of Scope
- Customer response/communication system (view-only for MVP)
- Advanced ticket categorization or routing
- Email notifications or alerts
- Integration with external support systems (Zendesk, Intercom)
- Ticket assignment to team members
- SLA tracking or automated escalation

### Future Considerations
- Two-way communication between customers and end-users
- Integration with popular support platforms
- Advanced analytics and reporting
- Automated ticket categorization using AI
- Email notification system for new tickets
- Mobile app for support team management

## Open Questions & Risks

### Questions Needing Resolution
- Should support tool be enabled by default for new MCP servers or require explicit opt-in? when creating the server - a customer should be able to opt-in for support
- What level of session context should be captured (last 5 tool calls, last 10 minutes, etc.)? for now just that tool call
- Should ticket categories be predefined or customizable per customer? please decide something minimal

### Identified Risks
- Session context capture may include sensitive information that shouldn't be logged
- High volume of tickets could impact database performance
- Spam/abuse potential from anonymous email collection
- Customer expectations may exceed view-only capabilities

## Next Steps
- Database schema design for support tickets with proper relationships
- oRPC procedure implementation for ticket CRUD operations
- SDK modification to register support tool automatically
- Dashboard UI components for ticket management
- API endpoint implementation with subdomain routing
- Ready for implementation planning

## Technical Implementation Details

### Database Schema Addition
```typescript
// packages/database/src/schema.ts
export const supportTicket = pgTable('support_ticket', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Organization and MCP server scoping
  organizationId: text('organization_id').notNull(), // References platform auth
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id),

  // Ticket content
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category'), // Optional categorization

  // User identification (flexible for OAuth vs non-OAuth)
  mcpUserId: text('mcp_user_id'), // For OAuth users - references MCP auth system
  userEmail: text('user_email'), // For non-OAuth users or as backup
  sessionId: text('session_id'), // MCP session for context

  // Session context capture
  contextData: text('context_data'), // JSON string of recent tool calls/errors
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
```

### MCP Server Configuration Extension
```typescript
// Extend existing mcpServer table
export const mcpServer = pgTable('mcp_server', {
  // ... existing fields ...

  // Support tool configuration
  supportToolEnabled: boolean('support_tool_enabled').default(false).notNull(),
  supportToolTitle: text('support_tool_title').default('Get Support'),
  supportToolDescription: text('support_tool_description').default('Report issues or ask questions'),
  supportToolCategories: text('support_tool_categories'), // JSON array of categories
})
```

### API Endpoint Structure
```typescript
// src/app/api/support/[slug]/route.ts
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  // 1. Validate MCP server exists and get organization
  // 2. Extract and validate authentication (OAuth token or email)
  // 3. Capture session context
  // 4. Create support ticket with proper scoping
  // 5. Return success response
}
```

### oRPC Procedures
```typescript
// src/lib/procedures/support.ts
export const supportRouter = router({
  createTicket: procedure
    .input(createTicketSchema)
    .actionable() // Enable Server Action compatibility
    .mutation(async ({ input }) => {
      return await createSupportTicket(input)
    }),

  updateTicketStatus: procedure
    .input(updateTicketStatusSchema)
    .actionable()
    .mutation(async ({ input }) => {
      return await updateTicketStatus(input)
    }),

  getOrganizationTickets: procedure
    .input(getTicketsSchema)
    .query(async ({ input }) => {
      return await getTicketsByOrganization(input)
    })
})
```

### SDK Integration
```typescript
// packages/sdk/typescript/mcp-server/src/support-tool.ts
export function registerSupportTool(
  server: Server,
  config: SupportToolConfig,
  serverSlug: string
) {
  if (!config.enabled) return

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === 'get_support_tool') {
      // Extract session context
      // Call mcp-obs support API
      // Return success response
    }
  })
}
```

### Integration Scope Recommendation

**Opt-in at Server Creation + SDK Extension**:

1. **Dashboard Configuration**: When customers create/edit MCP servers, they can enable support tool with custom configuration
2. **SDK Detection**: SDK checks server configuration and automatically registers the support tool if enabled
3. **Smart Defaults**: Reasonable defaults for tool description and categories, customizable per customer
4. **Flexible Authentication**: Automatically adapts input schema based on server's authentication type

This approach provides maximum flexibility while keeping the integration seamless for both customers and end-users.