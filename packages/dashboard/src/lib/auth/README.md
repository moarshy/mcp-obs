# Authentication Structure

This directory contains all authentication-related configurations, utilities, and types for the mcp-obs dashboard.

## Structure

```
lib/auth/
├── index.ts           # Main exports (server-side safe)
├── config.ts          # Better Auth configuration
├── client.ts          # Client-side auth utilities and hooks
├── server.ts          # Server-side auth utilities
└── types.ts           # TypeScript type definitions
```

## Usage

### Server Components & API Routes
```typescript
import { auth, getServerSession, requireAuth } from '@/lib/auth'

// In API routes or server components
const { user, session } = await getServerSession()
```

### Client Components
```typescript
import { useAuth, authClient } from '@/lib/auth/client'

// In client components
const { user, isLoading, isAuthenticated } = useAuth()
```

### Types
```typescript
import type { AuthUser, SignInFormData, Role } from '@/lib/auth'
```

## Key Features

- **Better Auth Integration**: Complete setup with organization plugin
- **Multi-Organization Support**: Users can belong to multiple organizations
- **Type Safety**: Full TypeScript support with proper types
- **Server/Client Separation**: Clear boundary between server and client code
- **Role-Based Access**: Owner, Admin, Member roles with proper validation

## Authentication Flow

1. User signs up/in through Better Auth
2. Organization membership is checked/created
3. Session includes active organization context
4. Role-based permissions are enforced server-side