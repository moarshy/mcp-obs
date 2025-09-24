# oRPC Structure

This directory contains all oRPC-related configurations and procedures for type-safe API calls.

## Structure

```
lib/orpc/
├── index.ts           # Main exports for easy importing
├── client.ts          # Client-side oRPC configuration and hooks
├── server.ts          # Server-side procedures and context
├── router.ts          # Main oRPC router combining all procedures
├── procedures/        # Individual procedure definitions
│   └── auth.ts       # Authentication-related procedures
└── actions/          # Additional server actions (if needed)
```

## Usage

### Client-side (React components)
```typescript
import { orpcHooks } from '@/lib/orpc'

const { data, isLoading } = orpcHooks.auth.getMe.useQuery()
```

### Server-side (API routes)
```typescript
import { appRouter } from '@/lib/orpc'
```

## Adding New Procedures

1. Create new procedure file in `procedures/`
2. Import and add to main router in `router.ts`
3. Procedures will automatically be available on client via hooks