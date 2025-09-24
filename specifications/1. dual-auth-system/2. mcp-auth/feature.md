---
date: 2025-01-24T15:42:00+00:00
researcher: Claude Code
git_commit: 6ce2367a585aaa7dea4105333a85b6dcb135f89e
branch: main
repository: mcp-obs
topic: "MCP Authentication System Feature Specification"
tags: [feature, requirements, specification, mcp-auth, oauth, subdomain, authorization-server, dynamic-client-registration, pkce]
status: complete
last_updated: 2025-01-24
last_updated_by: Claude Code
type: feature
---

# MCP Authentication System Feature

## Overview
Implement a complete OAuth 2.1 Authorization Server that enables end-user authentication for customer MCP servers through subdomain-based identification. This system handles authentication for end-users (users of customer products like DocuAPI) accessing MCP servers, with full RFC-compliant OAuth discovery endpoints, dynamic client registration, PKCE support, and organization-scoped token management.

## Business Value

### For mcp-obs Customers
- **Zero Auth Implementation**: Complete OAuth Authorization Server infrastructure without building OAuth endpoints, token management, or user authentication flows
- **Subdomain-Based Identity**: Each MCP server gets a dedicated subdomain (e.g., `docuapi.mcp-obs.com`) for clean brand separation and user experience
- **Enterprise OAuth Compliance**: RFC 8414/7591 compliant OAuth server with discovery endpoints, dynamic client registration, and PKCE security
- **Scalable User Management**: Handle thousands of end-users per MCP server with proper token scoping and session management

### For End-Users
- **Familiar OAuth Flow**: Standard OAuth 2.1 authentication experience users recognize from Google, GitHub, etc.
- **Cross-Client Sessions**: Single sign-on across multiple MCP clients accessing the same server
- **Secure Token Management**: Short-lived access tokens with refresh capability for optimal security
- **Consistent Experience**: Standardized authentication flows across all MCP servers

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions:
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
Platform authentication system is implemented with Better Auth, providing the foundation for customer organization management. The existing system includes:
- Better Auth configuration at `src/lib/auth.ts` with OAuth capabilities
- Database schema at `packages/database/src/auth-schema.ts` with OAuth application tables
- oRPC procedures for platform authentication at `src/lib/orpc/procedures/auth.ts`
- Basic MCP server table in `packages/database/src/schema.ts` with organization relationships

### Composition Pattern
- **Server Components**: Async components that fetch OAuth metadata, client registrations, and user tokens, passing promises to client components
- **Client Components**: Interactive OAuth authorization flows, consent screens, and token management with `"use client"` directive
- **oRPC Procedures**: Type-safe server actions for OAuth operations (client registration, token exchange, consent management)
- **Discovery Endpoints**: Static JSON responses for `.well-known` OAuth metadata endpoints

### Data Model
MCP authentication uses dedicated OAuth schema with organization-scoped MCP servers, stored in PostgreSQL via Drizzle ORM. Subdomain-based MCP server identification with end-user isolation per organization.

## User Stories
(in given/when/then format)

### MCP Server Registration & Setup
1. **Organization Admin**: **Given** I have a platform account with an organization, **when** I register a new MCP server with slug "docuapi", **then** it should be accessible at `docuapi.mcp-obs.com` and I should receive OAuth configuration details for integration - *Complete MCP server registration with subdomain allocation and OAuth setup in under 5 minutes*

2. **OAuth Discovery**: **Given** an MCP client wants to authenticate with `docuapi.mcp-obs.com`, **when** it fetches `https://docuapi.mcp-obs.com/.well-known/oauth-authorization-server`, **then** it should receive RFC 8414 compliant metadata with authorization, token, and registration endpoints - *Seamless OAuth discovery for automatic client configuration*

### Dynamic Client Registration
3. **MCP Client Registration**: **Given** an MCP client needs to authenticate with a server, **when** it performs RFC 7591 dynamic client registration with metadata (name, redirect_uris, logo_uri), **then** it should receive a client_id, client_secret, and be ready to authenticate users - *Zero-touch client registration for any MCP client*

4. **Client Management**: **Given** I'm an organization admin, **when** I view my MCP server dashboard, **then** I should see all registered OAuth clients with their metadata, usage statistics, and ability to revoke client access - *Complete visibility and control over OAuth clients*

### End-User Authentication Flow
5. **Authorization Flow**: **Given** an end-user wants to access a protected MCP server, **when** they're redirected to the OAuth authorization endpoint with PKCE parameters, **then** they should see a branded consent screen and be able to authenticate with email/password or social OAuth - *Secure PKCE-enabled OAuth flow with familiar UX*

6. **Token Exchange**: **Given** an MCP client has an authorization code, **when** it exchanges the code with PKCE code_verifier at the token endpoint, **then** it should receive access_token, refresh_token, and token metadata with proper audience scoping to the MCP server - *Secure token exchange with proper audience binding*

### Session & Token Management
7. **Cross-Client Sessions**: **Given** an end-user is authenticated with one MCP client for a server, **when** they authenticate with another client for the same MCP server, **then** they should have streamlined consent (if already granted) and proper token scoping - *Seamless multi-client experience per MCP server*

8. **Token Refresh**: **Given** an MCP client has an expired access token but valid refresh token, **when** it calls the token endpoint with grant_type=refresh_token, **then** it should receive a new access token without user interaction - *Uninterrupted access with proper token refresh*

### Organization & Access Control
9. **End-User Isolation**: **Given** I'm an end-user authenticated for `docuapi.mcp-obs.com`, **when** I try to access resources from `competitor.mcp-obs.com`, **then** my tokens should not grant access and I should need separate authentication - *Complete end-user isolation between organizations*

10. **Admin Management**: **Given** I'm an organization admin, **when** I access the MCP server management dashboard, **then** I should see user analytics, token usage, client registrations, and ability to revoke user access - *Comprehensive admin controls and visibility*

## Core Functionality

### OAuth Authorization Server
- **Discovery Endpoints**: RFC 8414 `.well-known/oauth-authorization-server` and `.well-known/oauth-protected-resource` at subdomain level
- **Authorization Endpoint**: PKCE-required authorization flow with branded consent screens per MCP server
- **Token Endpoint**: Authorization code exchange, refresh token handling, and client credentials support
- **Dynamic Client Registration**: RFC 7591 compliant client registration with automatic client_id generation and optional client_secret (not required for PKCE-only clients)

### Subdomain-Based MCP Server Identification
- **Subdomain Routing**: Route requests to `{slug}.mcp-obs.com` to appropriate MCP server OAuth context
- **Slug Validation**: Global slug uniqueness validation and reservation system across all organizations
- **Organization Scoping**: All OAuth operations scoped to the organization that owns the MCP server
- **SSL/TLS Support**: Automatic SSL certificate provisioning for customer subdomains in production, with localhost development support

### End-User Authentication & Management
- **Multiple Auth Providers**: Email/password, Google OAuth, GitHub OAuth with account linking
- **Consent Management**: Granular scope-based consent with remember/revoke capabilities
- **Session Management**: JWT-based sessions with proper expiration and cross-client coordination
- **User Profile**: Basic profile management within each MCP server context

### Token & Security Management
- **PKCE Enforcement**: Mandatory PKCE for all authorization flows with S256 code challenge method
- **Audience Binding**: All tokens bound to specific MCP server canonical URI
- **Scope Enforcement**: Configurable OAuth scopes per MCP server (read, write, admin, custom)
- **Token Introspection**: RFC 7662 token introspection endpoint for resource server validation

## Requirements

### Functional Requirements
- **Subdomain Resolution**: DNS and routing infrastructure for `*.mcp-obs.com` subdomain handling
- **OAuth Server Compliance**: Full RFC 8414, RFC 7591, RFC 6749, RFC 7636 (PKCE) compliance
- **Database Schema Extension**: MCP-specific OAuth tables for clients, tokens, consents, and user sessions
- **Discovery Endpoints**: Automated `.well-known` endpoint generation based on MCP server configuration
- **API Integration**: oRPC procedures for all OAuth operations and admin management
- **Client SDK Integration**: Hooks for Server SDK and Client SDK to validate tokens and manage sessions

### Non-Functional Requirements

#### Security & Permissions
- **HTTPS Enforcement**: All OAuth endpoints require HTTPS in production with proper redirect URI validation (relaxed for localhost development)
- **Token Security**: Short-lived access tokens (2 hours), secure refresh token rotation
- **Client Authentication**: Support for client_secret_basic, client_secret_post, and none (for PKCE-only clients)
- **Rate Limiting**: Aggressive rate limiting on OAuth endpoints to prevent abuse
- **Organization Isolation**: Complete data isolation between organizations and MCP servers

#### User Experience
- **Standard OAuth Flows**: Clean, consistent OAuth consent screens across all MCP servers
- **Mobile-Optimized**: Responsive OAuth consent screens optimized for mobile browsers
- **Error Handling**: Clear, actionable error messages for OAuth flow failures

## Design Considerations

### Layout & UI
- **OAuth Consent Screen**: Clean, minimal design with clear scope explanations
- **Client Registration**: Developer-friendly interface for managing OAuth client applications
- **Admin Dashboard**: Organization admins can view user analytics, client management, and token usage
- **Error Pages**: Standard error pages for OAuth failures (invalid_client, access_denied, etc.)


### State Management
- **OAuth State**: Secure state parameter handling with CSRF protection and session binding
- **PKCE Storage**: Temporary code_verifier storage with automatic cleanup
- **Consent Memory**: User consent preferences cached per client-server combination
- **Session Context**: MCP server context maintained throughout OAuth flow

## Implementation Considerations

### Technical Architecture
- **Subdomain Routing**: Next.js middleware with subdomain detection and MCP server context injection
- **OAuth Provider**: Custom OAuth implementation using Better Auth OAuth capabilities + RFC extensions
- **Token Storage**: JWT tokens with organization and MCP server audience claims
- **Client Registry**: Dynamic client registration with validation and management

### Dependencies
- **Better Auth OAuth**: Extend existing Better Auth with OAuth server capabilities
- **DNS Management**: AWS Route 53 or Cloudflare for `*.mcp-obs.com` subdomain delegation
- **SSL Certificates**: Automatic certificate provisioning for customer subdomains
- **JWT Libraries**: Token generation, validation, and introspection capabilities
- **Cryptographic Libraries**: PKCE challenge generation and validation

## Success Criteria

### Core Functionality
- MCP clients can discover OAuth metadata via `.well-known` endpoints with 100% RFC compliance
- Dynamic client registration works for all MCP client types (desktop, web, mobile)
- End-users can authenticate with email/password or social OAuth providers
- PKCE authorization flows work correctly with proper security validation
- Token exchange and refresh flows operate without user interaction

### Technical Implementation
- All OAuth endpoints respond within performance requirements (<100ms token operations)
- Subdomain routing correctly isolates MCP servers with zero cross-contamination
- Database operations properly scoped to organization and MCP server boundaries
- Token introspection validates audience, expiration, and scope claims correctly
- Rate limiting prevents abuse without affecting legitimate usage

### Engagement Metrics
- **Client Registration Success**: >95% of client registration attempts succeed on first try
- **Authorization Flow Completion**: >90% of started OAuth flows complete successfully
- **Token Refresh Success**: >99.9% of refresh token operations succeed
- **Cross-Client SSO**: >80% of users with existing sessions skip re-authentication

### Business Impact
- **Time to Integration**: Developers integrate MCP OAuth in under 15 minutes
- **User Authentication Success**: >99% uptime for OAuth authorization flows
- **End-User Satisfaction**: <2% OAuth-related user complaints or support tickets
- **Customer Adoption**: >70% of MCP servers enable OAuth authentication within 30 days

## Scope Boundaries

### Definitely In Scope
- **OAuth 2.1 Authorization Server**: Complete server implementation with all required endpoints
- **RFC Compliance**: Full RFC 8414, RFC 7591, RFC 6749, RFC 7636 compliance
- **Subdomain-Based Identification**: `{slug}.mcp-obs.com` routing and SSL provisioning
- **Dynamic Client Registration**: Zero-touch client onboarding for any MCP client
- **End-User Authentication**: Email/password and social OAuth for end-users
- **PKCE Security**: Mandatory PKCE with S256 for all authorization flows
- **Organization Scoping**: Complete isolation between organizations and MCP servers
- **Admin Dashboard**: Organization-level management of OAuth clients and users

### Definitely Out of Scope
- **Platform User OAuth**: Platform authentication remains separate (covered in platform-auth feature)
- **Advanced Token Features**: JWT encryption, nested tokens, or custom token formats
- **Enterprise Identity Providers**: SAML, Azure AD, Okta integration (enterprise feature)
- **Advanced Client Management**: Client rotation, client policies, or fine-grained permissions
- **Audit Logging**: Detailed OAuth audit trails (compliance feature for later)
- **Multi-Region Support**: Cross-region token validation or geo-distributed OAuth servers

### Future Considerations
- **OpenID Connect**: OIDC support for identity token capabilities
- **Device Authorization Grant**: RFC 8628 for device/TV authentication flows
- **Token Exchange**: RFC 8693 for advanced token delegation scenarios
- **Mutual TLS**: Enhanced client authentication for high-security use cases
- **Custom Scopes**: Organization-defined OAuth scopes beyond standard read/write

## Open Questions & Risks

### Questions Needing Resolution
- **Subdomain DNS**: Use AWS Route 53 wildcard delegation or per-subdomain CNAME records?
- **SSL Provisioning**: Let's Encrypt wildcard certificates or individual subdomain certificates?
- **Token Expiration**: Standard 60-minute access tokens or configurable per MCP server?
- **Client Secret Rotation**: Automatic client_secret rotation policy and notification system?
- **Refresh Token Limits**: Maximum refresh token lifetime and rotation frequency?

### Identified Risks
- **DNS Propagation**: Subdomain DNS changes may take time to propagate globally
- **SSL Certificate Limits**: Let's Encrypt rate limits may affect rapid MCP server creation
- **Better Auth OAuth**: Extending Better Auth for full OAuth server capability may require significant customization
- **Performance at Scale**: Token generation and validation performance under high load
- **Subdomain Squatting**: Need robust slug reservation and conflict resolution

### Mitigation Strategies
- **DNS Monitoring**: Implement DNS propagation monitoring and health checks
- **Certificate Management**: Use wildcard certificates with proper rotation and monitoring
- **OAuth Testing**: Comprehensive OAuth compliance testing with automated RFC validation
- **Performance Testing**: Load testing for token endpoints under realistic usage patterns
- **Slug Management**: Proactive slug validation with conflict resolution workflows

## Next Steps
- Design MCP-specific OAuth database schema extension
- Implement subdomain routing middleware with MCP server context
- Build OAuth Authorization Server endpoints with RFC compliance
- Create dynamic client registration system with validation
- Develop branded OAuth consent screens and admin dashboard
- Integrate with existing Better Auth system for end-user authentication
- Test OAuth flows with real MCP clients and validate RFC compliance
- Ready for Server SDK and Client SDK integration once OAuth foundation is complete

## Implementation Details

### Subdomain-Based Architecture

#### DNS Configuration
```typescript
// Subdomain routing configuration
export const SUBDOMAIN_CONFIG = {
  // Production configuration
  production: {
    wildcardDomain: '*.mcp-obs.com',
    baseDomain: 'mcp-obs.com',
    sslProvider: 'letsencrypt', // or 'aws-acm'
    dnsProvider: 'route53',     // or 'cloudflare'
    requireHttps: true,
  },

  // Development configuration
  development: {
    wildcardDomain: '*.localhost:3000',
    baseDomain: 'localhost:3000',
    sslProvider: 'none',
    dnsProvider: 'local',
    requireHttps: false,
    // Use port-based routing for local dev: localhost:3001, localhost:3002, etc.
    usePortRouting: true,
    startPort: 3001,
  },

  // Reserved subdomains that cannot be used for MCP servers
  reservedSubdomains: [
    'www', 'api', 'admin', 'docs', 'status', 'blog',
    'mail', 'ftp', 'mx', 'ns1', 'ns2', 'test', 'dev'
  ]
}
```

#### Middleware Implementation
```typescript
// src/middleware.ts - Subdomain Detection with Development Support
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getMcpServerBySlug, getMcpServerByPort } from '@/lib/mcp-servers'
import { SUBDOMAIN_CONFIG } from '@/lib/subdomain-config'

const isDevelopment = process.env.NODE_ENV === 'development'
const config = isDevelopment ? SUBDOMAIN_CONFIG.development : SUBDOMAIN_CONFIG.production

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''

  let mcpServer = null

  if (isDevelopment && config.usePortRouting) {
    // Development: Use port-based routing (localhost:3001, localhost:3002, etc.)
    const portMatch = host.match(/:(\d+)$/)
    if (portMatch) {
      const port = parseInt(portMatch[1])
      if (port >= config.startPort) {
        mcpServer = await getMcpServerByPort(port)
      }
    }
  } else {
    // Production: Use subdomain routing (slug.mcp-obs.com)
    const subdomain = extractSubdomain(host)
    if (subdomain && subdomain !== 'www') {
      mcpServer = await getMcpServerBySlug(subdomain)
    }
  }

  if (mcpServer) {
    // Add MCP server context to request
    request.nextUrl.searchParams.set('mcp_server_id', mcpServer.id)
    request.nextUrl.searchParams.set('mcp_org_id', mcpServer.organizationId)

    // Route OAuth endpoints
    if (request.nextUrl.pathname.startsWith('/.well-known/')) {
      return NextResponse.rewrite(new URL(`/api/mcp-oauth${request.nextUrl.pathname}`, request.url))
    }

    if (request.nextUrl.pathname.startsWith('/oauth/')) {
      return NextResponse.rewrite(new URL(`/api/mcp-oauth${request.nextUrl.pathname}`, request.url))
    }
  }

  return NextResponse.next()
}

function extractSubdomain(host: string): string | null {
  const baseDomain = config.baseDomain.replace(/:\d+$/, '') // Remove port for comparison
  const hostWithoutPort = host.replace(/:\d+$/, '')

  if (hostWithoutPort === baseDomain || hostWithoutPort === `www.${baseDomain}`) {
    return null
  }

  const subdomain = hostWithoutPort.replace(`.${baseDomain}`, '')
  return subdomain.includes('.') ? null : subdomain
}
```

### OAuth Server Database Schema

#### MCP OAuth Tables Extension
```typescript
// packages/database/src/mcp-auth-schema.ts
import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './schema'

// MCP Servers with OAuth configuration
export const mcpServer = pgTable('mcp_server', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // Global slug for subdomain
  description: text('description'),
  logoUrl: text('logo_url'),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

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
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id),
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
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id),

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
  clientId: text('client_id').notNull().references(() => mcpOauthClient.clientId),
  userId: uuid('user_id').notNull().references(() => mcpEndUser.id),
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id),

  // OAuth Flow Metadata
  codeChallenge: text('code_challenge'),
  codeChallengeMethod: text('code_challenge_method'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
})

// OAuth Consent Records
export const mcpOauthConsent = pgTable('mcp_oauth_consent', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => mcpEndUser.id),
  clientId: text('client_id').notNull().references(() => mcpOauthClient.clientId),
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id),

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
  clientId: text('client_id').notNull().references(() => mcpOauthClient.clientId),
  userId: uuid('user_id').notNull().references(() => mcpEndUser.id),
  mcpServerId: uuid('mcp_server_id').notNull().references(() => mcpServer.id),
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
```

### Slug Management & Validation System

#### Global Slug Validation
```typescript
// src/lib/mcp-server-validation.ts
import { db } from '@/lib/db'
import { mcpServer } from '@/db/mcp-auth-schema'
import { eq } from 'drizzle-orm'

// Reserved subdomains that cannot be used for MCP servers
const RESERVED_SLUGS = [
  'www', 'api', 'admin', 'docs', 'status', 'blog', 'mail', 'ftp',
  'mx', 'ns1', 'ns2', 'test', 'dev', 'staging', 'prod', 'app',
  'dashboard', 'console', 'panel', 'support', 'help', 'cdn',
  'assets', 'static', 'media', 'files', 'download', 'upload'
]

export async function validateMcpServerSlug(
  slug: string,
  excludeServerId?: string
): Promise<{ valid: boolean; error?: string }> {
  // Basic validation
  if (!slug || slug.length < 2) {
    return { valid: false, error: 'Slug must be at least 2 characters long' }
  }

  if (slug.length > 50) {
    return { valid: false, error: 'Slug must be 50 characters or less' }
  }

  // Format validation
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  if (!slugRegex.test(slug)) {
    return {
      valid: false,
      error: 'Slug must contain only lowercase letters, numbers, and hyphens (no consecutive hyphens or leading/trailing hyphens)'
    }
  }

  // Reserved slug check
  if (RESERVED_SLUGS.includes(slug)) {
    return { valid: false, error: 'This slug is reserved and cannot be used' }
  }

  // Database uniqueness check
  const existingServer = await db
    .select({ id: mcpServer.id })
    .from(mcpServer)
    .where(eq(mcpServer.slug, slug))
    .limit(1)

  if (existingServer.length > 0 && existingServer[0].id !== excludeServerId) {
    return { valid: false, error: 'This slug is already taken' }
  }

  return { valid: true }
}

export async function generateSuggestedSlug(baseName: string): Promise<string[]> {
  const baseSlug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30) // Leave room for suffix

  const suggestions: string[] = []

  // Try base slug first
  const baseValidation = await validateMcpServerSlug(baseSlug)
  if (baseValidation.valid) {
    suggestions.push(baseSlug)
  }

  // Generate numbered variations
  for (let i = 2; i <= 10; i++) {
    const numberedSlug = `${baseSlug}-${i}`
    const validation = await validateMcpServerSlug(numberedSlug)
    if (validation.valid) {
      suggestions.push(numberedSlug)
    }
  }

  // Generate abbreviated variations
  if (baseSlug.length > 10) {
    const abbreviated = baseSlug.substring(0, 10)
    for (let i = 1; i <= 5; i++) {
      const abbreviatedSlug = `${abbreviated}-${i}`
      const validation = await validateMcpServerSlug(abbreviatedSlug)
      if (validation.valid) {
        suggestions.push(abbreviatedSlug)
      }
    }
  }

  return suggestions.slice(0, 5) // Return top 5 suggestions
}
```

This comprehensive MCP Authentication System provides a complete OAuth 2.1 Authorization Server with subdomain-based MCP server identification, enabling seamless end-user authentication for customer MCP servers with full RFC compliance and enterprise-ready security features.