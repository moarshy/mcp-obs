---
date: 2025-09-24T13:24:51+08:00
researcher: Claude Code
git_commit: 4f27b4d32490cb05dfd984e12b208f091dfc930a
branch: main
repository: mcp-obs
topic: "Platform Authentication System Implementation Strategy"
tags: [implementation, strategy, better-auth, authentication, organizations, platform-auth, multi-tenant]
status: complete
last_updated: 2025-09-24
last_updated_by: Claude Code
type: implementation_strategy
---

# Platform Authentication System Implementation Plan

## Overview

Implementing a complete platform authentication system using Better Auth with multi-organization support for mcp-obs customers. This system enables customer sign-up, organization management, team collaboration, and protected dashboard access with the Doom 64 dark theme aesthetic.

## Current State Analysis

**Infrastructure Ready:**
- Better Auth v1.3.4 installed (`packages/dashboard/package.json:20`)
- Basic Drizzle schema with organizations/users/mcpServers tables (`packages/database/src/schema.ts`)
- Next.js 15 with App Router configured
- Doom 64 theme with OKLCH colors configured (`packages/dashboard/src/app/globals.css`)
- shadcn/ui configuration ready (`components.json`)

**Missing Implementation:**
- All Better Auth configuration and API routes
- Authentication UI components and flows
- Organization management system
- Route protection middleware
- Extended database schema for Better Auth tables
- Multi-organization membership system

### Key Discoveries:
- Current schema supports single organization per user (`packages/database/src/schema.ts:16`) - needs extension
- No existing UI components - greenfield implementation opportunity
- Project follows strict organization-scoping patterns throughout
- Better Auth organization plugin available but needs custom multi-org extension

## What We're NOT Doing

- MCP Server Authentication (end-user auth) - separate feature
- Email verification workflows - out of scope for now
- Email-based team invitations - using shareable links instead
- Light mode theming - focusing on dark mode only
- Advanced RBAC beyond Owner/Admin/Member roles
- SSO integration (SAML, Azure AD) - enterprise feature for later

## Implementation Approach

**Three-phase strategy** maximizing Better Auth's built-in capabilities with incremental delivery:
1. **Phase 1**: Core authentication with oRPC infrastructure and basic organization support
2. **Phase 2**: Multi-organization membership and advanced UI
3. **Phase 3**: Production polish and performance optimization

**Architecture Decisions:**
- Use oRPC from beginning for type-safe server actions and procedures
- Use Better Auth organization plugin as foundation
- Extend with custom multi-organization membership tables
- Dark mode focus with Doom 64 theme
- Build shadcn/ui components incrementally as needed

## Phase 1: Core Better Auth + oRPC Foundation

### Overview
Establish working authentication system with oRPC infrastructure, single-organization context and basic UI.

### Changes Required:

#### 1. oRPC Infrastructure Setup
**File**: `packages/dashboard/src/lib/orpc.server.ts` & `packages/dashboard/src/lib/orpc.ts`
**Changes**: Set up oRPC server and client infrastructure

**Implementation Requirements:**
- Install oRPC dependencies (@orpc/server, @orpc/client, @orpc/next)
- Create oRPC router with authentication context and database access
- Set up client-side oRPC hooks for components
- Configure input validation with Zod schemas
- Implement proper error handling and response formatting
- Create oRPC API route handler at `/api/rpc/[[...rest]]/route.ts`
- Add TypeScript configuration for end-to-end type safety

#### 2. Database Schema Extension
**File**: `packages/database/src/platform-auth-schema.ts`
**Changes**: Create new schema file for Better Auth tables

**Implementation Requirements:**
- Create Better Auth required tables (user, session, account, verification)
- Extend with organization plugin tables (organization, member, invitation)
- Ensure compatibility with existing `packages/database/src/schema.ts` tables
- Add proper foreign key relationships and constraints
- Include organization-scoped unique constraints for email uniqueness
- Add indexes for performance on frequently queried columns

#### 2. Better Auth Configuration
**File**: `packages/dashboard/src/lib/auth.ts`
**Changes**: Complete Better Auth setup with organization plugin

**Implementation Requirements:**
- Configure Better Auth with Drizzle adapter using extended schema
- Enable email/password authentication with basic validation
- Configure Google and GitHub OAuth providers
- Set up organization plugin with appropriate limits and settings
- Configure secure session management with HTTP-only cookies
- Set up proper CORS and trusted origins configuration
- Disable email verification for development (as specified)

#### 3. Authentication API Routes
**File**: `packages/dashboard/src/app/api/auth/[...auth]/route.ts`
**Changes**: Create Better Auth API endpoint handler

**Implementation Requirements:**
- Export GET/POST handlers from Better Auth configuration
- Handle all authentication flows (sign-in, sign-up, OAuth callbacks)
- Proper error handling and response formatting
- Integration with Next.js App Router patterns
- Support for redirect handling and callback URLs

#### 4. Authentication oRPC Procedures
**File**: `packages/dashboard/src/lib/procedures/auth.ts`
**Changes**: Create type-safe authentication procedures

**Implementation Requirements:**
- Create organization creation and switching procedures
- Implement user profile management procedures
- Add organization membership validation procedures
- Include proper input validation with Zod schemas
- Ensure all procedures respect organization scoping
- Add proper error handling and success responses

#### 5. Route Protection Middleware
**File**: `packages/dashboard/middleware.ts`
**Changes**: Create authentication middleware for route protection

**Implementation Requirements:**
- Check authentication status for protected routes
- Redirect unauthenticated users to sign-in with return URL
- Allow public routes (landing pages, auth pages, API routes)
- Handle organization context from URL parameters
- Verify user organization membership for org-scoped routes
- Proper error handling and fallback redirects

#### 6. Core Authentication Components
**File**: `packages/dashboard/src/components/auth/`
**Changes**: Create sign-in and sign-up forms with OAuth support

**Implementation Requirements:**
- SignInForm component with email/password and OAuth buttons
- SignUpForm component with account creation and organization setup flow
- Integration with Better Auth client-side hooks
- Form validation with React Hook Form and Zod schemas
- Loading states and error handling with proper user feedback
- Responsive design with Doom 64 theme styling
- OAuth provider buttons (Google, GitHub) with proper branding
- Password reset flow UI (basic implementation)

#### 7. Basic shadcn/ui Components
**File**: `packages/dashboard/src/components/ui/`
**Changes**: Implement required base components

**Implementation Requirements:**
- Button component with Doom 64 theme variants
- Input and Form components for authentication forms
- Card components for authentication layout
- Dialog/Modal components for organization creation
- Loading spinner and error display components
- Proper TypeScript definitions and accessibility support

### Success Criteria:

**Automated Verification:**
- [ ] No linter errors (`bun run lint`)
- [ ] No TypeScript errors (`bun run type-check`)
- [ ] Database migrations apply successfully
- [ ] Next.js builds without errors (`bun run build`)

**Manual Verification:**
- [ ] Users can sign up with email/password and OAuth
- [ ] Users can sign in and maintain sessions
- [ ] Dashboard is properly protected and redirects work
- [ ] Organization creation flow works during signup via oRPC procedures
- [ ] Basic organization context switching functions via oRPC
- [ ] OAuth flows complete successfully without errors
- [ ] oRPC procedures handle authentication operations correctly
- [ ] No authentication regressions in existing functionality

## Phase 2: Multi-Organization Membership System

### Overview
Extend authentication to support multi-organization membership with role-based access control.

### Changes Required:

#### 1. Multi-Organization Database Schema
**File**: `packages/database/src/platform-auth-schema.ts`
**Changes**: Add junction tables for multi-organization membership

**Implementation Requirements:**
- Create `organization_memberships` table with user/org/role relationships
- Modify existing user-organization relationship to support multiple memberships
- Add proper unique constraints and foreign key cascades
- Include invitation system tables for shareable link invitations
- Add role-based permissions (Owner, Admin, Member) with proper validation
- Ensure backward compatibility with Phase 1 implementation

#### 2. Organization Management Components
**File**: `packages/dashboard/src/components/organization/`
**Changes**: Create organization switcher and management UI

**Implementation Requirements:**
- OrganizationSwitcher dropdown with search and filtering
- CreateOrganizationDialog for new organization creation
- InviteTeamDialog for generating shareable invitation links
- OrganizationSettings for managing organization details
- TeamMembersList with role management and removal
- Proper loading states and error handling throughout
- Responsive design optimized for both desktop and mobile

#### 3. Team Invitation System
**File**: `packages/dashboard/src/app/invite/[token]/page.tsx`
**Changes**: Create shareable link invitation flow

**Implementation Requirements:**
- Public invitation acceptance page with token validation
- Integration with existing user accounts or signup flow
- Proper error handling for expired/invalid invitations
- Organization context display during invitation acceptance
- Automatic role assignment based on invitation
- Success/failure feedback with appropriate redirects

#### 4. Enhanced Authentication Context
**File**: `packages/dashboard/src/lib/auth-context.tsx`
**Changes**: Create React context for authentication and organization state

**Implementation Requirements:**
- AuthProvider with current user and authentication status
- OrganizationProvider with current organization and switching logic
- Server-side organization membership validation
- Client-side state management for organization switching
- Proper loading states during organization context changes
- Integration with Better Auth session management

### Success Criteria:

**Automated Verification:**
- [ ] No linter errors
- [ ] Database schema validates multi-organization constraints
- [ ] All new components render without errors

**Manual Verification:**
- [ ] Users can belong to multiple organizations
- [ ] Organization switching works seamlessly without page reloads
- [ ] Team invitation links work for new and existing users
- [ ] Role-based access controls function correctly
- [ ] Organization settings and member management work properly

## Phase 3: Production Polish and Performance Optimization

### Overview
Add production-ready features, enhanced UI components, and performance optimizations.

### Changes Required:

#### 1. Enhanced UI Components
**File**: `packages/dashboard/src/components/dashboard/`
**Changes**: Create production-ready dashboard layout

**Implementation Requirements:**
- Sidebar navigation with organization context
- User profile dropdown with settings access
- Organization breadcrumbs and context indicators
- Loading skeletons and error boundaries throughout
- Mobile-responsive navigation with collapsible sidebar
- Keyboard navigation and accessibility improvements
- Performance optimizations for large organization lists

#### 2. Advanced Error Handling
**File**: `packages/dashboard/src/components/providers/error-boundary.tsx`
**Changes**: Implement comprehensive error handling

**Implementation Requirements:**
- Global error boundary for authentication failures
- Organization-specific error handling and fallbacks
- Toast notifications for success/error feedback
- Proper error logging for debugging and monitoring
- Graceful degradation for network failures
- User-friendly error messages with actionable guidance

### Success Criteria:

**Automated Verification:**
- [ ] No linter errors
- [ ] All components pass accessibility tests
- [ ] Performance benchmarks meet requirements

**Manual Verification:**
- [ ] Dashboard provides smooth user experience
- [ ] Error handling provides clear feedback to users
- [ ] Performance meets requirements for large organizations
- [ ] Mobile experience is fully functional
- [ ] Keyboard navigation works throughout the application

## Performance Considerations

**Database Optimization:**
- Add indexes on frequently queried columns (organization_id, user_id, email)
- Implement proper connection pooling for production deployment
- Consider read replicas for organization membership queries at scale

**Client Performance:**
- Implement organization list virtualization for users with many organizations
- Add proper caching for organization membership data
- Use React.memo and useMemo for expensive organization calculations

**Session Management:**
- Configure appropriate session timeout and refresh strategies
- Implement proper cleanup for expired sessions and invitations
- Add rate limiting for authentication attempts and organization operations

## Migration Notes

**Phase 1 → Phase 2:**
- Migrate single organization users to multi-organization membership table
- Preserve existing organization ownership relationships
- Update all organization-scoped queries to use new membership system

**Phase 2 → Phase 3:**
- Enhance existing oRPC procedures with additional functionality
- Add comprehensive error handling and performance optimizations
- Implement advanced UI components and accessibility features

**Database Evolution:**
- All migrations designed to be backward compatible
- Proper rollback procedures for each phase
- Data integrity validation after each migration

## References
* Original ticket: `specifications/1. dual-auth-system/1. platform-auth/feature.md`
* Current database schema: `packages/database/src/schema.ts`
* Better Auth documentation: better-auth.com/docs
* Organization plugin: better-auth.com/docs/plugins/organization