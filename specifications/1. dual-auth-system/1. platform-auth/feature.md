---
date: 2025-01-24T15:42:00+00:00
researcher: Claude Code
git_commit: 4f27b4d32490cb05dfd984e12b208f091dfc930a
branch: main
repository: mcp-obs
topic: "Platform Authentication System Feature Specification"
tags: [feature, requirements, specification, authentication, better-auth, organizations, platform-auth]
status: complete
last_updated: 2025-01-24
last_updated_by: Claude Code
type: feature
---

# Platform Authentication System Feature

## Overview
Implement a complete platform authentication system using Better Auth with multi-organization support, enabling MCPlatform customers to sign up, manage organizations, and access the protected dashboard. This system handles authentication for platform users (customers like DocuAPI) who manage MCP servers, with full organization switching capabilities and role-based access.

## Business Value

### For MCPlatform Customers
- **Zero Auth Implementation**: Complete authentication infrastructure without building OAuth, user management, or session handling
- **Multi-Organization Support**: Users can belong to multiple organizations with different roles, enabling team collaboration across companies
- **Enterprise-Ready**: Role-based access control with Owner, Admin, and Member roles, invitation workflows, and organization management out of the box
- **Secure Foundation**: Production-ready authentication with social providers, email/password, and session management

### For Platform Growth
- **Faster Customer Onboarding**: Users can sign up and be productive in under 5 minutes
- **Enterprise Sales Enablement**: Users belonging to multiple organizations enables cross-company collaboration and enterprise adoption
- **User Retention**: Smooth authentication experience reduces bounce rates and improves conversion
- **Scalable Foundation**: Authentication system can handle thousands of organizations and users

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions:
* All database-related paths such as `schema.ts`, `platform-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
Basic project scaffolding exists with:
- Simple database schema at `packages/database/src/schema.ts` with basic `users`, `organizations`, and `mcpServers` tables
- Better Auth dependency installed at version `^1.3.4`
- Environment template configured for Better Auth with OAuth providers
- No authentication implementation exists yet - all auth files need to be created

### Composition Pattern
- **Server Components**: Async components that fetch organization/user data and pass promises to client components
- **Client Components**: Interactive auth forms, organization switchers, profile management with `"use client"` directive
- **oRPC Procedures**: Type-safe server actions for authentication mutations (signup, login, organization management)
- **Suspense/ErrorBoundary**: Proper loading and error states for auth flows

### Data Model
Platform authentication uses dedicated Better Auth schema with organization plugin, stored in PostgreSQL via Drizzle ORM. Multi-organization membership handled through junction tables.

## User Stories
(in given/when/then format)

### New User Registration & Setup
1. **New Customer**: **Given** I'm a new customer visiting mcplatform.com, **when** I click "Sign Up", **then** I should be able to create an account with email/password or social OAuth (Google, GitHub) and be guided through organization creation - *Complete signup and org setup flow in under 2 minutes with clear onboarding*

2. **Organization Creator**: **Given** I just signed up, **when** I complete registration, **then** I should be prompted to create my first organization with name and slug, automatically becoming the admin - *Seamless transition from personal account to organization setup*

### Authentication & Access Control
3. **Returning User**: **Given** I'm an existing user, **when** I visit the platform, **then** I should be automatically logged in if my session is valid, or redirected to login with my preferred authentication method - *Persistent sessions with secure auto-login*

4. **Dashboard Access**: **Given** I'm not authenticated, **when** I try to access the dashboard, **then** I should be redirected to the sign-in page and returned to my intended destination after login - *Protected routes with return URL handling*

### Multi-Organization Management
5. **Organization Member**: **Given** I belong to multiple organizations, **when** I access the dashboard, **then** I should see an organization switcher and be able to seamlessly switch context without re-authentication - *Smooth multi-org experience with context preservation*

6. **Team Collaboration**: **Given** I'm an admin of an organization, **when** I invite a team member, **then** I should get a shareable invitation link that they can use to join with their existing account or create a new one, and have appropriate role-based access - *Complete team invitation and onboarding workflow via shareable links*

### Session & Profile Management
7. **Profile Management**: **Given** I'm authenticated, **when** I access my profile, **then** I should be able to update my personal information, change password, connect/disconnect OAuth providers, and manage my organization memberships - *Comprehensive user profile management*

8. **Secure Logout**: **Given** I want to sign out, **when** I logout, **then** my session should be properly terminated, I should be redirected to the public homepage, and attempting to access protected pages should require re-authentication - *Complete session cleanup and security*

## Core Functionality

### Authentication Foundation
- **Multiple Auth Methods**: Email/password, Google OAuth, GitHub OAuth with seamless account linking
- **Session Management**: Secure JWT-based sessions with refresh tokens and proper expiration handling
- **Password Security**: Basic password handling and reset flows with secure tokens (Note: Password hashing and strength requirements disabled for development)
- **Account Verification**: Email verification for new accounts, resend verification options

### Organization Management System
- **Multi-Organization Membership**: Users can belong to multiple organizations with different roles
- **Organization Creation**: Guided flow for creating new organizations with name, slug, and initial configuration
- **Role-Based Access**: Owner, Admin, and Member roles with granular permissions for MCP server management
- **Team Invitations**: Link-based invitation system with shareable invitation URLs (email flow disabled for development)

### Dashboard & UI System
- **Protected Dashboard**: Main application interface only accessible to authenticated users
- **Organization Context**: Clear indication of current organization with easy switching mechanism
- **Public Pages**: Marketing pages, pricing, documentation accessible without authentication
- **Responsive Design**: Mobile-first approach with sidebar navigation and collapsible menus

## Requirements

### Functional Requirements
- **Better Auth Integration**: Complete Better Auth setup with organization plugin and social providers
- **Database Schema**: Extended platform auth schema with users, organizations, sessions, memberships, and invitations
- **API Layer**: oRPC procedures for all authentication operations (signup, login, organization management)
- **UI Components**: Complete authentication UI using shadcn/ui components (forms, modals, navigation)
- **Route Protection**: Middleware-based route protection for dashboard pages with redirect handling
- **Email Integration**: Transactional emails for verification and password reset only (team invitations use shareable links)

### Non-Functional Requirements

#### Security & Permissions
- **Session Security**: Secure HTTP-only cookies with proper SameSite and domain configuration
- **OAuth Security**: Proper PKCE implementation for OAuth flows with CSRF protection
- **Role Enforcement**: Server-side role validation for all organization operations
- **Data Isolation**: Complete organization boundary enforcement in all database queries

#### User Experience
- **Authentication Flows**: Seamless OAuth flows with proper error handling and user feedback
- **Organization Switching**: Instant context switching without page reloads


## Design Considerations

### Layout & UI
- **Authentication Pages**: Clean, centered forms with MCPlatform branding and clear CTAs
- **Dashboard Layout**: Sidebar navigation with organization switcher, user menu, and main content area
- **Organization Switcher**: Dropdown or modal interface showing all user organizations with search
- **Loading States**: Skeleton loading for authentication checks and organization data

### Responsive Behavior
- **Desktop**: Full sidebar navigation with expanded organization details
- **Tablet**: Collapsible sidebar with condensed organization switcher
- **Mobile**: Bottom navigation or hamburger menu with slide-out organization list
- **Breakpoint Strategy**: Use Tailwind's responsive utilities (sm, md, lg, xl)

### State Management
- **Authentication State**: React Context for current user and authentication status
- **Organization Context**: Separate context for current organization and switching logic
- **URL State**: Organization slug in URL for bookmarkable organization-specific pages
- **Form State**: React Hook Form for all authentication forms with proper validation

## Implementation Considerations

### Technical Architecture
- **Better Auth Configuration**: Dual auth setup (platform auth only for this feature)
- **Database Design**: Proper foreign key relationships with organization-scoped data
- **API Design**: RESTful auth endpoints via Better Auth + oRPC procedures for business logic
- **Middleware**: Next.js middleware for route protection and organization context injection

### Dependencies
- **Authentication**: Better Auth v1.3.4+ with organization plugin
- **Database**: Drizzle ORM with PostgreSQL adapter
- **UI Framework**: shadcn/ui components with Tailwind CSS v4
- **Forms**: React Hook Form with Zod validation
- **Email**: Better Auth email integration or external provider (SendGrid, AWS SES)

## Success Criteria

### Core Functionality
-  Users can sign up with email/password or OAuth providers (Google, GitHub)
-  Email verification works with resend capabilities
-  Password reset flow functions correctly with secure tokens
-  Dashboard is properly protected and redirects unauthenticated users
-  Organization creation and membership management works seamlessly

### Technical Implementation
-  Better Auth properly configured with organization plugin
-  Database schema supports multi-organization membership with proper constraints
-  All database operations properly scoped to user's accessible organizations
-  oRPC procedures handle authentication mutations with proper error handling
-  Session management works correctly with secure cookies and refresh tokens

### Engagement Metrics
- **Signup Completion**: >90% of users who start signup complete the process
- **Organization Setup**: >85% of new users create an organization within 24 hours
- **Session Persistence**: >95% of returning users maintain valid sessions for intended duration
- **Multi-Org Adoption**: >40% of active users belong to multiple organizations within 30 days

### Business Impact
- **Time to Dashboard**: New users access dashboard in under 3 minutes from landing page
- **Team Adoption**: >60% of organizations invite additional members within 7 days
- **Authentication Success**: >99.5% uptime for authentication services
- **User Retention**: Authentication issues cause <1% of user churn

## Scope Boundaries

### Definitely In Scope
- **Platform User Authentication**: Complete signup, login, logout, and profile management
- **Multi-Organization Support**: Users can belong to and switch between multiple organizations
- **Role-Based Access Control**: Admin, Member, Viewer roles with appropriate permissions
- **Team Management**: Organization creation, member invitations, role assignments
- **Protected Dashboard**: Route protection and authentication-aware navigation
- **Better Auth Integration**: Full Better Auth setup with organization plugin
- **Social OAuth**: Google and GitHub OAuth integration
- **Email Verification**: Account verification and password reset workflows

### Definitely Out of Scope
- **MCP Server Authentication**: End-user auth for MCP servers (separate feature)
- **Advanced RBAC**: Custom permissions beyond basic Owner/Admin/Member roles
- **SSO Integration**: SAML, Azure AD, Okta (enterprise feature for later)
- **Advanced Security**: 2FA, device management, audit logs (enterprise features)
- **Billing Integration**: Subscription management, payment processing
- **Advanced Organization Features**: Custom domains, whitelabeling, API keys

### Future Considerations
- **Enterprise SSO**: SAML and OIDC providers for enterprise customers
- **Advanced Security**: Two-factor authentication, device trust, session management
- **Audit Logging**: Complete audit trail for security and compliance
- **Advanced Permissions**: Custom role creation and granular permissions
- **API Authentication**: API keys and service accounts for programmatic access

## Open Questions & Risks

### Questions Needing Resolution
- **Email Provider**: Use Better Auth built-in email or external provider (SendGrid, AWS SES)?
- **Session Duration**: Appropriate session lifetime and refresh token strategy?
- **Organization Limits**: Should there be limits on organizations per user or members per organization?
- **Invitation Expiry**: How long should organization invitations remain valid?

### Identified Risks
- **Better Auth Maturity**: Version 1.3.4 is relatively new - potential stability issues
- **Organization Plugin**: Organization plugin complexity might affect performance or reliability
- **Database Migrations**: Schema changes during development might affect existing development data
- **OAuth Provider Limits**: Rate limits on Google/GitHub OAuth during development and testing

### Mitigation Strategies
- **Better Auth Testing**: Comprehensive testing of all auth flows in development environment
- **Database Backup**: Regular backups during development and staging deployment
- **OAuth Sandbox**: Use OAuth sandbox/development keys during testing
- **Rollback Plan**: Keep authentication optional initially with feature flags

## Next Steps
- Set up Better Auth configuration with organization plugin
- Create extended platform auth database schema
- Implement authentication UI components with shadcn/ui
- Create protected route middleware and organization context
- Build organization management interface and team invitation flows
- Integrate email provider for verification and notifications
- Ready for dashboard feature implementation once authentication foundation is complete

## Implementation Details

### Database Schema Extension

#### Better Auth Tables
```typescript
// Generated by Better Auth with organization plugin
export const authTables = {
  user: pgTable('user', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('emailVerified').notNull().default(false),
    name: text('name').notNull(),
    image: text('image'),
    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').notNull()
  }),

  session: pgTable('session', {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expiresAt').notNull(),
    token: text('token').notNull().unique(),
    userId: text('userId').notNull().references(() => user.id)
  }),

  account: pgTable('account', {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId').notNull().references(() => user.id)
  }),

  verification: pgTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expiresAt').notNull()
  })
}
```

#### Organization Extension
```typescript
// Extended schema for multi-organization support
export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logoUrl'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow()
})

export const member = pgTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organizationId').notNull().references(() => organization.id),
  userId: text('userId').notNull().references(() => user.id),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  createdAt: timestamp('createdAt').notNull().defaultNow()
})

export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  organizationId: text('organizationId').notNull().references(() => organization.id),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  status: text('status', { enum: ['pending', 'accepted', 'expired'] }).notNull().default('pending'),
  invitedBy: text('invitedBy').notNull().references(() => user.id),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow()
})
```

### Better Auth Configuration
```typescript
// src/lib/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { db } from '@/lib/db'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...authTables,
      organization,
      member,
      invitation
    }
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // Send password reset email
    }
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!
    }
  },
  plugins: [
    organization({
      sendInvitationEmail: async (data) => {
        // Send organization invitation email
      },
      organizationLimit: 10, // Max organizations per user
      memberLimit: 100 // Max members per organization
    })
  ],
  trustedOrigins: [process.env.BETTER_AUTH_URL!],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 minutes
    }
  }
})
```

### Route Protection Middleware
```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/auth/sign-in', '/auth/sign-up', '/pricing', '/docs']

  if (publicRoutes.includes(pathname) || pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  // Protected routes - require authentication
  try {
    const session = await auth.api.getSession({
      headers: request.headers
    })

    if (!session?.user) {
      const url = new URL('/auth/sign-in', request.url)
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }

    // Add organization context if available
    const orgSlug = request.nextUrl.searchParams.get('org')
    if (orgSlug) {
      // Verify user has access to organization
      const membership = await auth.api.getMembership({
        organizationSlug: orgSlug,
        userId: session.user.id
      })

      if (!membership) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    return NextResponse.next()
  } catch (error) {
    const url = new URL('/auth/sign-in', request.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
```

### Key Components Structure

#### Authentication Forms
```typescript
// src/components/auth/sign-in-form.tsx
export function SignInForm() {
  const form = useForm<SignInData>({
    resolver: zodResolver(signInSchema)
  })

  // Email/password and OAuth sign-in options
  // Redirect handling for return URLs
  // Error display and loading states
}

// src/components/auth/sign-up-form.tsx
export function SignUpForm() {
  // Registration with email verification
  // OAuth registration options
  // Organization creation flow integration
}
```

#### Organization Management
```typescript
// src/components/organization/organization-switcher.tsx
export function OrganizationSwitcher() {
  // Dropdown with user's organizations
  // Search and filtering capabilities
  // Current organization indication
  // "Create New Organization" option
}

// src/components/organization/create-organization-dialog.tsx
export function CreateOrganizationDialog() {
  // Modal form for new organization creation
  // Name and slug validation
  // Immediate context switch to new org
}
```

### oRPC Procedures
```typescript
// src/lib/procedures/auth.ts
export const authProcedures = router({
  createOrganization: procedure
    .input(z.object({
      name: z.string().min(1).max(100),
      slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/)
    }))
    .mutation(async ({ input, ctx }) => {
      // Create organization and add user as admin
      // Return organization data for immediate context switch
    }),

  inviteMember: procedure
    .input(z.object({
      organizationId: z.string(),
      email: z.string().email(),
      role: z.enum(['owner', 'admin', 'member'])
    }))
    .mutation(async ({ input, ctx }) => {
      // Send invitation email
      // Create invitation record
      // Return invitation status
    }),

  switchOrganization: procedure
    .input(z.object({
      organizationSlug: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify user membership
      // Update session context
      // Return organization data
    })
})
```

This comprehensive platform authentication system provides the foundation for all MCPlatform customer interactions, with robust multi-organization support and enterprise-ready user management capabilities.