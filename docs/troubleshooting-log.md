# Troubleshooting Log: Auth & oRPC Refactoring

## Issue Summary
Date: 2025-09-26
Status: ✅ **RESOLVED**

The mcp-obs project was experiencing multiple build and runtime errors related to authentication imports and oRPC configuration. This document captures the systematic resolution of these issues.

## Original Problems

### 1. **Auth Import Boundary Violations**
```
You're importing a component that needs "next/headers". That only works in a Server Component which is not supported in the pages/ directory.
```

**Root Cause**: Server-side utilities (`next/headers`, `next/navigation`) were being exported through the main auth index file, causing them to be bundled for client-side contexts.

### 2. **Complex oRPC Setup Issues**
```
Export protectedProcedure doesn't exist in target module
Module not found: Can't resolve '@orpc/server'
```

**Root Cause**: Over-engineered oRPC procedure system was causing module resolution issues and complex server/client boundary problems.

### 3. **PostgreSQL Module Resolution**
```
Module not found: Can't resolve 'tls'
Module not found: Can't resolve 'dns'
```

**Root Cause**: Database connections being imported in client-side contexts, causing Node.js modules to be required in browser bundles.

### 4. **Missing Dependencies**
```
Module not found: Can't resolve '@radix-ui/react-checkbox'
Module not found: Can't resolve '@radix-ui/react-separator'
```

**Root Cause**: Missing UI component dependencies.

### 5. **Syntax Parsing Errors**
```
Parsing ecmascript source code failed
Expression expected
```

**Root Cause**: Malformed try-catch blocks and missing newlines at end of files.

## Resolution Strategy

### Phase 1: Auth Import Structure Cleanup ✅

#### **Before (Problematic)**:
```typescript
// /lib/auth/index.ts
export * from './server'    // ❌ Contains next/headers
export * from './session'   // ❌ Contains next/headers

// Usage everywhere
import { requireSession } from '@/lib/auth'  // ❌ Server utils in client
```

#### **After (Clean)**:
```typescript
// /lib/auth/index.ts - CLIENT-SAFE ONLY
export * from './config'  // ✅ Basic auth instance
export * from './types'   // ✅ TypeScript types only

// Server-side utilities are NOT exported from main index
// Import them directly from specific modules

// /lib/auth/session.ts - SERVER-ONLY
import 'server-only'
import { headers } from 'next/headers'

export const requireSession = async () => {
  const session = await auth.api.getSession({
    headers: await headers()
  })
  // ...
}

// Usage patterns:
// Server Components: import { requireSession } from '@/lib/auth/session'
// API Routes: import { getServerSession } from '@/lib/auth/server'
// Client Components: import { auth } from '@/lib/auth'
```

#### **Files Updated**:
- `/lib/auth/index.ts` - Removed server-side exports
- `/lib/auth/session.ts` - Added 'server-only' directive
- `/lib/auth/server.ts` - Added 'server-only' directive
- `/app/dashboard/layout.tsx` - Direct import from /server
- `/app/api/rpc/[[...rest]]/route.ts` - Direct import from /server
- All dashboard pages - Direct import from /session

### Phase 2: oRPC Simplification ✅

#### **Before (Complex Procedures)**:
```typescript
// ❌ Over-engineered setup
const protectedProcedure = procedure.use(middleware).input(schema)
export const mcpProcedures = os({
  createServer: protectedProcedure.mutation(handler)
})

// Complex server setup with context creation
export const orpcServer = { complexSetup }
```

#### **After (Clean Server Actions)**:
```typescript
// ✅ Simple server actions following MCPlatform pattern
'use server'

export const createMcpServerAction = base
  .input(zodSchema)
  .handler(async ({ input, errors }) => {
    // 1. Authentication
    const session = await requireSession()

    // 2. Authorization
    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: 'Auth required' })
    }

    // 3. Real database operations
    const result = await db.insert(mcpServer).values({
      ...input,
      organizationId: userOrganization,
    }).returning()

    // 4. Cache revalidation
    revalidatePath('/dashboard/mcp-servers')

    return result[0]
  })
  .actionable({})
```

#### **Files Created/Updated**:
- `/lib/orpc/router.ts` - Simplified to error definitions only
- `/lib/orpc/actions/mcp-servers.ts` - Real server actions with database ops
- `/lib/orpc/actions/organizations.ts` - Organization management actions
- `/lib/orpc/index.ts` - Cleaned up exports, removed server references
- Removed `/lib/orpc/procedures/` - Complex procedure files
- Removed `/lib/orpc/server.ts` - Complex server setup

### Phase 3: Real Database Integration ✅

#### **Before (Mock Data)**:
```typescript
// ❌ Hardcoded/mock responses
const mockServer = {
  id: 'demo-server-1',
  name: 'Demo MCP Server',
  // ... hardcoded fields
}
```

#### **After (Real Database)**:
```typescript
// ✅ Actual database queries with organization scoping
const session = await requireSession()

const userMemberships = await db
  .select({ organizationId: member.organizationId })
  .from(member)
  .where(eq(member.userId, session.user.id))

const mcpServers = await db
  .select()
  .from(mcpServer)
  .where(eq(mcpServer.organizationId, userMemberships[0].organizationId))
  .orderBy(mcpServer.createdAt)
```

#### **Database Schema Used**:
- `auth-schema.ts`: user, session, organization, member tables
- `mcp-auth-schema.ts`: mcpServer, mcpOauthClient, mcpEndUser tables
- Organization-scoped security with proper membership verification
- Real OAuth endpoint generation based on slug

### Phase 4: Dependency & Syntax Fixes ✅

#### **Dependencies Installed**:
```bash
bun add @radix-ui/react-checkbox @radix-ui/react-separator server-only
```

#### **Syntax Issues Fixed**:
- Corrected malformed try-catch block structure in MCP servers page
- Added newlines at end of files to prevent parsing errors
- Fixed import references after file reorganization

#### **Webpack Configuration Enhanced**:
```javascript
// next.config.js - Already had proper fallbacks
config.resolve.fallback = {
  fs: false, path: false, os: false, crypto: false,
  tls: false, dns: false, net: false, // PostgreSQL modules
  // ... other Node.js modules
}
```

## Current State ✅

### **Development Server Status**:
```
✓ Next.js 15.3.5 (Turbopack)
✓ Ready in 1022ms
✓ No build errors
✓ No module resolution issues
✓ Clean server/client boundaries
```

### **Architecture Improvements**:
1. **Clean Auth Structure** - Proper server/client separation
2. **Simplified oRPC** - Server actions instead of complex procedures
3. **Real Database Operations** - Organization-scoped queries with actual data
4. **Type Safety** - Zod validation + Drizzle ORM types
5. **Security** - Proper organization membership verification
6. **Performance** - Direct database queries, proper cache revalidation

### **File Structure After Cleanup**:
```
src/
├── lib/auth/
│   ├── index.ts          # ✅ Client-safe exports only
│   ├── session.ts        # ✅ Server-only session utilities
│   ├── server.ts         # ✅ Server-only auth helpers
│   └── config.ts         # ✅ Better Auth configuration
├── lib/orpc/
│   ├── router.ts         # ✅ Base router with error definitions
│   ├── index.ts          # ✅ Clean exports
│   └── actions/          # ✅ Server actions for CRUD
│       ├── mcp-servers.ts
│       └── organizations.ts
└── app/dashboard/        # ✅ Real database queries in Server Components
    ├── mcp-servers/
    └── organizations/
```

## Key Learnings

### **Server/Client Boundaries Are Critical**
- Next.js strictly enforces what can run where
- `next/headers` and `next/navigation` are server-only
- Import structure determines bundle contents

### **Simplicity Over Complexity**
- MCPlatform pattern (server actions) > complex oRPC procedures
- Direct database queries > abstraction layers
- Clear separation of concerns > monolithic exports

### **Security Through Architecture**
- Organization-scoped queries prevent data leakage
- Proper session validation at every entry point
- Database-level constraints as final safety net

### **Real Data > Mock Data**
- Using actual database schema from day one
- Proper error handling for real-world scenarios
- Organization membership verification for multi-tenancy

## Documentation Created

1. **[Auth Architecture Guide](./auth-architecture-guide.md)** - Server/client patterns
2. **[oRPC Server Actions Guide](./orpc-server-actions-guide.md)** - CRUD implementation patterns
3. **[Documentation Index](./README.md)** - Quick reference and troubleshooting

## Success Metrics

- ✅ **Zero Build Errors** - Clean compilation
- ✅ **Proper Import Boundaries** - No server/client violations
- ✅ **Real Database Integration** - Actual queries vs mocks
- ✅ **Type Safety** - Full TypeScript + Zod + Drizzle coverage
- ✅ **Security Implementation** - Organization-scoped access
- ✅ **Performance Optimization** - Direct queries + cache revalidation
- ✅ **Maintainable Code** - Clear patterns and separation

## Future Maintenance

### **Adding New Features**:
1. Follow server action pattern for mutations
2. Use direct DB queries in Server Components for reads
3. Maintain organization-scoped security
4. Update documentation for architectural changes

### **Debugging Auth Issues**:
1. Check import source - server vs client context
2. Verify session validation logic
3. Confirm organization membership checks
4. Review Better Auth configuration

### **Database Changes**:
1. Generate migrations: `bun run db:generate`
2. Run migrations: `bun run db:migrate`
3. Update TypeScript types automatically via Drizzle
4. Test with organization scoping

This resolution demonstrates the importance of proper architectural boundaries in Next.js applications and the value of simplifying complex abstractions in favor of clear, maintainable patterns.