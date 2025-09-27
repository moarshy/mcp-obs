# mcp-obs Project Guide

## Project Essence

**mcp-obs** is the "Auth0 + OpenTelemetry for MCP servers" - a comprehensive Next.js application that provides enterprise-grade authentication proxy and observability infrastructure for Model Context Protocol (MCP) servers.

**Value Proposition**: Enable companies to add authentication and OpenTelemetry-based observability to their MCP servers in minutes, without building auth infrastructure themselves.

## Architecture Overview

### Core Components
- **mcp-obs Infrastructure**: Next.js app with OAuth service, OpenTelemetry collector, and customer dashboard
- **mcp-obs SDK**:
  - **Server-Side SDK**: Integration library for customers' MCP servers (auth middleware, telemetry)
  - **Client-Side SDK**: Integration for MCP clients (OAuth handling, session management)
- **Dual Auth System**: Platform Auth (customers with organization management) + MCP Server Auth (end-users)

### Key Technical Flow
1. Customer (e.g., DocuAPI) registers MCP server → gets subdomain (docuapi.mcp-obs.com)
2. Integrates mcp-obs Server SDK into existing MCP server
3. End-users authenticate through mcp-obs OAuth when accessing MCP server
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
- **Authentication**: Better Auth (Platform Auth + MCP Server Auth)
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

### Current Implementation Status
```
✅ SCAFFOLDING COMPLETE
- Monorepo structure with Bun workspace
- Next.js 15 dashboard with App Router
- Database package with Drizzle ORM
- TypeScript and Python SDKs with OAuth functionality
- SST configuration for AWS deployment
- Development tooling (ESLint, TypeScript)

✅ SDK IMPLEMENTATION COMPLETE
- TypeScript mcp-server SDK with OAuth middleware
- Python mcp-server SDK with full OAuth feature parity
- Transport adapters (stdio, HTTP, streamable HTTP)
- FastAPI and Flask integration support
- Comprehensive documentation and examples

🚧 IMPLEMENTATION NEEDED
- Better Auth integration (dual auth system)
- oRPC setup for type-safe APIs
- shadcn/ui components and theming
- Business logic and features per specifications
- Platform SDKs (TypeScript/Python client libraries)
```

## Project Structure

```
mcp-obs/
├── packages/
│   ├── dashboard/           # Main Next.js application
│   │   ├── src/
│   │   │   ├── app/         # Next.js App Router
│   │   │   │   ├── layout.tsx                  # ✅ Root layout
│   │   │   │   ├── page.tsx                    # ✅ Homepage
│   │   │   │   ├── globals.css                 # ✅ Tailwind CSS
│   │   │   │   └── api/                        # API routes
│   │   │   │       ├── auth/[...auth]/route.ts # 🚧 Better Auth endpoint
│   │   │   │       └── rpc/[[...rest]]/route.ts # 🚧 oRPC API endpoint
│   │   │   ├── components/                     # shadcn/ui components
│   │   │   │   ├── ui/                         # 🚧 Base UI components
│   │   │   │   ├── dashboard/                  # 🚧 Dashboard-specific components
│   │   │   │   └── auth/                       # 🚧 Authentication components
│   │   │   └── lib/                            # Utilities and configurations
│   │   │       ├── auth.ts                     # 🚧 Better Auth configuration
│   │   │       ├── orpc.ts                     # 🚧 oRPC client setup
│   │   │       ├── orpc.server.ts              # 🚧 Server-side oRPC client
│   │   │       └── utils.ts                    # 🚧 Utility functions
│   │   ├── drizzle/                            # Database migrations
│   │   ├── drizzle.config.ts                   # Drizzle configuration
│   │   └── postcss.config.mjs                  # PostCSS for Tailwind v4
│   ├── database/            # Shared database schemas
│   │   ├── src/
│   │   │   ├── schema.ts                       # ✅ Basic schema (expand for features)
│   │   │   ├── platform-auth-schema.ts         # 🚧 Platform auth schema (orgs, users, roles)
│   │   │   ├── mcp-server-auth-schema.ts       # 🚧 MCP server auth schema (end-users)
│   │   │   ├── connection.ts                   # ✅ Database connection utilities
│   │   │   └── index.ts                        # ✅ Package exports
│   │   ├── dist/                               # ✅ Compiled TypeScript
│   │   └── tsconfig.json                       # ✅ TypeScript config
│   └── sdk/                 # mcp-obs SDKs (multi-language support)
│       ├── typescript/      # TypeScript SDK packages
│       │   ├── mcp-server/  # OAuth middleware for MCP servers
│       │   │   ├── src/
│       │   │   │   ├── oauth-middleware.ts     # ✅ OAuth decorators and middleware
│       │   │   │   ├── oauth-validator.ts      # ✅ HTTP token validation
│       │   │   │   └── transport-adapters.ts   # ✅ Transport-specific adapters
│       │   │   ├── package.json                # ✅ NPM package configuration
│       │   │   └── dist/                       # ✅ Compiled TypeScript
│       │   └── platform/    # Platform API client
│       │       ├── src/
│       │       │   └── index.ts                # ✅ Basic platform client
│       │       └── package.json                # ✅ NPM package configuration
│       └── python/          # Python SDK packages
│           ├── mcp-server/  # OAuth middleware for MCP servers
│           │   ├── src/mcp_obs_server/
│           │   │   ├── __init__.py             # ✅ Package exports
│           │   │   ├── types.py                # ✅ Pydantic type definitions
│           │   │   ├── oauth_validator.py      # ✅ HTTP token validation
│           │   │   ├── oauth_middleware.py     # ✅ OAuth decorators
│           │   │   └── transport_adapters.py   # ✅ FastAPI/Flask integration
│           │   ├── pyproject.toml              # ✅ UV package configuration
│           │   └── README.md                   # ✅ Comprehensive documentation
│           └── platform/    # Platform API client (future)
│               └── pyproject.toml              # 🚧 Python platform client
├── docs/
│   └── 0.prd.md             # Product Requirements Document
├── specifications/
│   └── project-setup/       # Feature specifications
├── sst.config.ts            # ✅ SST infrastructure config (template)
└── README.md                # ✅ Project setup and development guide

Legend: ✅ Implemented | 🚧 To be implemented following this guide
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
DATABASE_URL=postgresql://user:password@localhost:5432/mcp_obs

# Better Auth
BETTER_AUTH_SECRET=your-secret-key
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-secret

# Infrastructure
AWS_REGION=us-east-1
```

## Feature Implementation Guide

### Where to Implement Key Features

#### Authentication System (Better Auth)
- **Platform Auth Config**: `packages/dashboard/src/lib/platform-auth.ts` - Platform auth with organization management
- **MCP Server Auth Config**: `packages/dashboard/src/lib/mcp-server-auth.ts` - MCP server end-user auth
- **Routes**: `packages/dashboard/src/app/api/auth/[...auth]/route.ts` - Platform auth endpoints
- **MCP Routes**: `packages/dashboard/src/app/api/mcp-auth/[...auth]/route.ts` - MCP server auth endpoints
- **Schemas**: `packages/database/src/platform-auth-schema.ts` + `packages/database/src/mcp-server-auth-schema.ts`
- **Components**: `packages/dashboard/src/components/auth/` - Login, signup, profile, organization management

#### oRPC Type-Safe APIs
- **Server Setup**: `packages/dashboard/src/lib/orpc.server.ts` - Server-side oRPC client
- **Client Setup**: `packages/dashboard/src/lib/orpc.ts` - Client-side oRPC setup
- **API Routes**: `packages/dashboard/src/app/api/rpc/[[...rest]]/route.ts` - oRPC endpoint
- **Procedures**: Create separate files in `src/lib/procedures/` for different domains

#### UI Components (shadcn/ui)
- **Base Components**: `packages/dashboard/src/components/ui/` - Button, Input, Dialog, etc.
- **Dashboard Components**: `packages/dashboard/src/components/dashboard/` - Charts, tables, layouts
- **Theme Config**: Use TweakCN with CSS variables in `globals.css`

#### Database Schemas & Operations
- **Platform Auth**: `packages/database/src/platform-auth-schema.ts` - Customer users, organizations, roles, billing
- **MCP Server Auth**: `packages/database/src/mcp-server-auth-schema.ts` - End-user authentication, sessions
- **Business Logic**: Expand `packages/database/src/schema.ts` - MCP servers, analytics, usage tracking

#### Organization Management Features
- **Organization CRUD**: Create, read, update, delete organizations
- **Member Management**: Invite users, assign roles (admin, member, viewer)
- **MCP Server Management**: Register servers, configure auth providers per organization
- **Usage Tracking**: Monitor API calls, sessions, and billing metrics per organization
- **Domain Configuration**: Custom domains and subdomain management

#### SDK Implementation
- **TypeScript mcp-server SDK**: `packages/sdk/typescript/mcp-server/src/` - OAuth middleware and transport adapters
- **Python mcp-server SDK**: `packages/sdk/python/mcp-server/src/mcp_obs_server/` - Full-featured Python OAuth integration
- **Platform SDKs**: `packages/sdk/{typescript,python}/platform/` - API clients for mcp-obs platform
- **Multi-language Support**: Consistent APIs across TypeScript and Python implementations

#### OpenTelemetry Integration
- **Instrumentation**: `packages/server-sdk/src/telemetry.ts` - OTEL setup for MCP servers
- **Collector**: Next.js API routes to receive and forward telemetry data
- **Export**: Configuration for customer observability platforms (Datadog, Grafana)

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
- **Platform Auth**: Dashboard users (customers like DocuAPI) with organization management capabilities
- **MCP Server Auth**: End-users of customer products (users accessing DocuAPI's MCP server)
- Clear separation between the two authentication systems

#### Platform Auth Features
- **Organization Management**: Create, manage, and configure customer organizations
- **User Management**: Invite team members, assign roles (admin, member)
- **MCP Server Registration**: Register and configure MCP servers per organization
- **Billing & Usage**: Track usage metrics and manage subscriptions
- **Domain Management**: Custom domains and subdomain configuration

#### MCP Server Auth Features
- **End-User Authentication**: OAuth flows for accessing MCP servers
- **Multi-Provider Support**: Google, GitHub, email-based authentication
- **Session Management**: Secure session handling per MCP server
- **Scoped Access**: Users isolated per organization/MCP server

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

## Development TODOs

### Security Enhancements (Post-MVP)
- [ ] **Password Security**: Implement bcrypt password hashing and strength requirements
- [ ] **Enhanced Auth Security**: Add rate limiting, account lockout policies, and brute force protection
- [ ] **Session Security**: Implement session timeout policies and concurrent session limits

### Email Features (Post-MVP)
- [ ] **Team Invitation Emails**: Replace shareable links with email-based invitation system
- [ ] **Email Templates**: Professional email templates for invitations, welcome messages, and notifications
- [ ] **Email Provider Integration**: Configure SendGrid, AWS SES, or similar for production email delivery