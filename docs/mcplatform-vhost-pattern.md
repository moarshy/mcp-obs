# MCPlatform VHost Resolution Pattern

## Overview

This document explains the **MCPlatform pattern** we implemented to solve the vhost/subdomain resolution problem while avoiding Node.js module bundling issues in Next.js.

## The Problem

Initially, we had database imports scattered across multiple OAuth endpoints (`/.well-known/*`, login pages, etc.), which caused Next.js to try bundling PostgreSQL modules for the client side, resulting in errors like:

```
Module not found: Can't resolve 'dns'
Module not found: Can't resolve 'fs'
Module not found: Can't resolve 'net'
```

## The MCPlatform Solution

### 1. Centralized API Route

**File**: `/app/api/mcpserver/[...slug]/route.ts`

This is the **single source of truth** for all MCP server operations:

```typescript
// Extract subdomain from Host header (the key insight!)
const requestHost = request.headers.get('host') ?? new URL(request.url).host
const requestHostname = requestHost.split(':')[0] // Remove port

// Get subdomain
const subdomain = requestHostname.split('.')[0] // Get first part

// Database lookup by subdomain slug
const servers = await db
  .select()
  .from(mcpServer)
  .where(eq(mcpServer.slug, subdomain))
  .limit(1)
```

**Actions supported**:
- `config` - Returns server configuration
- `oauth-discovery` - Returns OAuth discovery metadata
- `oauth-protected-resource` - Returns OAuth protected resource metadata

### 2. Proxy Endpoints

All other endpoints are **simple proxies** with zero database imports:

**`/.well-known/oauth-authorization-server/route.ts`**:
```typescript
export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || 'localhost:3000'
  const centralizedUrl = `http://${host}/api/mcpserver/oauth-discovery`

  const response = await fetch(centralizedUrl, {
    headers: { 'Host': host }
  })

  return new Response(await response.text(), {
    status: response.status,
    headers: response.headers
  })
}
```

### 3. Client-Side Fetching

Client components fetch server data after page load:

```typescript
// Use centralized MCP server API
const response = await fetch('/api/mcpserver/config')
const data = await response.json()
setServer(data.server)
```

## Key Benefits

1. **Single Database Connection Point**: All database code lives in one file
2. **No Client Bundling Issues**: Proxy endpoints have zero Node.js dependencies
3. **Proper Vhost Resolution**: Uses `request.headers.get('host')` server-side
4. **Clean Architecture**: Clear separation of concerns
5. **Easy to Maintain**: Changes to vhost logic only need to happen in one place

## Architecture Diagram

```
Browser Request: test.localhost:3000/.well-known/oauth-authorization-server
    ↓
Proxy Endpoint: /.well-known/oauth-authorization-server/route.ts (no DB imports)
    ↓
Centralized API: /api/mcpserver/oauth-discovery (all DB logic here)
    ↓
Database Lookup: Extract "test" from Host header → DB lookup by slug
    ↓
Response: OAuth discovery metadata
```

## Implementation Notes

### vhost Resolution Logic

**Development**: `test.localhost:3000` → subdomain = `test`
**Production**: `test.mcp-obs.com` → subdomain = `test`

### Database Schema

The `mcpServer` table uses a `slug` field for subdomain mapping:
```sql
slug TEXT NOT NULL UNIQUE -- Global slug for subdomain (e.g., 'test', 'acme-corp')
```

### Error Handling

- **404**: Server not found by subdomain
- **500**: Database connection or other server errors
- **Proxy Errors**: Forward original status codes and headers

## Files Modified

### Created
- `/app/api/mcpserver/[...slug]/route.ts` - Centralized API
- `/docs/mcplatform-vhost-pattern.md` - This documentation

### Updated to Proxy Pattern
- `/.well-known/oauth-authorization-server/route.ts`
- `/.well-known/oauth-protected-resource/route.ts`
- `/components/mcp-oauth/mcp-login-wrapper.tsx`

### Removed (Cleanup)
- `/api/mcp-server-lookup/` - Redundant after centralization
- `getMcpServerForLoginAction` - Unnecessary oRPC action
- Direct database imports from OAuth endpoints

## Implementation Status

### ✅ Resolved: Node.js Module Bundling Issue
- **Problem**: `Module not found: Can't resolve 'dns'` errors from pg module
- **Solution**: Dynamic imports in centralized API route prevent Turbopack from bundling database dependencies
- **Key Change**: `const { db, mcpServer } = await import('database')` in API routes only

### 🚧 Current Issue: SST Resource Access
- **Problem**: `Resource.Postgres` not available during local development
- **Error**: "It does not look like SST links are active"
- **Status**: Investigating MCPlatform's approach to SST Resource handling

## Testing

Current testing status:

```bash
# ✅ Bundling errors resolved - no more DNS/fs/net module errors
# 🚧 SST Resource configuration needed

# Test OAuth discovery
curl -H "Host: test.localhost:3004" http://localhost:3004/.well-known/oauth-authorization-server
# Current result: {"error":"Internal server error"} (SST Resource issue)

# Test OAuth protected resource
curl -H "Host: test.localhost:3004" http://localhost:3004/.well-known/oauth-protected-resource

# Test login page
# Visit: http://test.localhost:3004/mcp-auth/login?client_id=...
```

## Next Steps

1. **Investigate MCPlatform's SST Resource Pattern**: How do they handle `Resource.Postgres` in development?
2. **Development Workflow**: What's their exact dev command sequence?
3. **Database Package Structure**: How do they avoid SST Resource import issues?

## Future Enhancements

1. **Caching**: Add Redis caching for server lookups
2. **Rate Limiting**: Add rate limiting per subdomain
3. **Monitoring**: Add telemetry for vhost resolution performance
4. **Multi-Region**: Support for regional database routing

---

**Key Insight**: The vhost resolution happens entirely server-side in API routes where we have proper access to headers, not in client-side code where database modules can't be bundled.