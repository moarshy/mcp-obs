---
date: 2025-01-24T23:42:00+00:00
researcher: Claude Code
git_commit: 6ce2367a585aaa7dea4105333a85b6dcb135f89e
branch: main
repository: mcp-obs
topic: "MCP Authentication System Implementation Strategy"
tags: [implementation, strategy, mcp-auth, oauth, subdomain, better-auth, dual-auth-system]
status: complete
last_updated: 2025-01-24
last_updated_by: Claude Code
type: implementation_strategy
---

# MCP Authentication System Implementation Plan

## Overview

Implement a complete OAuth 2.1 Authorization Server for MCP end-user authentication using Better Auth's MCP plugin, with subdomain-based MCP server identification. This creates a dual authentication system where platform customers manage organizations through standard auth, while their MCP servers authenticate end-users through organization-scoped OAuth servers.

## Current State Analysis

### Key Discoveries:
- **Platform Auth Foundation**: Better Auth configured at `packages/dashboard/src/lib/auth/config.ts:21-62` with OAuth capabilities, organization plugin, and Drizzle adapter
- **Database Architecture**: Dual-schema approach with text IDs for auth tables (`packages/database/src/auth-schema.ts`) and UUID IDs for business tables (`packages/database/src/schema.ts`)
- **Middleware Pattern**: Route protection middleware at `packages/dashboard/middleware.ts:5` with organization context via query parameters
- **API Organization**: Mixed routing with Better Auth at `/api/auth/[...auth]` and oRPC at `/api/rpc/[[...rest]]` patterns
- **Better Auth Capability**: MCP plugin available and more production-ready than OIDC Provider plugin for OAuth server functionality

### Current State:
- Platform authentication system operational with organization management
- Database migration system established with both auth and business schemas
- oRPC type-safe procedures configured for platform operations
- No subdomain routing - currently uses query parameter organization scoping
- No MCP-specific OAuth infrastructure implemented

## What We're NOT Doing

- Platform user OAuth flows (already implemented via existing Better Auth configuration)
- Custom JWT encryption or advanced token formats beyond OAuth 2.1 standards
- SAML, Azure AD, or enterprise identity provider integration
- Cross-region token validation or distributed OAuth servers
- Advanced client lifecycle management (rotation policies, client analytics)
- Detailed audit logging beyond basic OAuth flow tracking

## Implementation Approach

**Dual Authentication Architecture**: Extend the existing platform auth system with parallel MCP server OAuth infrastructure. Platform auth continues to handle customer organization management, while new MCP auth handles end-user authentication per MCP server with complete organization isolation.

**Better Auth MCP Plugin Strategy**: Use Better Auth's MCP plugin rather than the less stable OIDC Provider plugin. This provides OAuth server functionality specifically designed for MCP scenarios with proper token issuance and session management.

**Schema Extension Pattern**: Follow existing dual-schema approach by creating `packages/database/src/mcp-auth-schema.ts` with UUID-based IDs (maintaining separation from text-based platform auth schema).

**Subdomain Middleware Enhancement**: Enhance existing middleware at `packages/dashboard/middleware.ts` with subdomain detection and MCP server context injection, while preserving current platform auth behavior.

## Phase 1: Database Schema & MCP Server Management

### Overview
Establish MCP-specific database schema and core MCP server CRUD operations, building on existing platform auth and organization infrastructure.

### Changes Required:

#### 1. MCP Authentication Database Schema
**File**: `packages/database/src/mcp-auth-schema.ts`
**Changes**: Create new schema file with MCP OAuth tables

**Implementation Requirements:**
- Create `mcpServer` table with UUID IDs, organization foreign keys, and OAuth configuration fields (issuer_url, endpoints, supported capabilities)
- Create `mcpOAuthClient` table for dynamic client registration with RFC 7591 metadata fields (client_name, redirect_uris, etc.)
- Create `mcpEndUser` table for MCP server end-users with authentication provider linking (email/password, Google, GitHub)
- Create `mcpOAuthToken` table for access/refresh tokens with PKCE fields and expiration management
- Create `mcpOAuthConsent` table for user consent tracking per client-server combination
- Create `mcpOAuthCode` table for temporary authorization codes with 10-minute expiration
- All tables use UUID primary keys with proper foreign key relationships and cascade deletions
- Follow existing schema patterns from `auth-schema.ts` for consistency (timestamp defaults, boolean flags)

#### 2. Database Schema Integration
**File**: `packages/database/index.ts`
**Changes**: Export MCP auth schema alongside existing schemas

**Implementation Requirements:**
- Import and merge `mcpAuthSchema` with existing schema exports
- Update type exports to include MCP OAuth types
- Ensure database connection includes all schema tables
- Maintain backward compatibility with existing platform auth queries

#### 3. Database Migration Generation
**File**: `packages/database/drizzle.config.ts`
**Changes**: Update schema paths to include MCP auth schema

**Implementation Requirements:**
- Add `./src/mcp-auth-schema.ts` to schema array
- Generate migration for new MCP OAuth tables
- Ensure migration handles foreign key relationships properly
- Test migration in development environment

#### 4. MCP Server CRUD Procedures
**File**: `packages/dashboard/src/lib/orpc/procedures/mcp.ts`
**Changes**: Create new oRPC procedures for MCP server management

**Implementation Requirements:**
- Implement `createMcpServer` mutation with slug validation and subdomain generation
- Implement `getMcpServer` query with organization scoping and access control
- Implement `updateMcpServer` mutation with OAuth configuration updates
- Implement `listMcpServers` query for organization dashboard with filtering
- Implement `deleteMcpServer` mutation with cascade cleanup of clients and tokens
- Use Zod schemas for input validation following patterns from `packages/dashboard/src/lib/orpc/procedures/auth.ts:8-11`
- Implement slug uniqueness validation and suggestion generation
- Add proper error handling with ORPCError for validation and database errors

### Success Criteria:

**Automated verification**
- [ ] `bun run lint` passes with no errors
- [ ] `bun run type-check` passes with no TypeScript errors
- [ ] `bun run db:generate` creates migration files successfully
- [ ] `bun run db:migrate` applies migrations without errors

**Manual Verification**
- [ ] Can create MCP server via oRPC procedure with valid organization scoping
- [ ] MCP server slugs are properly validated and enforce uniqueness globally
- [ ] MCP server CRUD operations work correctly in dashboard UI
- [ ] Database foreign key constraints work properly with cascade deletions
- [ ] All MCP auth tables are created with proper indexes and constraints

## Phase 2: Subdomain Routing & Middleware Enhancement

### Overview
Implement subdomain detection and MCP server context injection while preserving existing platform auth routing.

### Changes Required:

#### 1. Subdomain Detection Middleware
**File**: `packages/dashboard/src/middleware.ts`
**Changes**: Enhance existing middleware with subdomain routing

**Implementation Requirements:**
- Add subdomain extraction logic to detect `{slug}.mcp-obs.com` patterns
- Handle development environment with localhost subdomain simulation (port-based or hosts file)
- Inject MCP server context into request headers or URL parameters for downstream handlers
- Preserve existing platform auth route protection and organization scoping
- Add MCP server lookup by slug with database query and caching
- Handle reserved subdomains (`www`, `api`, `admin`, etc.) by rejecting with 404
- Route MCP OAuth endpoints (`.well-known/*` and `/oauth/*`) to appropriate API handlers
- Implement proper error handling for invalid subdomains or missing MCP servers

#### 2. MCP Server Utilities
**File**: `packages/dashboard/src/lib/mcp-server-utils.ts`
**Changes**: Create utilities for MCP server operations

**Implementation Requirements:**
- Implement `getMcpServerBySlug` function with database lookup and organization context
- Implement `validateMcpServerSlug` function with format validation and uniqueness checks
- Implement `generateSuggestedSlug` function for automatic slug generation from names
- Add reserved slug list and validation logic
- Implement slug format validation (lowercase, hyphens, length limits)
- Add caching layer for MCP server lookups to reduce database queries
- Handle development vs production subdomain differences

#### 3. Next.js Configuration Updates
**File**: `packages/dashboard/next.config.js`
**Changes**: Configure Next.js for subdomain handling

**Implementation Requirements:**
- Add rewrites for subdomain routing patterns if needed
- Configure headers for CORS support on MCP OAuth endpoints
- Ensure proper handling of wildcard subdomains in development and production
- Add any necessary webpack optimizations for subdomain detection

### Success Criteria:

**Automated verification**
- [ ] `bun run lint` passes with no middleware errors
- [ ] `bun run type-check` passes with middleware type safety
- [ ] Development server handles localhost subdomain simulation correctly

**Manual Verification**
- [ ] Subdomain detection works correctly for `{slug}.mcp-obs.com` patterns
- [ ] Reserved subdomains (`www`, `api`, etc.) return 404 as expected
- [ ] MCP server context is properly injected for valid subdomains
- [ ] Existing platform auth routes continue to work without regression
- [ ] Invalid subdomains handle gracefully with appropriate error responses

## Phase 3: Better Auth MCP OAuth Configuration

### Overview
Configure Better Auth MCP plugin for OAuth server functionality with organization-scoped authentication.

### Changes Required:

#### 1. MCP Auth Configuration
**File**: `packages/dashboard/src/lib/auth/mcp/auth.ts`
**Changes**: Create separate Better Auth configuration for MCP OAuth

**Implementation Requirements:**
- Configure Better Auth MCP plugin with OAuth server capabilities
- Set up organization-scoped authentication with subdomain context
- Configure OAuth endpoints (authorization, token, registration, userinfo, jwks)
- Enable PKCE support with S256 code challenge method mandatory
- Configure access token expiration (2 hours) and refresh token expiration (7 days)
- Set up end-user authentication providers (email/password, Google, GitHub)
- Configure JWT signing and audience validation for MCP server tokens
- Add proper CORS configuration for cross-origin MCP client requests

#### 2. MCP Auth Database Adapter
**File**: `packages/dashboard/src/lib/auth/mcp/adapter.ts`
**Changes**: Create Drizzle adapter for MCP auth schema

**Implementation Requirements:**
- Implement Drizzle adapter using MCP auth schema tables
- Map Better Auth MCP plugin operations to MCP OAuth tables (mcpEndUser, mcpOAuthToken, etc.)
- Handle organization scoping in all adapter operations
- Implement proper session management with MCP server context
- Add token lifecycle management (creation, refresh, revocation)
- Handle consent management and client registration operations
- Ensure adapter operations respect organization boundaries and data isolation

#### 3. MCP OAuth API Routes
**File**: `packages/dashboard/src/app/api/mcp-oauth/[...auth]/route.ts`
**Changes**: Create MCP OAuth endpoint handlers

**Implementation Requirements:**
- Create catch-all route handler for MCP OAuth endpoints using Better Auth MCP handler
- Handle subdomain context extraction and MCP server identification
- Route to appropriate organization-scoped MCP auth configuration
- Implement proper error handling for invalid MCP servers or organizations
- Add CORS headers for cross-origin MCP client access
- Handle OAuth discovery endpoints (authorization-server, protected-resource metadata)
- Implement dynamic client registration endpoint with RFC 7591 compliance

#### 4. OAuth Discovery Endpoints
**File**: `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts`
**Changes**: Implement RFC 8414 OAuth discovery metadata

**Implementation Requirements:**
- Extract MCP server context from subdomain in request
- Return OAuth 2.1 compliant authorization server metadata
- Include all required OAuth endpoints with proper subdomain URLs
- Specify supported capabilities (PKCE, dynamic client registration, grant types, scopes)
- Handle organization-specific OAuth configurations
- Add proper CORS headers for cross-origin discovery requests
- Follow patterns from reference implementation provided in prompt

### Success Criteria:

**Automated verification**
- [ ] `bun run lint` passes with no OAuth configuration errors
- [ ] `bun run type-check` passes with proper Better Auth MCP types
- [ ] OAuth endpoints return valid responses in development environment

**Manual Verification**
- [ ] `.well-known/oauth-authorization-server` returns RFC 8414 compliant metadata
- [ ] MCP auth configuration properly scopes to organizations via subdomains
- [ ] Better Auth MCP OAuth endpoints respond correctly to standard OAuth requests
- [ ] PKCE flow initiation works with S256 code challenge method
- [ ] Cross-origin CORS headers work correctly for MCP client requests

## Phase 4: OAuth Flow Implementation & Client Registration

### Overview
Implement complete OAuth 2.1 authorization flows with dynamic client registration and PKCE support.

### Changes Required:

#### 1. Dynamic Client Registration
**File**: `packages/dashboard/src/lib/mcp-oauth/client-registration.ts`
**Changes**: Implement RFC 7591 dynamic client registration

**Implementation Requirements:**
- Implement client registration endpoint handler with validation of client metadata
- Generate secure client_id and optional client_secret (PKCE-only clients can omit secret)
- Validate redirect URIs format and store as JSON array
- Support client metadata fields (client_name, client_uri, logo_uri) per RFC 7591
- Implement client registration response with issued_at timestamp and optional expiration
- Add organization scoping so clients are registered per MCP server
- Handle client update and retrieval operations via registration access tokens
- Implement proper error responses for invalid registration requests

#### 2. Authorization Flow Handler
**File**: `packages/dashboard/src/lib/mcp-oauth/authorization-flow.ts`
**Changes**: Implement OAuth authorization endpoint logic

**Implementation Requirements:**
- Validate authorization requests with required parameters (client_id, response_type, redirect_uri)
- Enforce PKCE requirements with S256 code challenge method validation
- Implement state parameter handling and CSRF protection
- Validate client_id exists and redirect_uri matches registered values
- Handle user authentication and redirect to consent screen
- Generate secure authorization codes with 10-minute expiration
- Implement authorization code storage with PKCE code_challenge binding
- Handle consent approval/denial and redirect with authorization code or error

#### 3. Token Exchange Handler
**File**: `packages/dashboard/src/lib/mcp-oauth/token-exchange.ts`
**Changes**: Implement OAuth token endpoint logic

**Implementation Requirements:**
- Validate token exchange requests (authorization_code grant type)
- Verify PKCE code_verifier against stored code_challenge using S256 method
- Validate client authentication (client_secret_basic, client_secret_post, or none for PKCE)
- Implement authorization code consumption (single-use with expiration check)
- Generate JWT access tokens with proper audience (MCP server canonical URL) and expiration
- Generate refresh tokens with secure random values and longer expiration
- Implement refresh token grant type for token renewal without user interaction
- Add proper error responses for invalid grants, expired codes, or failed PKCE validation

#### 4. Consent Screen Components
**File**: `packages/dashboard/src/components/mcp-oauth/consent-screen.tsx`
**Changes**: Create OAuth consent UI components

**Implementation Requirements:**
- Create consent screen component with MCP server branding and client information
- Display requested scopes with clear descriptions (read, write, admin)
- Implement approve/deny actions with form submission to authorization endpoint
- Show client metadata (name, logo, description) from registration
- Handle remember consent checkbox for streamlined future authorizations
- Implement responsive design for mobile browser OAuth flows
- Add proper error handling and loading states during consent processing
- Follow shadcn/ui patterns from existing dashboard components

### Success Criteria:

**Automated verification**
- [ ] `bun run lint` passes with no OAuth flow errors
- [ ] `bun run type-check` passes with proper OAuth type safety
- [ ] OAuth flow handlers return proper HTTP status codes and responses

**Manual Verification**
- [ ] Dynamic client registration creates clients successfully via API calls
- [ ] Authorization flow handles PKCE challenge generation and validation correctly
- [ ] Token exchange validates authorization codes and issues proper JWT access tokens
- [ ] Consent screen displays correctly with client information and scope descriptions
- [ ] Refresh token flow works without user interaction for token renewal

## Phase 5: Token Management & Protected Resource Integration

### Overview
Implement token validation, introspection, and protected resource capabilities for MCP server integration.

### Changes Required:

#### 1. Token Validation & Introspection
**File**: `packages/dashboard/src/lib/mcp-oauth/token-validation.ts`
**Changes**: Implement OAuth token validation and introspection

**Implementation Requirements:**
- Implement JWT token signature validation using signing keys
- Validate token expiration, audience (MCP server URL), and issuer claims
- Implement RFC 7662 token introspection endpoint for resource server validation
- Handle token revocation endpoint for client-initiated token invalidation
- Add token scope validation for resource access control
- Implement organization boundary checks to prevent cross-tenant token usage
- Add proper error responses for invalid tokens, expired tokens, or insufficient scope
- Handle both Bearer header and query parameter token presentation methods

#### 2. Protected Resource Metadata
**File**: `packages/dashboard/src/app/.well-known/oauth-protected-resource/route.ts`
**Changes**: Implement RFC 9728 protected resource metadata

**Implementation Requirements:**
- Extract MCP server context from subdomain for protected resource identification
- Return protected resource metadata pointing to authorization servers
- Include supported bearer token methods and scope information
- Add resource endpoint URL for proper audience validation
- Handle organization-specific resource server configurations
- Follow patterns from reference implementation for consistent metadata structure
- Add proper CORS headers for cross-origin resource discovery

#### 3. MCP Server SDK Integration Helpers
**File**: `packages/dashboard/src/lib/mcp-oauth/sdk-helpers.ts`
**Changes**: Create utilities for Server SDK integration

**Implementation Requirements:**
- Implement `validateMcpToken` function for Server SDK token validation
- Add helper functions for scope checking and user information extraction
- Create middleware factory for MCP server request authentication
- Implement token-to-user mapping for authenticated request context
- Add utilities for generating proper WWW-Authenticate headers on 401 responses
- Handle token refresh hints and expiration notifications
- Provide organization context extraction from validated tokens

#### 4. Admin Dashboard Integration
**File**: `packages/dashboard/src/app/dashboard/organizations/[orgId]/mcp-servers/[serverId]/oauth/page.tsx`
**Changes**: Create OAuth management interface in organization dashboard

**Implementation Requirements:**
- Display registered OAuth clients with metadata and usage statistics
- Implement client management actions (view details, revoke access, update metadata)
- Show active user sessions and token usage analytics per MCP server
- Add user management interface for admins to revoke user access
- Display OAuth flow logs and error statistics for debugging
- Implement client registration interface for admin-created clients
- Add configuration interface for OAuth settings (token expiration, allowed scopes)
- Follow existing dashboard patterns using shadcn/ui components and oRPC procedures

### Success Criteria:

**Automated verification**
- [ ] `bun run lint` passes with no token validation errors
- [ ] `bun run type-check` passes with proper token and SDK types
- [ ] Token validation functions return correct results for valid/invalid tokens

**Manual Verification**
- [ ] Token introspection endpoint validates JWT tokens correctly and returns proper metadata
- [ ] Protected resource metadata endpoint provides correct authorization server information
- [ ] Organization dashboard displays OAuth clients and user sessions correctly
- [ ] Token validation helpers work correctly for Server SDK integration scenarios
- [ ] Admin interface allows proper management of clients and user access per MCP server

## Performance Considerations

**Database Query Optimization**: MCP server lookups by slug should be cached since they're frequently accessed during subdomain routing. Consider Redis or in-memory caching for production.

**Token Validation Performance**: JWT token validation should use local signing key verification rather than database lookups for each request. Cache public keys and implement proper key rotation.

**Subdomain DNS Resolution**: Wildcard DNS configuration may have propagation delays. Consider health check endpoints to verify subdomain accessibility after MCP server creation.

**OAuth Endpoint Rate Limiting**: Implement rate limiting on OAuth endpoints (authorization, token, registration) to prevent abuse, especially for authorization code generation and token exchange.

## Migration Notes

**Schema Migration Strategy**: New MCP auth schema tables can be added alongside existing platform auth tables without affecting current operations. Use separate migration files for each phase.

**Better Auth Plugin Migration**: MCP plugin configuration is additive to existing platform auth configuration. No changes needed to existing user sessions or platform authentication flows.

**Subdomain Rollout**: Subdomain routing can be implemented with feature flags, allowing gradual rollout per organization without affecting existing platform dashboard access.

**Development Environment**: Use local subdomain simulation (port-based routing or hosts file modification) during development to avoid DNS configuration complexity.

## References
* Original ticket: `specifications/1. dual-auth-system/2. mcp-auth/feature.md`
* MCP OAuth specifications: `specifications/1. dual-auth-system/2. mcp-auth/mcp-specs.md`
* Similar implementation patterns: Reference code provided in prompt for OAuth discovery and protected resource endpoints
* Better Auth MCP plugin: https://www.better-auth.com/docs/plugins/mcp
* OAuth 2.1 specification: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10
* Current platform auth: `packages/dashboard/src/lib/auth/config.ts:21-62`