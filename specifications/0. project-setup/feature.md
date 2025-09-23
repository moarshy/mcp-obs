---
date: 2025-09-23T15:52:03+08:00
researcher: Claude Code
git_commit: N/A (not a git repository)
branch: N/A
repository: mcp-obs
topic: "Project Foundation Setup Feature Specification"
tags: [feature, requirements, specification, foundation, setup, infrastructure]
status: complete
last_updated: 2025-09-23
last_updated_by: Claude Code
type: feature
---

# Project Foundation Setup Feature

## Overview
Establish the complete technical foundation for MCPlatform, including Next.js 15 with App Router, modern tooling setup (Bun, TypeScript), database infrastructure (PostgreSQL + Drizzle ORM), authentication system (Better Auth), type-safe API layer (oRPC), and UI framework (Tailwind CSS v4 + shadcn/ui with TweakCN configuration).

## Business Value

### For MCPlatform Development
- **Developer Velocity**: Modern tooling with fast build times and excellent DX
- **Type Safety**: End-to-end TypeScript with compile-time error detection
- **Scalability**: Production-ready infrastructure that can handle enterprise workloads
- **Maintainability**: Well-structured codebase with clear patterns and conventions

### For Future Development
- **Rapid Feature Development**: Solid foundation enables fast iteration
- **Team Onboarding**: Clear project structure and documentation
- **Quality Assurance**: Built-in linting, type checking, and testing infrastructure
- **Performance**: Optimized toolchain for fast development and production builds

## Important Context
Note: all paths provided in this document are relative to the project root unless otherwise specified.

### Current Implementation
This is a greenfield project setup starting from scratch. No existing implementation exists.

### Composition Pattern
- **Server Components**: Async components that fetch data server-side
- **Client Components**: Interactive components with `"use client"` directive
- **oRPC Procedures**: Type-safe server actions for mutations and data fetching
- **Suspense/ErrorBoundary**: Proper loading and error states

### Data Model
Database schemas will be defined in separate packages with Drizzle ORM for type-safe database operations.

## User Stories
(in given/when/then format)

### Developer Experience
1. **Developer**: **Given** I'm setting up the project locally, **when** I run the setup commands, **then** I should have a fully functional development environment with hot reloading, type checking, and database connectivity within 5 minutes.

2. **Developer**: **Given** I'm writing new features, **when** I save a file, **then** the development server should hot-reload instantly with full type checking and no console errors.

### Infrastructure Setup
3. **DevOps Engineer**: **Given** I need to deploy the application, **when** I run the build commands, **then** the application should compile successfully with optimized bundles and proper environment configurations.

4. **Database Administrator**: **Given** I need to set up the database, **when** I run the migration commands, **then** all tables should be created with proper relationships, indexes, and constraints.

### Quality Assurance
5. **Developer**: **Given** I'm submitting code, **when** I run lint and type check commands, **then** there should be no errors or warnings that would prevent production deployment.

## Core Functionality

### Development Environment
- Fast development server with hot module replacement
- TypeScript compilation with strict mode
- ESLint and Prettier for code quality
- Database migrations and development seeding

### Build & Deployment System
- Production-optimized builds with code splitting
- Static asset optimization and caching
- Environment variable management
- AWS deployment via SST

### Type Safety Infrastructure
- End-to-end TypeScript from database to frontend
- Schema validation with runtime type checking
- API type safety with oRPC procedures
- Component prop validation

## Requirements

### Functional Requirements
- **Next.js 15 Setup**: App Router with TypeScript, ESLint, and Tailwind CSS
- **Bun Integration**: Package management and runtime for improved performance
- **Database Layer**: PostgreSQL with Drizzle ORM for type-safe operations
- **Authentication**: Better Auth with dual auth system configuration
- **API Layer**: oRPC setup for type-safe server actions and procedures
- **UI Framework**: Tailwind CSS v4 with shadcn/ui and TweakCN configuration
- **Development Tools**: Hot reloading, type checking, linting, and debugging

### Non-Functional Requirements

#### Performance
- **Development Server**: Sub-second hot reloads
- **Build Time**: Under 30 seconds for production builds
- **Bundle Size**: Optimized bundles with code splitting
- **Database**: Connection pooling for production deployments

#### Security & Permissions
- **Environment Variables**: Secure handling of secrets and API keys
- **Database**: Proper connection security and access controls
- **Dependencies**: Regular security auditing and updates
- **CORS Configuration**: Proper cross-origin resource sharing setup

#### User Experience
- **Error Handling**: Graceful error boundaries and fallbacks
- **Loading States**: Proper suspense and skeleton loading
- **Accessibility**: WCAG 2.1 AA compliance with semantic HTML

#### Mobile Support
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Touch Interactions**: Proper touch targets and gestures
- **Performance**: Optimized for mobile networks and devices

## Design Considerations

### Layout & UI
- **Component Library**: Exclusively use shadcn/ui components
- **Theme System**: CSS variables with OKLCH color format via TweakCN
- **Typography**: Clear hierarchy with accessible contrast ratios
- **Spacing**: Consistent spacing scale using Tailwind utilities

### Responsive Behavior
- **Breakpoints**: Mobile (sm), Tablet (md), Desktop (lg), Large (xl)
- **Grid System**: CSS Grid and Flexbox for complex layouts
- **Image Optimization**: Next.js Image component with responsive sizing
- **Navigation**: Adaptive navigation patterns for different screen sizes

### State Management
- **Server State**: React Server Components with data fetching
- **Client State**: React hooks and context for component state
- **URL State**: nuqs for shareable and bookmarkable state
- **Form State**: React Hook Form with schema validation

## Implementation Considerations

### Technical Architecture
- **Monorepo Structure**: Packages for dashboard, database, SDKs
- **Database Schema**: Separate schemas for platform and MCP auth
- **API Design**: RESTful endpoints for MCP protocol, oRPC for internal APIs
- **Environment Management**: Development, staging, and production configurations

### Dependencies
- **Core Framework**: Next.js 15, React 18+, TypeScript 5+
- **Runtime**: Bun for package management and improved performance
- **Database**: PostgreSQL 16+, Drizzle ORM, connection pooling
- **Authentication**: Better Auth with OAuth provider integration
- **Styling**: Tailwind CSS v4, shadcn/ui, TweakCN configuration
- **Infrastructure**: AWS services via SST framework

## Success Criteria

### Core Functionality
-  Development server starts successfully and serves pages
-  Database connections work with proper migration system
-  Authentication flows function for both platform and sub-tenant users
-  oRPC procedures can be called from client components
-  UI components render correctly with proper theming

### Technical Implementation
-  TypeScript compiles without errors in strict mode
-  ESLint passes with zero warnings or errors
-  Production build completes successfully
-  Database migrations run without issues
-  All environment variables are properly configured

### Engagement Metrics
- **Developer Experience**: Sub-5-minute setup time for new developers
- **Build Performance**: Consistent build times under performance thresholds
- **Code Quality**: Zero TypeScript errors and ESLint warnings

### Business Impact
- **Time to Market**: Faster feature development with solid foundation
- **Maintenance Cost**: Reduced technical debt through proper architecture
- **Team Productivity**: Improved developer experience and collaboration

## Scope Boundaries

### Definitely In Scope
- Complete Next.js 15 application setup with App Router
- Full TypeScript configuration with strict mode
- Database setup with PostgreSQL and Drizzle ORM
- Better Auth integration with OAuth providers
- oRPC setup for type-safe APIs
- Tailwind CSS v4 with shadcn/ui and TweakCN
- Development tooling (ESLint, Prettier, hot reloading)
- Basic SST configuration for AWS deployment
- Project structure with monorepo packages

### Definitely Out of Scope
- Specific feature implementations (authentication flows, dashboard pages)
- Production deployment and infrastructure provisioning
- Comprehensive testing setup (unit, integration, e2e)
- CI/CD pipeline configuration
- Monitoring and observability setup
- Content and data seeding
- Performance optimization beyond basic setup

### Future Considerations
- **Testing Framework**: Jest, Testing Library, Playwright for e2e
- **CI/CD**: GitHub Actions for automated testing and deployment
- **Monitoring**: Application performance monitoring and error tracking
- **Security**: Security scanning and vulnerability assessments
- **Documentation**: API documentation and component stories

## Implementation Details

### Project Structure Setup
```
mcp-obs/
   packages/
      dashboard/           # Main Next.js application
      database/            # Shared database schemas and utilities
      server-sdk/          # MCPlatform Server SDK
      client-sdk/          # MCPlatform Client SDK
   docs/                    # Project documentation
   specifications/          # Feature specifications
   CLAUDE.md               # Project guide for AI assistants
   package.json            # Root package.json for workspace
   sst.config.ts           # SST infrastructure configuration
```

### Configuration Files
1. **`packages/dashboard/next.config.js`** - Next.js configuration
2. **`packages/dashboard/postcss.config.mjs`** - PostCSS with Tailwind v4
3. **`packages/dashboard/tailwind.config.js`** - Tailwind configuration (if needed)
4. **`packages/dashboard/drizzle.config.ts`** - Database configuration
5. **`packages/dashboard/tsconfig.json`** - TypeScript configuration
6. **`packages/dashboard/.eslintrc.json`** - ESLint configuration

### Key Implementation Steps
1. **Initialize Next.js Project**: Create Next.js 15 app with TypeScript and Tailwind
2. **Setup Bun Workspace**: Configure monorepo with Bun package manager
3. **Database Setup**: Install PostgreSQL, configure Drizzle ORM
4. **Authentication**: Install and configure Better Auth
5. **oRPC Integration**: Setup type-safe API layer
6. **UI Framework**: Configure Tailwind v4 with shadcn/ui and TweakCN
7. **Development Tools**: Setup ESLint, Prettier, and development scripts
8. **SST Configuration**: Basic AWS infrastructure setup

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mcplatform_dev
DATABASE_URL_PROD=postgresql://user:password@prod-host:5432/mcplatform

# Authentication
BETTER_AUTH_SECRET=your-random-secret-key
BETTER_AUTH_URL=http://localhost:3000

# OAuth Providers
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Infrastructure
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
```

## Open Questions & Risks

### Questions Needing Resolution
- **Package Management**: Confirm Bun compatibility with all required packages
- **Database Hosting**: Local PostgreSQL vs. Docker vs. cloud service for development
- **Authentication Providers**: Which OAuth providers to enable initially
- **Deployment Strategy**: SST configuration complexity and AWS resource costs

### Identified Risks
- **Bun Compatibility**: Some packages may not work with Bun runtime
- **Tailwind v4 Stability**: New version may have breaking changes or bugs
- **Better Auth Maturity**: Newer library with potential missing features
- **Learning Curve**: Team familiarity with oRPC and new tooling

### Mitigation Strategies
- **Fallback Plans**: Keep Node.js as backup runtime for development
- **Version Pinning**: Pin all dependencies to specific versions
- **Documentation**: Create comprehensive setup and troubleshooting guides
- **Gradual Adoption**: Implement incrementally with rollback options

## Next Steps
- **Package Installation**: Install all required dependencies with Bun
- **Database Setup**: Configure PostgreSQL locally or via Docker
- **Environment Configuration**: Set up all required environment variables
- **Development Server**: Verify hot reloading and type checking work correctly
- **Production Build**: Test production build and deployment process
- Ready for feature development once foundation is solid

## Installation Commands

### Quick Setup
```bash
# 1. Create Next.js project with Bun
bunx create-next-app@latest packages/dashboard --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# 2. Install core dependencies
cd packages/dashboard
bun add drizzle-orm postgres better-auth @orpc/next @orpc/server @orpc/client
bun add -D drizzle-kit @types/pg

# 3. Initialize shadcn/ui
bunx shadcn@latest init --css-variables

# 4. Setup database schema
bunx @better-auth/cli@latest generate
bunx drizzle-kit generate

# 5. Start development
bun dev
```

### Verification Commands
```bash
# Type checking
bun run type-check

# Linting
bun run lint

# Build test
bun run build

# Database migration
bunx drizzle-kit migrate
```

This comprehensive foundation setup ensures MCPlatform has a robust, modern, and scalable technical foundation for rapid feature development.