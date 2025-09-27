# MCPlatform Implementation Guide

This directory contains organized documentation for MCPlatform patterns and implementation strategies, extracted and refined from the original scattered documentation.

## Overview

MCPlatform is the architectural foundation for building scalable, multi-tenant MCP (Model Context Protocol) servers with enterprise-grade authentication and observability. These guides document proven patterns and best practices.

## Guide Contents

### 🏗️ [oRPC Implementation Guide](./orpc-implementation-guide.md)
**Focus**: Server actions pattern over complex procedures
- Transition from complex oRPC procedures to clean server actions
- Type-safe APIs with proper error handling
- Organization-scoped security for multi-tenancy
- Cache revalidation and performance optimization

### 🔐 [Dual Auth System Guide](./dual-auth-system-guide.md)
**Focus**: Better Auth integration with dual schema pattern
- Separate authentication layer from business logic
- Better Auth compatibility without schema conflicts
- Email-based user bridging between systems
- Organization boundaries and context injection

### 🎫 [MCP Authentication Guide](./mcp-auth-guide.md)
**Focus**: Complete authentication architecture and tables
- Better Auth core tables for authentication
- OAuth 2.1 server implementation tables
- User capture system for analytics
- Database schema design and relationships

### 🔄 [OAuth Server Integration Guide](./oauth-server-integration-guide.md)
**Focus**: Direct database validation over HTTP introspection
- Database-direct token validation pattern
- Shared libraries approach for validation logic
- Server SDK implementation with database access
- Performance benefits of avoiding HTTP calls

### 🌐 [VHost Pattern Guide](./vhost-pattern-guide.md)
**Focus**: Subdomain resolution without bundling issues
- Centralized API route for database operations
- Proxy endpoints to avoid client bundling issues
- Host header-based subdomain extraction
- Clean architecture separation

## Architecture Overview

```
MCPlatform Architecture:
┌─────────────────────────────────────────────────────────────────┐
│ Multi-tenant MCP Platform                                       │
├─────────────────────────────────────────────────────────────────┤
│ VHost Resolution (subdomain-based routing)                     │
├─────────────────────────────────────────────────────────────────┤
│ Dual Authentication System:                                    │
│ ├── Better Auth (session management)                           │
│ └── User Capture (business intelligence)                       │
├─────────────────────────────────────────────────────────────────┤
│ OAuth 2.1 Server (direct database validation)                  │
├─────────────────────────────────────────────────────────────────┤
│ oRPC Server Actions (type-safe APIs)                           │
├─────────────────────────────────────────────────────────────────┤
│ Organization-scoped Data Layer                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Principles

### 1. **Direct Database Access Pattern**
- No HTTP introspection calls between services
- Shared database package for validation logic
- Better performance and error handling

### 2. **Dual Schema Architecture**
- Separate auth tables from business logic
- Better Auth compatibility without mapping issues
- Email-based bridging between systems

### 3. **Organization-first Multi-tenancy**
- All operations scoped to organizations
- Subdomain-based tenant resolution
- Complete data isolation

### 4. **Type-safe Server Actions**
- Replace complex procedures with simple actions
- Zod validation and Drizzle type safety
- Proper error boundaries and cache management

### 5. **Clean Module Boundaries**
- Centralized database access points
- Proxy patterns to avoid bundling issues
- Server-only utilities with client-safe exports

## Implementation Order

1. **Start with VHost Pattern** - Sets up the foundation for multi-tenant routing
2. **Implement Dual Auth System** - Establishes authentication infrastructure
3. **Add OAuth Server Integration** - Enables direct database token validation
4. **Setup oRPC Server Actions** - Provides type-safe API layer
5. **Configure MCP Authentication** - Complete the authentication tables and flows

## Key Benefits

- **Performance**: Direct database access vs HTTP calls
- **Type Safety**: Full TypeScript safety across the stack
- **Security**: Organization-scoped operations and proper boundaries
- **Maintainability**: Clear patterns and separation of concerns
- **Scalability**: Multi-tenant architecture with proper isolation

## Related Resources

- **Original Files**: Individual patterns documented in `/docs/*.md`
- **Project Guide**: `/CLAUDE.md` for overall project structure
- **Database Schema**: `/packages/database/src/` for schema implementations
- **Implementation Examples**: `/demo-mcp/` for working examples

## Usage

Each guide is self-contained and can be implemented independently, though they work best together as a complete system. Start with the guide most relevant to your current implementation needs.

The guides include:
- ✅ **Problem statements** - What issues each pattern solves
- ✅ **Implementation examples** - Real TypeScript code
- ✅ **Architecture diagrams** - Visual system overviews
- ✅ **Best practices** - Proven patterns and approaches
- ✅ **Security considerations** - Multi-tenant safety measures
- ✅ **Migration strategies** - How to adopt these patterns

These patterns have been battle-tested in production MCPlatform deployments and provide a solid foundation for building scalable MCP infrastructure.