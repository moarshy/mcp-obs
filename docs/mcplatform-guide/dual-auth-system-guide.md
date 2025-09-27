# MCPlatform Dual Auth System Guide

## Overview

MCPlatform implements a dual authentication architecture that separates platform authentication from MCP server authentication using Better Auth and a dual-schema pattern. This approach enables clean separation between authentication and business logic while maintaining full compatibility with Better Auth's expectations.

## Key Insight: Dual Schema Architecture

MCPlatform uses **two completely separate user systems** that work in parallel rather than trying to map Better Auth to custom business tables:

### 1. Better Auth MCP Instance (Authentication Layer)
- **Purpose**: Handles OAuth flows, login sessions, social authentication
- **Tables**: Standard Better Auth schema with MCP prefixes
- **Schema**: `mcp_oauth_user`, `mcp_oauth_session`, `mcp_oauth_account`

### 2. Custom MCP Server Users (Business Logic Layer)
- **Purpose**: Analytics, tool tracking, organization scoping, user capture
- **Tables**: Custom business schema
- **Schema**: `mcp_server_user`, `mcp_server_session`, `tool_calls`, `walkthrough_progress`

## Schema Design: Better Auth Compatible Tables

MCPlatform creates Better Auth compatible tables with MCP prefixes that match Better Auth's expected structure exactly:

```typescript
// packages/database/src/mcp-auth-schema.ts

// Better Auth compatible user table (for authentication)
export const mcpOAuthUser = pgTable('mcp_oauth_user', {
  id: text('id').primaryKey().$defaultFn(() => `mcpau_${nanoid(12)}`),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Better Auth compatible session table (for authentication)
export const mcpOAuthSession = pgTable('mcp_oauth_session', {
  id: text('id').primaryKey().$defaultFn(() => `mcpas_${nanoid(12)}`),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  userId: text('user_id').notNull().references(() => mcpOAuthUser.id, { onDelete: 'cascade' }),

  // MCP-specific context fields
  activeOrganizationId: text('active_organization_id'), // Organization context
  mcpServerId: text('mcp_server_id'), // MCP server context

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Better Auth compatible account table (for social OAuth)
export const mcpOAuthAccount = pgTable('mcp_oauth_account', {
  id: text('id').primaryKey().$defaultFn(() => `mcpaa_${nanoid(12)}`),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => mcpOAuthUser.id, { onDelete: 'cascade' }),
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

// Better Auth verification table
export const mcpOAuthVerification = pgTable('mcp_oauth_verification', {
  id: text('id').primaryKey().$defaultFn(() => `mcpav_${nanoid(12)}`),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

## Better Auth Configuration

```typescript
// packages/dashboard/src/lib/auth/mcp/auth.ts

export function createMCPAuth(serverId: string, organizationId: string) {
  return betterAuth({
    basePath: '/mcp-oidc/auth', // Separate auth path

    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        // Map Better Auth expected names to MCP prefixed tables
        user: mcpOAuthUser,              // Better Auth expects 'user'
        session: mcpOAuthSession,        // Better Auth expects 'session'
        account: mcpOAuthAccount,        // Better Auth expects 'account'
        verification: mcpOAuthVerification, // Better Auth expects 'verification'
      }
    }),

    // Authentication providers
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        enabled: !!process.env.GOOGLE_CLIENT_ID,
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        enabled: !!process.env.GITHUB_CLIENT_ID,
      }
    },

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
    },

    // MCP-specific hooks to inject context
    hooks: {
      after: [
        {
          matcher: (context) => context.path === '/sign-in/email' || context.path.startsWith('/sign-in/'),
          handler: async (request, response, ctx) => {
            // Inject MCP context into session after successful authentication
            if (ctx.session) {
              await db.update(mcpOAuthSession)
                .set({
                  activeOrganizationId: organizationId,
                  mcpServerId: serverId,
                })
                .where(eq(mcpOAuthSession.id, ctx.session.id))
            }
          }
        }
      ]
    },

    advanced: {
      generateId: () => crypto.randomUUID(),
      crossSubDomainCookies: { enabled: true } // For subdomain access
    }
  })
}
```

## Field Mapping Strategy

Better Auth fields map **exactly** to MCP OAuth schema fields - no custom mapping needed:

| Better Auth Expected | MCPlatform MCP Schema      | Notes          |
|----------------------|----------------------------|----------------|
| `user.id`            | `mcpOAuthUser.id`          | Direct mapping |
| `user.email`         | `mcpOAuthUser.email`       | Direct mapping |
| `user.name`          | `mcpOAuthUser.name`        | Direct mapping |
| `user.emailVerified` | `mcpOAuthUser.emailVerified` | Direct mapping |
| `session.userId`     | `mcpOAuthSession.userId`   | Direct mapping |
| `session.token`      | `mcpOAuthSession.token`    | Direct mapping |
| `account.providerId` | `mcpOAuthAccount.providerId` | Direct mapping |

## MCP Context Injection

### Organization Context in Sessions

```typescript
// MCP session includes organization and server context
export const mcpOAuthSession = pgTable('mcp_oauth_session', {
  // ... standard Better Auth fields
  activeOrganizationId: text('active_organization_id'), // Organization context
  mcpServerId: text('mcp_server_id'),                  // MCP server context
})
```

### Subdomain Context via Host Header

```typescript
// Every MCP endpoint extracts subdomain for context
async function getMcpServerContext(host: string) {
  const subdomain = host.split('.')[0]
  const [mcpServer] = await db.select().from(mcpServer)
    .where(eq(mcpServer.slug, subdomain))

  return mcpServer
}
```

## User Capture Integration: The Bridge Pattern

MCPlatform bridges the two systems via **email matching**:

### Step 1: Better Auth Handles Authentication

```typescript
// Login via Better Auth MCP instance
const response = await fetch('/mcp-oidc/auth/sign-in/email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})
```

### Step 2: OAuth Callback Creates/Updates Custom MCP User

```typescript
// In OAuth callback - after Better Auth succeeds, create custom business user
async function performUserCapture(betterAuthUser, mcpServer) {
  // Check if custom MCP user exists (organization-scoped)
  const existingUser = await db.select()
    .from(mcpServerUser)
    .where(and(
      eq(mcpServerUser.email, betterAuthUser.email),
      // Organization boundary enforcement
      exists(db.select().from(mcpServerSession)
        .innerJoin(mcpServer, eq(mcpServer.slug, mcpServerSession.mcpServerSlug))
        .where(and(
          eq(mcpServerSession.mcpServerUserId, mcpServerUser.id),
          eq(mcpServer.organizationId, mcpServer.organizationId)
        ))
      )
    ))

  if (!existingUser) {
    // Create custom MCP user for business logic
    const [newUser] = await db.insert(mcpServerUser).values({
      email: betterAuthUser.email,           // Bridge field
      upstreamSub: betterAuthUser.id,        // Link to Better Auth user
      profileData: {
        name: betterAuthUser.name,
        image: betterAuthUser.image,
        emailVerified: betterAuthUser.emailVerified
      }
    })

    // Create MCP server session linking user to organization
    await db.insert(mcpServerSession).values({
      mcpServerSlug: mcpServer.slug,
      mcpServerUserId: newUser.id,
      sessionData: {
        betterAuthUserId: betterAuthUser.id, // Bridge to auth system
        organizationId: mcpServer.organizationId
      }
    })
  }
}
```

### Step 3: Dashboard Queries Join Both Systems

```typescript
// Dashboard joins both user systems by email
const users = await db
  .select({
    // Custom MCP user fields (business logic)
    id: mcpServerUser.id,
    email: mcpServerUser.email,
    profileData: mcpServerUser.profileData,
    firstSeenAt: mcpServerUser.firstSeenAt,

    // Better Auth MCP user fields (authentication)
    emailVerified: mcpOAuthUser.emailVerified,
    name: mcpOAuthUser.name,
    authId: mcpOAuthUser.id,
  })
  .from(mcpServerUser)
  .leftJoin(mcpOAuthUser, eq(mcpServerUser.email, mcpOAuthUser.email))
  .where(
    // Organization scoping via MCP server sessions
    exists(db.select().from(mcpServerSession)
      .innerJoin(mcpServer, eq(mcpServer.slug, mcpServerSession.mcpServerSlug))
      .where(and(
        eq(mcpServerSession.mcpServerUserId, mcpServerUser.id),
        eq(mcpServer.organizationId, currentOrganizationId)
      ))
    )
  )
```

## Complete Implementation Pattern

### Directory Structure

```
packages/database/src/
├── auth-schema.ts          # Platform users (dashboard)
├── mcp-auth-schema.ts      # Better Auth MCP users + Custom MCP users
└── schema.ts               # Core business entities (mcpServer, etc.)

packages/dashboard/src/lib/auth/
├── auth.ts                 # Platform authentication (dashboard users)
└── mcp/
    ├── auth.ts             # Better Auth MCP instance
    └── auth.client.ts      # MCP auth client utilities
```

### Authentication Routes

```
/auth/*                    # Platform authentication (dashboard)
/mcp-oidc/auth/*          # Better Auth MCP instance
/mcp-oidc/login           # Custom MCP login page
/oauth/*                  # OAuth proxy endpoints (authorize, token)
/api/oauth-callback       # Centralized OAuth callback with user capture
```

## Critical Discovery: No Server ID Constraints

**MCPlatform's Key Insight**: They do NOT have `mcp_server_id` NOT NULL constraints in their user tables! This avoids the Better Auth creation problem entirely.

### Schema Design Pattern

```sql
-- ❌ DON'T DO THIS (causes Better Auth failures):
CREATE TABLE "mcp_end_user" (
    "mcp_server_id" text NOT NULL  -- This breaks Better Auth user creation
);

-- ✅ DO THIS (MCPlatform pattern):
CREATE TABLE "mcp_end_user" (
    "id" text PRIMARY KEY,
    "email" text,                   -- Bridge field (nullable)
    "tracking_id" text,             -- Nullable for flexibility
    "first_seen_at" bigint
);

-- Store server context in SESSION table, not USER table
CREATE TABLE "mcp_end_user_session" (
    "session_id" text PRIMARY KEY,
    "mcp_server_id" text NOT NULL,  -- Server context HERE
    "mcp_end_user_id" text REFERENCES "mcp_end_user"("id"),
    "server_slug" text REFERENCES "mcp_servers"("slug")
);
```

### Authentication State Management Pattern

```typescript
// 1. Better Auth handles session cookies automatically
const session = await auth.api.getMcpSession({ headers })

// 2. Subdomain provides MCP server context per request
const subdomain = request.headers.get('host').split('.')[0]
const [mcpServer] = await db.select().from(mcpServers)
    .where(eq(mcpServers.slug, subdomain))

// 3. Bridge authenticated user to custom MCP user via email
if (session?.userId) {
    const [oauthUser] = await db.select().from(mcpOAuthUser)
        .where(eq(mcpOAuthUser.id, session.userId))

    // Find/create custom MCP user by email (no server constraints)
    const [mcpUser] = await db.select().from(mcpServerUser)
        .where(eq(mcpServerUser.email, oauthUser.email))
}
```

## Implementation Checklist

### Database Schema
- [ ] **REMOVE** `mcp_server_id` NOT NULL constraints from user tables
- [ ] Create `mcpOAuthUser` table matching Better Auth `user` expectations
- [ ] Create `mcpOAuthSession` table with MCP context fields
- [ ] Create `mcpOAuthAccount` table for social OAuth
- [ ] Create `mcpOAuthVerification` table for email verification
- [ ] Keep existing `mcpServerUser` with nullable fields for business logic
- [ ] Store server context in session tables, not user tables

### Better Auth Configuration
- [ ] Configure drizzle adapter with schema mapping
- [ ] Set up email/password authentication
- [ ] Configure social OAuth providers (Google, GitHub)
- [ ] Add hooks to inject MCP context into sessions
- [ ] Enable cross-subdomain cookies

### User Capture Integration
- [ ] Update OAuth callback to create custom MCP users after Better Auth success
- [ ] Implement organization-scoped user deduplication
- [ ] Create bridge between Better Auth users and custom MCP users via email
- [ ] Update dashboard queries to join both user systems

### Authentication Flow
- [ ] Update login forms to use Better Auth endpoints
- [ ] Implement session management with MCP context
- [ ] Add subdomain-aware authentication routing
- [ ] Handle OAuth provider callbacks with user capture

## Why This Pattern Works

1. **No Schema Conflicts**: Better Auth gets its expected schema structure
2. **Business Logic Separation**: Custom tables handle complex business requirements
3. **Organization Boundaries**: Custom schema enforces organization scoping
4. **Email Bridge**: Simple join by email connects the systems
5. **Subdomain Context**: Host header provides MCP server context
6. **OAuth Flexibility**: Can handle multiple OAuth providers per organization
7. **Analytics Foundation**: Custom tables enable comprehensive user tracking

## Key Takeaway

**Don't try to map Better Auth to your custom schema!** Instead:

1. ✅ Create Better Auth compatible tables with your prefixes
2. ✅ Use separate custom tables for business logic
3. ✅ Bridge via email or other common fields
4. ✅ Extract context from subdomain in each request
5. ✅ Map Better Auth schema names to your prefixed tables in adapter config

This dual schema pattern allows Better Auth to work perfectly while maintaining your custom business logic, user capture system, and organization boundaries.