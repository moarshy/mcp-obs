# mcp-obs Documentation

This directory contains comprehensive documentation for the mcp-obs project, including architectural decisions, implementation patterns, and lessons learned.

## Architecture Guides

### [Authentication Architecture Guide](./auth-architecture-guide.md)
**Key Topics:**
- Resolving Next.js server/client boundary issues
- Proper separation of auth utilities
- Server-side session management with Better Auth
- Organization-scoped security patterns
- Common pitfalls and migration strategies

**Use When:**
- Setting up authentication flows
- Debugging server/client import issues
- Implementing organization-based multi-tenancy

### [oRPC Server Actions Implementation Guide](./orpc-server-actions-guide.md)
**Key Topics:**
- Transitioning from complex oRPC procedures to clean server actions
- MCPlatform-inspired patterns for CRUD operations
- Real database integration with Drizzle ORM
- Typed error handling and cache management
- Security considerations and testing strategies

**Use When:**
- Implementing new CRUD functionality
- Refactoring complex oRPC setups
- Creating server actions for form handling
- Setting up database operations

## Quick Reference

### Common Commands
```bash
# Development
bun dev                    # Start SST development environment
cd packages/dashboard && bun run dev  # Start Next.js only

# Database
bun run db:generate       # Generate Drizzle migrations
bun run db:migrate        # Run database migrations
bun run studio           # Open database studio

# Build & Deploy
bun run build            # Build all packages
bun run lint             # Run linting
bun run type-check       # TypeScript validation
```

### Key File Locations
```
packages/dashboard/src/
├── lib/auth/
│   ├── index.ts         # Client-safe auth exports only
│   ├── session.ts       # Server-side session utilities
│   ├── server.ts        # Server-side auth helpers
│   └── config.ts        # Better Auth configuration
├── lib/orpc/
│   ├── router.ts        # Base router with error definitions
│   └── actions/         # Server actions for mutations
│       ├── mcp-servers.ts
│       └── organizations.ts
└── app/dashboard/       # Dashboard pages with direct DB queries
```

## Development Patterns

### Authentication Flow
1. **Client Components**: Import from `@/lib/auth` (client-safe only)
2. **Server Components**: Import from `@/lib/auth/session` or `@/lib/auth/server`
3. **API Routes**: Use `getServerSession()` from `@/lib/auth/server`

### Data Operations
1. **Mutations**: Use server actions from `/lib/orpc/actions/`
2. **Reads**: Direct database queries in Server Components
3. **Client Forms**: Use `useServerAction()` hook with server actions

### Security Model
1. **Authentication**: Better Auth with email/password + OAuth
2. **Authorization**: Organization-scoped access control
3. **Data Isolation**: All queries filtered by organization membership

## Troubleshooting

### Common Issues

#### Build Errors
- **`next/headers` in client context**: Check auth import structure
- **Module not found**: Verify server-only imports are not in client bundles
- **Parsing errors**: Check for malformed try-catch blocks or missing returns

#### Database Issues
- **Connection errors**: Verify DATABASE_URL in environment
- **Schema mismatches**: Run `bun run db:generate` and `bun run db:migrate`
- **Type errors**: Ensure Drizzle schema matches database structure

#### Authentication Problems
- **Session not found**: Check Better Auth configuration and database setup
- **Org access denied**: Verify user has membership in organization
- **Redirect loops**: Ensure session validation logic is correct

## Architecture Decisions

### Why Server Actions over Complex oRPC?
- **Simplicity**: Direct database operations without procedure overhead
- **Type Safety**: Zod validation + Drizzle ORM types
- **Performance**: No unnecessary abstraction layers
- **Maintainability**: Clear separation of concerns

### Why Separate Auth Modules?
- **Build Stability**: Prevents server/client boundary violations
- **Security**: Clear separation of client-safe vs server-only utilities
- **Debugging**: Easier to trace auth-related issues

### Why Organization-Scoped Security?
- **Multi-tenancy**: Complete data isolation between organizations
- **Compliance**: Meets enterprise security requirements
- **Scalability**: Can handle multiple organizations per user

## Contributing

When adding new features:

1. **Follow established patterns** documented in these guides
2. **Implement server actions** for mutations using the template
3. **Add proper error handling** with typed errors
4. **Include cache revalidation** after mutations
5. **Verify organization scoping** for all data operations
6. **Update documentation** for significant changes

## Additional Resources

- [Project Setup Guide](../README.md)
- [Product Requirements](../docs/0.prd.md)
- [Database Schema](../packages/database/src/)
- [Better Auth Documentation](https://better-auth.com/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

---

This documentation reflects the current state of the mcp-obs architecture as of the auth/oRPC refactoring. Keep it updated as the codebase evolves.