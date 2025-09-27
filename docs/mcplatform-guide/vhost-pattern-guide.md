# MCPlatform VHost Resolution Pattern Guide

## Overview

This document explains the **MCPlatform pattern** for solving vhost/subdomain resolution while avoiding Node.js module bundling issues in Next.js. The key insight is using a centralized API route for all database operations while keeping client-side endpoints as simple proxies.

## The Problem

Initially, database imports were scattered across multiple OAuth endpoints (`/.well-known/*`, login pages, etc.), which caused Next.js to try bundling PostgreSQL modules for the client side, resulting in errors like:

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

## Complete Implementation

### Centralized API Route

**File**: `/app/api/mcpserver/[...slug]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  try {
    // Dynamic import to prevent client bundling issues
    const { db, mcpServer } = await import('database')
    const { eq } = await import('drizzle-orm')

    // Extract subdomain from Host header
    const requestHost = request.headers.get('host') ?? new URL(request.url).host
    const requestHostname = requestHost.split(':')[0]
    const subdomain = requestHostname.split('.')[0]

    // Database lookup by subdomain slug
    const servers = await db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.slug, subdomain))
      .limit(1)

    if (servers.length === 0) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    const server = servers[0]
    const action = params.slug[0] || 'config'

    switch (action) {
      case 'config':
        return NextResponse.json({ server })

      case 'oauth-discovery':
        return NextResponse.json({
          issuer: server.issuerUrl,
          authorization_endpoint: server.authorizationEndpoint,
          token_endpoint: server.tokenEndpoint,
          registration_endpoint: server.registrationEndpoint,
          introspection_endpoint: server.introspectionEndpoint,
          revocation_endpoint: server.revocationEndpoint,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
          scopes_supported: ['openid', 'profile', 'email'],
        })

      case 'oauth-protected-resource':
        return NextResponse.json({
          resource: server.issuerUrl,
          authorization_servers: [server.issuerUrl],
          scopes_supported: ['openid', 'profile', 'email'],
          bearer_methods_supported: ['header'],
        })

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('MCP server API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Proxy Endpoints

**File**: `/.well-known/oauth-authorization-server/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || 'localhost:3000'
  const centralizedUrl = `http://${host}/api/mcpserver/oauth-discovery`

  try {
    const response = await fetch(centralizedUrl, {
      headers: { 'Host': host }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch OAuth discovery' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    console.error('OAuth discovery proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**File**: `/.well-known/oauth-protected-resource/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || 'localhost:3000'
  const centralizedUrl = `http://${host}/api/mcpserver/oauth-protected-resource`

  try {
    const response = await fetch(centralizedUrl, {
      headers: { 'Host': host }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch protected resource metadata' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    console.error('Protected resource proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## VHost Resolution Logic

### Development vs Production

**Development**: `test.localhost:3000` → subdomain = `test`
**Production**: `test.mcp-obs.com` → subdomain = `test`

```typescript
// Universal vhost extraction
function extractSubdomain(host: string): string {
  const hostname = host.split(':')[0] // Remove port
  const parts = hostname.split('.')

  // For development (*.localhost)
  if (parts.includes('localhost')) {
    return parts[0]
  }

  // For production (*.mcp-obs.com)
  if (parts.length >= 3) {
    return parts[0]
  }

  // Fallback
  return 'default'
}
```

### Database Schema Integration

The `mcpServer` table uses a `slug` field for subdomain mapping:

```typescript
export const mcpServer = pgTable('mcp_server', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(), // Global slug for subdomain (e.g., 'test', 'acme-corp')
  name: text('name').notNull(),
  organizationId: text('organization_id').notNull(),
  issuerUrl: text('issuer_url').notNull(),
  authorizationEndpoint: text('authorization_endpoint').notNull(),
  tokenEndpoint: text('token_endpoint').notNull(),
  registrationEndpoint: text('registration_endpoint'),
  introspectionEndpoint: text('introspection_endpoint'),
  revocationEndpoint: text('revocation_endpoint'),
  // ... other fields
})
```

## Client-Side Integration

### React Component Example

```typescript
'use client'

import { useState, useEffect } from 'react'

interface McpServer {
  id: string
  name: string
  slug: string
  issuerUrl: string
}

export function McpServerInfo() {
  const [server, setServer] = useState<McpServer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchServer() {
      try {
        const response = await fetch('/api/mcpserver/config')

        if (!response.ok) {
          throw new Error('Failed to fetch server info')
        }

        const data = await response.json()
        setServer(data.server)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchServer()
  }, [])

  if (loading) return <div>Loading server info...</div>
  if (error) return <div>Error: {error}</div>
  if (!server) return <div>Server not found</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{server.name}</h1>
      <p>Slug: {server.slug}</p>
      <p>Issuer: {server.issuerUrl}</p>
    </div>
  )
}
```

## Error Handling Patterns

### Centralized Error Handling

```typescript
// In centralized API
export async function GET(request: NextRequest) {
  try {
    // ... implementation
  } catch (error) {
    console.error('MCP server API error:', error)

    if (error instanceof DatabaseError) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      )
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid subdomain format' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Proxy Error Propagation

```typescript
// In proxy endpoints
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(centralizedUrl)

    // Forward status codes and errors from centralized API
    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(errorData, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Proxy request failed' },
      { status: 502 }
    )
  }
}
```

## Testing Strategy

### Development Testing

```bash
# Test OAuth discovery
curl -H "Host: test.localhost:3004" http://localhost:3004/.well-known/oauth-authorization-server

# Test OAuth protected resource
curl -H "Host: test.localhost:3004" http://localhost:3004/.well-known/oauth-protected-resource

# Test direct API access
curl -H "Host: test.localhost:3004" http://localhost:3004/api/mcpserver/config
```

### Production Testing

```bash
# Test production subdomain
curl https://test.mcp-obs.com/.well-known/oauth-authorization-server

# Test with different subdomains
curl https://acme-corp.mcp-obs.com/.well-known/oauth-authorization-server
```

## Performance Considerations

### Caching Strategy

```typescript
// Add caching to centralized API
export async function GET(request: NextRequest) {
  const cacheKey = `server:${subdomain}`

  // Check cache first
  const cached = await redis.get(cacheKey)
  if (cached) {
    return NextResponse.json(JSON.parse(cached))
  }

  // Database lookup
  const servers = await db.select()...

  // Cache result
  await redis.setex(cacheKey, 3600, JSON.stringify(servers[0]))

  return NextResponse.json(servers[0])
}
```

### Request Deduplication

```typescript
// Use React Query or SWR for client-side caching
import useSWR from 'swr'

export function McpServerInfo() {
  const { data: server, error } = useSWR('/api/mcpserver/config', fetch)
  // Component implementation...
}
```

## Future Enhancements

1. **Redis Caching**: Add Redis caching for server lookups
2. **Rate Limiting**: Add rate limiting per subdomain
3. **Monitoring**: Add telemetry for vhost resolution performance
4. **Multi-Region**: Support for regional database routing
5. **Custom Domains**: Support for custom domain mapping beyond subdomains

## Key Insights

1. **VHost resolution happens entirely server-side** in API routes where we have proper access to headers, not in client-side code where database modules can't be bundled.

2. **Centralization is key**: All database operations in one place prevents module bundling issues and provides a single point of maintenance.

3. **Proxy pattern works**: Simple proxies with fetch calls avoid complexity while maintaining functionality.

4. **Host header is reliable**: Using `request.headers.get('host')` provides consistent subdomain extraction across environments.

This pattern ensures clean separation of concerns, avoids Next.js bundling issues, and provides reliable vhost resolution for multi-tenant applications.