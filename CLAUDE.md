# MCPlatform Project Guide

## Project Essence

**MCPlatform** is the "Auth0 + OpenTelemetry for MCP servers" - a comprehensive Next.js application that provides enterprise-grade authentication proxy and observability infrastructure for Model Context Protocol (MCP) servers.

**Value Proposition**: Enable companies to add authentication and OpenTelemetry-based observability to their MCP servers in minutes, without building auth infrastructure themselves.

## Architecture Overview

### Core Components
- **MCPlatform Infrastructure**: Next.js app with OAuth service, OpenTelemetry collector, and customer dashboard
- **MCPlatform SDK**:
  - **Server-Side SDK**: Integration library for customers' MCP servers (auth middleware, telemetry)
  - **Client-Side SDK**: Integration for MCP clients (OAuth handling, session management)
- **Dual Auth System**: Platform auth (customers) + sub-tenant auth (end-users)

### Key Technical Flow
1. Customer (e.g., DocuAPI) registers MCP server → gets subdomain (docuapi.mcplatform.com)
2. Integrates MCPlatform Server SDK into existing MCP server
3. End-users authenticate through MCPlatform OAuth when accessing MCP server
4. **Distributed Tracing**: Both client and server SDKs send OpenTelemetry to Next.js collector
5. Next.js exports telemetry to customer's observability platform (Datadog, Grafana, etc.)
6. Customer gets complete user analytics, usage metrics, and business intelligence

### User Isolation Model
- End users are scoped per organization/MCP server
- Each organization gets separate user namespace via subdomain-based OAuth
- Complete data isolation between organizations

## Tech Stack

### Core Framework
- **Frontend/API**: Next.js 15 (App Router)
- **Runtime & Package Manager**: Bun
- **Server Actions**: oRPC for type-safe server-side actions
- **Language**: TypeScript (strict mode)

### Authentication & Database
- **Authentication**: Better Auth (dual auth system)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with type-safe operations
- **Infrastructure**: AWS (SST framework)

### Styling & UI
- **CSS Framework**: Tailwind CSS v4 (CSS-first configuration)
- **Component Library**: shadcn/ui with TweakCN configuration
- **Theme System**: CSS variables with OKLCH color format

### Observability
- **Telemetry**: OpenTelemetry (traces, metrics, logs)
- **Collector**: Next.js server acts as OTEL collector
- **Export**: Customer's observability platforms via OTLP

## Development Commands

### Setup Commands
```bash
# Project is already initialized - just install and run
bun install           # Install all dependencies

# Development
bun dev               # Start development server
bun run build         # Build all packages and dashboard
bun run lint          # Run ESLint
bun run type-check    # TypeScript checking across all packages

# Database commands (when DATABASE_URL is configured)
bun run db:generate   # Generate migrations
bun run db:migrate    # Run migrations
```

### Project Status
```
✅ SCAFFOLDING COMPLETE
- Monorepo structure with Bun workspace
- Next.js 15 dashboard with App Router
- Database package with Drizzle ORM
- Server SDK and Client SDK packages
- SST configuration for AWS deployment
- Development tooling (ESLint, TypeScript)

🚧 IMPLEMENTATION NEEDED
- Better Auth integration (dual auth system)
- oRPC setup for type-safe APIs
- shadcn/ui components and theming
- Business logic and features per specifications
```

## Project Structure

```
mcp-obs/
├── packages/
│   ├── dashboard/           # Main Next.js application
│   │   ├── src/
│   │   │   ├── app/         # Next.js App Router
│   │   │   │   ├── layout.tsx                  # Root layout
│   │   │   │   ├── page.tsx                    # Homepage
│   │   │   │   └── globals.css                 # Tailwind CSS
│   │   │   ├── components/                     # (Future: shadcn/ui components)
│   │   │   └── lib/                            # (Future: auth, oRPC, utilities)
│   │   ├── drizzle/                            # Database migrations
│   │   ├── drizzle.config.ts                   # Drizzle configuration
│   │   └── postcss.config.mjs                  # PostCSS for Tailwind v4
│   ├── database/            # Shared database schemas
│   │   ├── src/
│   │   │   ├── schema.ts                       # Basic database schema
│   │   │   ├── connection.ts                   # Database connection utilities
│   │   │   └── index.ts                        # Package exports
│   │   ├── dist/                               # Compiled TypeScript
│   │   └── tsconfig.json                       # TypeScript config
│   ├── server-sdk/          # MCPlatform Server SDK (placeholder)
│   │   ├── src/index.ts                        # SDK interface
│   │   └── dist/                               # Compiled TypeScript
│   └── client-sdk/          # MCPlatform Client SDK (placeholder)
│       ├── src/index.ts                        # Client interface
│       └── dist/                               # Compiled TypeScript
├── docs/
│   └── 0.prd.md             # Product Requirements Document
├── specifications/
│   └── project-setup/       # Feature specifications
└── sst.config.ts            # SST infrastructure config
```

## Configuration Files

### Key Config Files
- **`drizzle.config.ts`**: Database schema and migration config
- **`postcss.config.mjs`**: PostCSS with `@tailwindcss/postcss` for v4
- **`sst.config.ts`**: AWS infrastructure as code
- **`src/lib/auth.ts`**: Better Auth configuration with Drizzle adapter

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mcplatform

# Better Auth
BETTER_AUTH_SECRET=your-secret-key
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-secret

# Infrastructure
AWS_REGION=us-east-1
```

## Important Patterns

### Data Fetching Pattern
- Server components fetch data and pass promises to client components
- Client components use React's `use()` hook with `<Suspense>` and `<ErrorBoundary>`
- oRPC procedures for mutations and server actions
- URL state management with `nuqs`

### Organization Scoping
- All database operations MUST respect organization boundaries
- Use organization ID in all queries and mutations
- Multi-tenant data isolation via organization context

### Authentication Context
- **Platform Auth**: Dashboard users (customers like DocuAPI)
- **Sub-tenant Auth**: End-users of customer products (users accessing DocuAPI's MCP server)
- Clear separation between the two authentication systems

## Development Guidelines

### Code Style
- Use shadcn/ui components exclusively
- Follow Tailwind CSS v4 patterns with CSS variables
- Implement responsive design for mobile support
- Use TypeScript strict mode with proper type safety

### Database Schema
- All schemas defined in `packages/database/src/`
- Platform auth tables separate from MCP user tables
- Organization-scoped foreign keys for data isolation

### Error Handling
- Use proper error boundaries and suspense patterns
- Implement graceful fallbacks for auth and data loading
- Log errors appropriately for debugging

## Testing & Quality

### Linting & Type Checking
```bash
bun run lint              # ESLint
bun run typecheck         # TypeScript compiler
bun run build             # Production build test
```

### Important Notes
- NEVER commit without running lint and typecheck
- All components must be responsive (mobile-first design)
- Authentication flows must handle both platform and sub-tenant users
- Database operations must be organization-scoped
- OpenTelemetry instrumentation is critical for business value

## Deployment

### SST Infrastructure
- AWS-based deployment using SST framework
- PostgreSQL RDS for production database
- S3 + CloudFront for static assets
- Lambda for serverless functions

### Environment Setup
- Development: Local PostgreSQL + Bun dev server
- Staging: AWS infrastructure with SST
- Production: Full AWS deployment with monitoring

---

**Quick Start**: Run `bun dev` after setup to start development server. The project essence is captured in `/docs/0.prd.md` for detailed business context.