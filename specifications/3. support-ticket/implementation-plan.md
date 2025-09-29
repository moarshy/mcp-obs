---
date: 2025-09-29T07:01:03+0000
researcher: Claude
git_commit: 00433df
branch: main
repository: mcp-obs
topic: "Support Ticket System Implementation Strategy"
tags: [implementation, strategy, support-ticket, mcp-server, oauth, dashboard]
status: complete
last_updated: 2025-09-29
last_updated_by: Claude
type: implementation_strategy
---

# Support Ticket System Implementation Plan

## Overview

Implementing a support ticket system that integrates seamlessly into MCP tool workflows, allowing end-users to raise tickets directly through MCP tool calls while providing customers with comprehensive ticket management through the mcp-obs dashboard.

## Current State Analysis

### Key Discoveries:
- **Organization-scoped architecture**: All business entities reference `organizationId` with proper data isolation (`auth-schema.ts:98-131`, `schema.ts:9`)
- **oRPC action pattern**: Server actions with authentication, Zod validation, and cache revalidation (`mcp-servers.ts:29-113`)
- **Dashboard UI pattern**: Server components with Suspense boundaries, Card/Table layouts, and dialog-based forms (`mcp-servers/page.tsx:18-211`)
- **SDK OAuth integration**: Token validation via platform API with session context capture (`oauth-middleware.ts:58-112`)
- **Subdomain routing**: MCP server resolution from host headers with environment-aware URLs
- **Dual authentication system**: Platform auth for customers, MCP server auth for end-users with proper isolation
- **Existing user tracking**: `mcpServerUser` and `mcpServerSession` tables for analytics integration

## What We're NOT Doing

- Customer response/communication system (view-only dashboard for MVP)
- Advanced ticket categorization or routing beyond basic predefined categories
- Email notifications or alerts
- Integration with external support systems (Zendesk, Intercom)
- Ticket assignment to team members
- SLA tracking or automated escalation

## Implementation Approach

**Phased approach leveraging existing patterns**:
1. **Database Foundation**: Extend existing schema with support ticket tables linking to current MCP auth system
2. **SDK Integration**: Extend OAuth middleware to automatically register support tool when enabled
3. **API Endpoints**: Create subdomain-routed support ticket creation endpoint following existing patterns
4. **Dashboard Interface**: Add support ticket management section using established UI components

**Key architectural decisions**:
- Link support tickets to existing `mcpServerUser`/`mcpServerSession` tables when OAuth is available
- Fallback to email collection for non-OAuth servers
- Follow existing organization scoping patterns for data isolation
- Use oRPC actionable mutations for type-safe database operations
- Capture minimal session context (current tool call only) for MVP
- Organize all subdomain-routed endpoints under `/api/mcpserver/` for consistency

## Phase 1: Database Schema and Core Infrastructure

### Overview
Establish the data model and core database operations for support tickets, extending existing MCP auth schema with proper organization scoping.

### Changes Required:

#### 1. Database Schema Extension
**File**: `packages/database/src/schema.ts`
**Changes**: Add support ticket tables with proper foreign key relationships

**Implementation Requirements:**
- Add `supportTicket` table with organization and MCP server scoping
- Reference existing `mcpServerUser` and `mcpServerSession` tables when available
- Include email fallback for non-OAuth servers
- Add session context capture fields for troubleshooting
- Include predefined categories (Bug Report, Feature Request, Documentation, Other)
- Add status management fields (open, in_progress, closed)
- Include audit trail with timestamps and user tracking

#### 2. MCP Server Configuration Extension
**File**: `packages/database/src/schema.ts`
**Changes**: Extend existing `mcpServer` table with support tool configuration

**Implementation Requirements:**
- Add boolean field `supportToolEnabled` with default false
- Add configurable tool title and description fields
- Add categories configuration as JSON array
- Maintain backward compatibility with existing servers
- Include migration script for existing servers to opt-in

#### 3. Database Migration
**File**: `packages/dashboard/drizzle/` (new migration file)
**Changes**: Create migration for new schema additions

**Implementation Requirements:**
- Add support ticket table with proper indexes
- Add foreign key constraints to existing tables
- Add support tool configuration columns to mcpServer table
- Include rollback capability for safe deployment
- Test migration on development data

### Success Criteria:

**Automated verification**
- [ ] no linter errors
- [ ] database migration runs successfully
- [ ] foreign key constraints are properly enforced

**Manual Verification**
- [ ] support ticket can be created and linked to existing MCP auth tables
- [ ] organization scoping prevents cross-tenant data access
- [ ] email fallback works for non-OAuth scenarios

## Phase 2: oRPC Actions and API Endpoints

### Overview
Implement type-safe database operations and API endpoints for support ticket creation and management, following established oRPC patterns.

### Changes Required:

#### 1. Support Ticket oRPC Actions
**File**: `packages/dashboard/src/lib/orpc/actions/support-tickets.ts`
**Changes**: Create new oRPC action procedures for CRUD operations

**Implementation Requirements:**
- Create support ticket with organization and MCP server scoping
- Update ticket status with proper authorization checks
- Get tickets by organization with pagination and filtering
- Validate user permissions through existing session/member patterns
- Include proper error handling with typed responses
- Implement cache revalidation for real-time UI updates
- Follow existing authentication patterns from mcp-servers.ts

#### 2. Support Ticket Creation API Endpoint
**File**: `packages/dashboard/src/app/api/mcpserver/support/route.ts`
**Changes**: Create subdomain-routed API endpoint for ticket creation from SDK

**Implementation Requirements:**
- Extract MCP server from subdomain using existing patterns
- Validate OAuth token or collect email for non-OAuth servers
- Capture session context from tool call (tool name, parameters, errors)
- Create support ticket with proper organization scoping
- Handle both authenticated and anonymous ticket creation
- Return success response compatible with SDK expectations
- Include proper error responses for validation failures

#### 3. oRPC Router Integration
**File**: `packages/dashboard/src/lib/orpc/router.ts`
**Changes**: Add support ticket procedures to main router

**Implementation Requirements:**
- Export support ticket actions through main router
- Ensure type safety across client and server boundaries
- Include proper error definitions for support-specific errors
- Maintain consistency with existing router patterns

### Success Criteria:

**Automated verification**
- [ ] no linter errors
- [ ] TypeScript compilation passes
- [ ] oRPC procedures are properly typed

**Manual Verification**
- [ ] support tickets can be created via API endpoint
- [ ] organization scoping is enforced in all operations
- [ ] OAuth token validation works correctly
- [ ] email fallback functions for non-OAuth servers

## Phase 3: SDK Integration and Tool Registration

### Overview
Extend existing SDK OAuth middleware to automatically register support tools when enabled, maintaining backward compatibility.

### Changes Required:

#### 1. Support Tool Registration (TypeScript SDK)
**File**: `packages/sdk/typescript/mcp-server/src/support-tool.ts`
**Changes**: Create new module for automatic support tool registration

**Implementation Requirements:**
- Implement support tool registration function that integrates with MCP Server instances
- Check MCP server configuration to determine if support tools should be enabled
- Register `get_support_tool` with configurable title, description, and categories
- Handle both authenticated and anonymous usage patterns
- Capture current tool call context for session data
- Make API calls to mcp-obs platform endpoint with proper authentication
- Include error handling and fallback messaging for tool failures

#### 2. OAuth Middleware Extension
**File**: `packages/sdk/typescript/mcp-server/src/oauth-middleware.ts`
**Changes**: Extend configuration to include support tool settings

**Implementation Requirements:**
- Add support tool configuration options to OAuthMiddlewareConfig interface
- Integrate support tool registration during validator configuration
- Maintain backward compatibility with existing implementations
- Allow customers to customize tool title, description, and categories
- Include opt-in/opt-out functionality per MCP server configuration

#### 3. Python SDK Integration
**File**: `packages/sdk/python/mcp-server/src/mcp_obs_server/support_tool.py`
**Changes**: Create equivalent Python support tool integration

**Implementation Requirements:**
- Implement Python version of support tool registration
- Integrate with existing FastMCP OAuth patterns
- Follow same API patterns as TypeScript implementation
- Include proper type hints and error handling
- Maintain feature parity with TypeScript SDK

### Success Criteria:

**Automated verification**
- [ ] no linter errors
- [ ] SDK packages build successfully
- [ ] Python type checking passes

**Manual Verification**
- [ ] support tool appears in MCP tool list when enabled
- [ ] tool integration works with both OAuth and non-OAuth servers
- [ ] session context is properly captured and transmitted
- [ ] API calls to platform succeed with proper authentication

## Phase 4: Dashboard UI Implementation

### Overview
Create support ticket management interface in the mcp-obs dashboard following existing UI patterns and design conventions.

### Changes Required:

#### 1. Support Tickets Page
**File**: `packages/dashboard/src/app/dashboard/support-tickets/page.tsx`
**Changes**: Create main support tickets list page

**Implementation Requirements:**
- Implement server component pattern with async data fetching
- Use organization scoping for ticket queries
- Include Suspense boundaries for loading states
- Display tickets in Table format with status badges
- Show ticket metadata (title, category, status, created date, user info)
- Include empty state with helpful messaging
- Add pagination for large ticket volumes
- Implement filtering by status and category

#### 2. Support Ticket Details Page
**File**: `packages/dashboard/src/app/dashboard/support-tickets/[id]/page.tsx`
**Changes**: Create detailed ticket view page

**Implementation Requirements:**
- Display full ticket information including session context
- Show user identification (email or linked MCP user)
- Display captured tool call context for troubleshooting
- Include status update interface with confirmation
- Show audit trail of status changes
- Implement proper error boundaries and loading states

#### 3. Status Update Components
**File**: `packages/dashboard/src/components/support-tickets/`
**Changes**: Create reusable components for ticket management

**Implementation Requirements:**
- Status update dialog with confirmation
- Ticket list component with filtering capabilities
- Status badge component with consistent styling
- Category display components
- Session context display component for troubleshooting
- User information display with proper handling of OAuth vs email users

#### 4. Navigation Integration
**File**: `packages/dashboard/src/app/dashboard/layout.tsx`
**Changes**: Add support tickets section to dashboard navigation

**Implementation Requirements:**
- Add support tickets menu item to existing sidebar navigation
- Include proper icons and labeling
- Maintain consistency with existing navigation patterns
- Include badge for unread/open ticket count (future enhancement)

### Success Criteria:

**Automated verification**
- [ ] no linter errors
- [ ] Next.js pages build successfully
- [ ] shadcn/ui components render correctly

**Manual Verification**
- [ ] support tickets page loads with proper organization scoping
- [ ] ticket details display correctly with session context
- [ ] status updates work and reflect in real-time
- [ ] navigation integration functions properly
- [ ] responsive design works on mobile devices

## Phase 5: MCP Server Configuration Integration

### Overview
Extend existing MCP server management to include support tool configuration options, maintaining consistency with current patterns.

### Changes Required:

#### 1. Create/Edit MCP Server Dialogs
**File**: `packages/dashboard/src/components/mcp-servers/create-mcp-server-dialog.tsx`
**File**: `packages/dashboard/src/components/mcp-servers/edit-mcp-server-dialog.tsx`
**Changes**: Add support tool configuration options

**Implementation Requirements:**
- Add checkbox to enable/disable support tool
- Include configurable tool title and description fields
- Add category selection interface
- Maintain existing form validation patterns
- Update Zod schemas to include support tool fields
- Include helpful tooltips and descriptions for configuration options

#### 2. MCP Server Actions Update
**File**: `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts`
**Changes**: Update create/update actions to handle support tool configuration

**Implementation Requirements:**
- Extend Zod schemas to include support tool configuration
- Update database operations to save support tool settings
- Maintain backward compatibility with existing servers
- Include validation for support tool configuration fields
- Update cache revalidation to include support ticket dependencies

#### 3. MCP Server Display Updates
**File**: `packages/dashboard/src/app/dashboard/mcp-servers/page.tsx`
**Changes**: Show support tool status in server list

**Implementation Requirements:**
- Add support tool status badge to server list
- Include support tool configuration in server details
- Show link to support tickets for each server
- Maintain existing table layout and responsive design

### Success Criteria:

**Automated verification**
- [ ] no linter errors
- [ ] form validation works correctly
- [ ] database updates succeed

**Manual Verification**
- [ ] support tool can be enabled/disabled during server creation
- [ ] existing servers can be updated with support tool configuration
- [ ] configuration changes are reflected in SDK behavior
- [ ] support tool status is visible in server management interface

## Performance Considerations

- Support ticket queries use proper database indexes on organizationId and mcpServerId
- Session context capture is limited to current tool call to minimize data storage
- Dashboard pagination prevents large data loads for high-volume customers
- API endpoints include proper caching headers for static responses

## Migration Notes

- Existing MCP servers will have support tools disabled by default
- Customers can opt-in through the dashboard interface
- No breaking changes to existing SDK implementations
- Support tool registration is additive to existing OAuth middleware

## References
* Original ticket: `specifications/3. support-ticket/feature.md`
* Database patterns: `packages/database/src/schema.ts:4-38`
* oRPC action patterns: `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts:29-113`
* Dashboard UI patterns: `packages/dashboard/src/app/dashboard/mcp-servers/page.tsx:18-211`
* SDK OAuth middleware: `packages/sdk/typescript/mcp-server/src/oauth-middleware.ts:58-112`