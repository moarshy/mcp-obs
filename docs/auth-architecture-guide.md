# Authentication Architecture Guide

## Overview

This document outlines the authentication architecture for mcp-obs, including lessons learned from resolving Next.js server/client boundary issues and implementing a clean, maintainable auth system.

## Problem Statement

Initial implementation suffered from:
- **Server/Client Import Issues**: `next/headers` being imported in client contexts
- **Complex oRPC Setup**: Over-engineered procedure system causing build failures
- **Auth Boundary Violations**: Server-side utilities exposed through client-safe exports

## Solution Architecture

### 1. Clean Auth Import Structure

#### **Problem**:
```typescript
// ❌ BAD: server-side utilities exported through main index
// /lib/auth/index.ts
export * from './server'    // Contains next/headers
export * from './session'   // Contains next/headers
```

#### **Solution**:
```typescript
// ✅ GOOD: Separate client-safe from server-side exports
// /lib/auth/index.ts
export * from './config'  // Client-safe auth instance
export * from './types'   // TypeScript types only

// NOTE: Server-side utilities are NOT exported from this index
// Import them directly:
// - import { requireSession } from '@/lib/auth/session'
// - import { getServerSession } from '@/lib/auth/server'
```

### 2. Server-Side Auth Utilities

#### Session Management (`/lib/auth/session.ts`)
```typescript
import 'server-only'  // Ensures server-only execution
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const requireSession = async (options = { organizationRequired: true }) => {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session || !session.user) {
    redirect('/auth/signin')
  }

  // Organization-scoped validation
  if (options.organizationRequired && !session.session.activeOrganizationId) {
    // Handle organization membership logic
  }

  return session
}
```

#### Server Utilities (`/lib/auth/server.ts`)
```typescript
import 'server-only'
import { headers } from 'next/headers'

export const getServerSession = async () => {
  const headersList = await headers()

  try {
    const session = await auth.api.getSession({ headers: headersList })
    return {
      user: session?.user || null,
      session: session?.session || null,
    }
  } catch (error) {
    return { user: null, session: null }
  }
}
```

### 3. Usage Patterns

#### **In Server Components**:
```typescript
// ✅ Direct import for server-side utilities
import { requireSession } from '@/lib/auth/session'
import { getServerSession, getUserOrganizations } from '@/lib/auth/server'

export default async function DashboardPage() {
  const session = await requireSession()
  const organizations = await getUserOrganizations(session.user.id)

  return <Component data={organizations} />
}
```

#### **In API Routes**:
```typescript
// ✅ Server-side imports work in API routes
import { getServerSession } from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  const { user, session } = await getServerSession()

  if (!user || !session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Handle authenticated request
}
```

#### **In Client Components**:
```typescript
// ✅ Only client-safe imports
import { auth } from '@/lib/auth'  // Basic auth instance only

export function LoginButton() {
  const handleLogin = () => {
    // Client-side auth operations
  }

  return <button onClick={handleLogin}>Login</button>
}
```

## Key Learnings

### 1. Server/Client Boundaries Are Strict
- **Next.js enforces strict boundaries** between server and client code
- `next/headers` and `next/navigation` can ONLY be used in Server Components and API routes
- Webpack will fail if these are bundled for client-side

### 2. Import Structure Matters
- **Main auth index should only export client-safe utilities**
- Server-side utilities must be imported directly from specific modules
- Use `'server-only'` directive to enforce server-side execution

### 3. Better Auth Integration
- **Better Auth provides clean API** for session management
- Use `auth.api.getSession({ headers })` pattern consistently
- Organization context handled through session state

### 4. Organization-Scoped Security
- **All database operations must respect organization boundaries**
- Verify user membership before accessing organization data
- Use `activeOrganizationId` from session for multi-tenant isolation

## Database Schema Integration

### User Authentication Schema (`auth-schema.ts`)
```typescript
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  // ... other fields
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id),
  activeOrganizationId: text('active_organization_id'), // Key for multi-tenancy
  // ... other fields
})

export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
})

export const member = pgTable('member', {
  organizationId: text('organization_id').references(() => organization.id),
  userId: text('user_id').references(() => user.id),
  role: text('role').default('member'),
})
```

## Security Patterns

### 1. Organization Membership Verification
```typescript
// Always verify user has access to organization
const userMemberships = await db
  .select({ organizationId: member.organizationId })
  .from(member)
  .where(eq(member.userId, session.user.id))

if (!userMemberships.some(m => m.organizationId === requestedOrgId)) {
  throw new Error('Access denied')
}
```

### 2. Session-Based Access Control
```typescript
// Use session context for all operations
const session = await requireSession()

// Scope all queries to user's accessible organizations
const data = await db
  .select()
  .from(someTable)
  .where(eq(someTable.organizationId, session.session.activeOrganizationId))
```

## Common Pitfalls to Avoid

### ❌ Don't: Mix Server/Client Imports
```typescript
// BAD: This will cause build failures
export * from './server-utilities'  // Contains next/headers
export * from './client-utilities'
```

### ❌ Don't: Import Server Utils in Client Context
```typescript
// BAD: Will fail at build time
import { requireSession } from '@/lib/auth'  // If exported from main index
```

### ❌ Don't: Skip Organization Verification
```typescript
// BAD: Security vulnerability
const data = await db.select().from(mcpServer)  // Missing organization filter
```

### ✅ Do: Separate Concerns Clearly
```typescript
// GOOD: Clear separation
import { auth } from '@/lib/auth'                    // Client-safe
import { requireSession } from '@/lib/auth/session' // Server-only
import { getServerSession } from '@/lib/auth/server' // Server-only
```

## Migration Guide

When refactoring auth imports:

1. **Audit all imports** of `@/lib/auth`
2. **Identify server vs client context** for each import
3. **Update imports** to use specific modules:
   - Server Components: Import from `/session` or `/server`
   - Client Components: Import from main index (client-safe only)
   - API Routes: Import from `/server`
4. **Add `'server-only'` directive** to server-side modules
5. **Test thoroughly** to ensure no server/client boundary violations

## Tools and Validation

- **TypeScript**: Catches type mismatches in auth flows
- **Next.js Build**: Will fail fast on server/client boundary violations
- **ESLint**: Can be configured to catch improper imports
- **`server-only` package**: Runtime enforcement of server-side execution

This architecture ensures clean separation of concerns, proper security boundaries, and maintainable authentication flows throughout the application.