# oRPC Server Actions Implementation Guide

## Overview

This document outlines the transition from complex oRPC procedures to clean server actions pattern, based on learnings from the MCPlatform project. This approach provides better maintainability, type safety, and follows Next.js best practices.

## Problem with Original Approach

### Issues with Complex oRPC Setup:
- **Build Failures**: Complex procedure system caused module resolution issues
- **Client/Server Boundary Issues**: Procedures trying to use `next/headers` in client contexts
- **Over-Engineering**: Complicated setup for simple CRUD operations
- **Poor Error Handling**: Generic error responses without proper typing
- **Maintenance Overhead**: Complex router/procedure hierarchy

## Solution: MCPlatform Server Actions Pattern

### Core Principles

1. **Server Actions for Mutations** (`*.actionable({})`)
2. **Direct Database Queries for Reads** in Server Components
3. **Typed Error System** with proper error boundaries
4. **Cache Revalidation** for optimal performance
5. **Organization-Scoped Security** for multi-tenancy

## Architecture Overview

```
/lib/orpc/
├── router.ts              # Base router with error definitions
├── actions/
│   ├── mcp-servers.ts     # MCP server CRUD actions
│   ├── organizations.ts   # Organization management actions
│   └── auth.ts            # Authentication actions (future)
└── (removed)
    ├── server.ts          # ❌ Complex server setup (removed)
    └── procedures/        # ❌ Complex procedures (removed)
```

## Implementation Details

### 1. Base Router with Error System

```typescript
// /lib/orpc/router.ts
import { os } from '@orpc/server'

export const base = os.errors({
  UNAUTHORIZED: {},
  RESOURCE_NOT_FOUND: {},
  INVALID_SUBDOMAIN: {},
  SUBDOMAIN_ALREADY_EXISTS: {},
  ORGANIZATION_NOT_FOUND: {},
  INSUFFICIENT_PERMISSIONS: {},
})
```

### 2. Server Actions Pattern

#### **Template Structure:**
```typescript
'use server'  // MUST be first line

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '../../auth/session'
import { base } from '../router'
import { db, tableSchema } from 'database'
import { eq, and } from 'drizzle-orm'

const inputSchema = z.object({
  // Define input validation
})

export const actionName = base
  .input(inputSchema)
  .handler(async ({ input, errors }) => {
    // 1. Authentication
    const session = await requireSession()

    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: 'Authentication required' })
    }

    // 2. Authorization (organization membership)
    const userMemberships = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, session.user.id))

    if (userMemberships.length === 0) {
      throw errors.UNAUTHORIZED({ message: 'No organization access' })
    }

    try {
      // 3. Business logic & database operations
      const result = await db.insert(tableSchema).values({
        ...input,
        organizationId: userMemberships[0].organizationId,
      }).returning()

      // 4. Cache revalidation (CRITICAL)
      revalidatePath('/relevant-path')

      return result[0]
    } catch (error) {
      // 5. Error handling
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw errors.SUBDOMAIN_ALREADY_EXISTS({ message: 'Resource already exists' })
      }
      throw errors.RESOURCE_NOT_FOUND({ message: 'Failed to create resource' })
    }
  })
  .actionable({})  // Converts to server action
```

### 3. Real Implementation Examples

#### **MCP Server Creation Action:**
```typescript
// /lib/orpc/actions/mcp-servers.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '../../auth/session'
import { base } from '../router'
import { db, mcpServer, member } from 'database'
import { eq } from 'drizzle-orm'

const createMcpServerSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  allowRegistration: z.boolean().default(true),
  requireEmailVerification: z.boolean().default(false),
  enablePasswordAuth: z.boolean().default(true),
  enableGoogleAuth: z.boolean().default(false),
  enableGithubAuth: z.boolean().default(false),
})

export const createMcpServerAction = base
  .input(createMcpServerSchema)
  .handler(async ({ input, errors }) => {
    const session = await requireSession()

    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: 'Authentication required' })
    }

    try {
      // Get user's organization
      const userMemberships = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, session.user.id))

      if (userMemberships.length === 0) {
        throw errors.UNAUTHORIZED({ message: 'No organization membership found' })
      }

      const organizationId = userMemberships[0].organizationId
      const issuerUrl = `https://${input.slug}.mcp-obs.com`

      // Real database insert with all OAuth endpoints
      const result = await db.insert(mcpServer).values({
        name: input.name,
        slug: input.slug,
        description: input.description,
        organizationId,
        issuerUrl,
        authorizationEndpoint: `${issuerUrl}/oauth/authorize`,
        tokenEndpoint: `${issuerUrl}/oauth/token`,
        registrationEndpoint: `${issuerUrl}/oauth/register`,
        introspectionEndpoint: `${issuerUrl}/oauth/introspect`,
        revocationEndpoint: `${issuerUrl}/oauth/revoke`,
        allowRegistration: input.allowRegistration,
        requireEmailVerification: input.requireEmailVerification,
        enablePasswordAuth: input.enablePasswordAuth,
        enableGoogleAuth: input.enableGoogleAuth,
        enableGithubAuth: input.enableGithubAuth,
      }).returning()

      revalidatePath('/dashboard/mcp-servers')
      return result[0]
    } catch (error) {
      console.error('Error creating MCP server:', error)

      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw errors.SUBDOMAIN_ALREADY_EXISTS({ message: 'MCP server slug already exists' })
      }

      throw errors.RESOURCE_NOT_FOUND({ message: 'Failed to create MCP server' })
    }
  })
  .actionable({})
```

### 4. Server Component Data Fetching

#### **Direct Database Queries in Server Components:**
```typescript
// /app/dashboard/mcp-servers/page.tsx
import { requireSession } from '@/lib/auth/session'

async function McpServersList() {
  const session = await requireSession()

  try {
    // Direct database query (no oRPC complexity)
    const { db, mcpServer, member } = await import('database')
    const { eq } = await import('drizzle-orm')

    const userMemberships = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, session.user.id))

    if (userMemberships.length === 0) {
      return <NoOrganizationAccess />
    }

    // Get MCP servers for user's organization
    const mcpServers = await db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.organizationId, userMemberships[0].organizationId))
      .orderBy(mcpServer.createdAt)

    return <McpServerTable data={mcpServers} />
  } catch (error) {
    console.error('Error loading MCP servers:', error)
    return <ErrorDisplay message="Failed to load MCP servers" />
  }
}

export default function McpServersPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<LoadingSkeleton />}>
        <McpServersList />
      </Suspense>
    </div>
  )
}
```

### 5. Client-Side Usage

#### **Using Server Actions in Client Components:**
```typescript
'use client'

import { useServerAction } from '@orpc/react/hooks'
import { createMcpServerAction } from '@/lib/orpc/actions/mcp-servers'
import { toast } from 'sonner'

export function CreateServerForm() {
  const { execute, status } = useServerAction(createMcpServerAction, {
    interceptors: [
      onSuccess(() => {
        toast.success('MCP Server created successfully')
      }),
      onError((error) => {
        if (isDefinedError(error)) {
          toast.error(error.message)
        } else {
          toast.error('Failed to create server')
        }
      })
    ]
  })

  const handleSubmit = async (data: CreateServerData) => {
    await execute(data)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <Button disabled={status === 'pending'}>
        {status === 'pending' ? 'Creating...' : 'Create Server'}
      </Button>
    </form>
  )
}
```

## Key Benefits of This Approach

### 1. **Simplicity**
- No complex procedure hierarchy
- Direct database operations
- Clear separation of concerns

### 2. **Type Safety**
- Zod input validation
- Drizzle ORM type safety
- Typed error system

### 3. **Performance**
- Direct database queries (no oRPC overhead)
- Proper cache revalidation
- Optimized server/client boundaries

### 4. **Security**
- Organization-scoped operations
- Proper authentication checks
- Database-level constraints

### 5. **Maintainability**
- Single file per feature
- Clear error handling
- Easy to test and debug

## Migration from Complex oRPC

### Before (Complex Procedures):
```typescript
// ❌ Complex setup with procedures
const protectedProcedure = procedure
  .use(async (ctx, meta, next) => {
    // Complex middleware setup
    const context = await createContext()
    if (!context.session) throw new ORPCError(...)
    return next({ ctx: context })
  })

export const mcpProcedures = os({
  createServer: protectedProcedure
    .input(schema)
    .mutation(async ({ input, ctx }) => {
      // Procedure logic
    })
})
```

### After (Clean Server Actions):
```typescript
// ✅ Clean server action
'use server'

export const createMcpServerAction = base
  .input(schema)
  .handler(async ({ input, errors }) => {
    const session = await requireSession()
    // Direct logic
  })
  .actionable({})
```

## Error Handling Patterns

### Typed Errors
```typescript
// Define errors in router
export const base = os.errors({
  SUBDOMAIN_ALREADY_EXISTS: {},
  INSUFFICIENT_PERMISSIONS: {},
})

// Use in actions
throw errors.SUBDOMAIN_ALREADY_EXISTS({
  message: 'Server slug already exists'
})

// Handle in client
onError((error) => {
  if (isDefinedError(error)) {
    toast.error(error.message)
  }
})
```

### Database Error Mapping
```typescript
try {
  await db.insert(table).values(data)
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('unique constraint')) {
      throw errors.SUBDOMAIN_ALREADY_EXISTS({ message: 'Already exists' })
    }
    if (error.message.includes('foreign key')) {
      throw errors.RESOURCE_NOT_FOUND({ message: 'Related resource not found' })
    }
  }
  throw errors.RESOURCE_NOT_FOUND({ message: 'Operation failed' })
}
```

## Cache Management

### Revalidation Patterns
```typescript
// Specific path revalidation
revalidatePath('/dashboard/mcp-servers')
revalidatePath(`/dashboard/mcp-servers/${serverId}`)

// Layout revalidation (affects all nested pages)
revalidatePath('/dashboard', 'layout')

// Tag-based revalidation (future enhancement)
revalidateTag('mcp-servers')
```

## Security Considerations

### Organization Scoping
```typescript
// ALWAYS verify organization membership
const userMemberships = await db
  .select({ organizationId: member.organizationId })
  .from(member)
  .where(eq(member.userId, session.user.id))

// ALWAYS scope queries to user's organizations
const data = await db
  .select()
  .from(someTable)
  .where(eq(someTable.organizationId, allowedOrganizationId))
```

### Input Validation
```typescript
// Use Zod for all input validation
const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Invalid slug format'),
  name: z.string().min(1).max(100),
})
```

## Testing Strategies

### Unit Testing Actions
```typescript
describe('createMcpServerAction', () => {
  it('creates server with valid input', async () => {
    const mockSession = { user: { id: 'user1' } }
    const input = { name: 'Test Server', slug: 'test-server' }

    const result = await createMcpServerAction(input)
    expect(result).toMatchObject({ name: 'Test Server' })
  })

  it('throws error for duplicate slug', async () => {
    const input = { name: 'Test', slug: 'existing-slug' }

    await expect(createMcpServerAction(input))
      .rejects.toThrow('MCP server slug already exists')
  })
})
```

## Best Practices

1. **Always use `'use server'`** as first line in action files
2. **Validate inputs** with Zod schemas
3. **Check authentication** before any operations
4. **Verify organization membership** for multi-tenant security
5. **Handle errors gracefully** with typed error system
6. **Revalidate cache** after mutations
7. **Use direct DB queries** in server components for reads
8. **Keep actions focused** - one action per operation
9. **Log errors** for debugging but don't expose sensitive info
10. **Test thoroughly** with proper mocking

This pattern provides a clean, maintainable, and scalable approach to handling server-side operations in Next.js applications while maintaining type safety and security.