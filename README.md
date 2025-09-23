# MCPlatform

Observability and management platform for MCP (Model Context Protocol) servers.

## Project Structure

This is a Bun monorepo with the following packages:

```
mcp-obs/
├── packages/
│   ├── dashboard/           # Next.js 15 dashboard application
│   ├── database/            # Shared database schemas and utilities
│   ├── server-sdk/          # MCPlatform Server SDK
│   └── client-sdk/          # MCPlatform Client SDK
├── docs/                    # Project documentation
├── specifications/          # Feature specifications
└── sst.config.ts           # AWS infrastructure configuration
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0
- [Node.js](https://nodejs.org/) >= 18.0.0
- [PostgreSQL](https://postgresql.org/) >= 16.0

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd mcp-obs
   bun install
   ```

2. **Set up environment variables:**
   ```bash
   cd packages/dashboard
   cp .env.example .env.local
   # Edit .env.local with your database URL and other settings
   ```

3. **Set up PostgreSQL database:**
   ```bash
   # Create database
   createdb mcplatform_dev

   # Run migrations (after setting DATABASE_URL)
   bun run db:generate
   bun run db:migrate
   ```

4. **Start development server:**
   ```bash
   bun dev
   ```

The dashboard will be available at http://localhost:3000

## Development Commands

### Root Level Commands
```bash
# Start development server
bun dev

# Build all packages
bun run build

# Run linting
bun run lint

# Run type checking across all packages
bun run type-check

# Clean build artifacts
bun run clean
```

### Database Commands
```bash
# Generate database migrations
bun run db:generate

# Apply database migrations
bun run db:migrate
```

### Deployment Commands
```bash
# Deploy to AWS (requires AWS credentials)
bun run deploy

# Remove AWS resources
bun run deploy:remove
```

## Package Details

### Dashboard (`packages/dashboard`)
- **Framework:** Next.js 15 with App Router
- **Styling:** Tailwind CSS v4
- **Database:** Drizzle ORM with PostgreSQL
- **Port:** 3000 (development)

### Database (`packages/database`)
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL
- **Exports:** Schema definitions and database utilities

### Server SDK (`packages/server-sdk`)
- **Purpose:** SDK for MCP servers to integrate with MCPlatform
- **Exports:** `MCPlatformSDK` class and related types

### Client SDK (`packages/client-sdk`)
- **Purpose:** SDK for frontend applications
- **Exports:** `MCPlatformClient` class and related types

## AWS Deployment

This project uses [SST](https://sst.dev/) for AWS infrastructure:

1. **Configure AWS credentials:**
   ```bash
   aws configure
   ```

2. **Deploy to development:**
   ```bash
   bun run deploy
   ```

3. **Deploy to production:**
   ```bash
   bun run deploy --stage production
   ```

## Environment Variables

Key environment variables (see `packages/dashboard/.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Authentication secret key
- `AWS_REGION` - AWS deployment region

## Tech Stack

- **Runtime:** Bun
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL with Drizzle ORM
- **Styling:** Tailwind CSS v4
- **Infrastructure:** AWS via SST
- **Authentication:** Better Auth (to be configured)
- **API:** oRPC (to be configured)

## Development Workflow

1. **Feature Development:** Work in feature branches
2. **Type Safety:** All code must pass TypeScript strict mode
3. **Linting:** Code must pass ESLint checks
4. **Testing:** Manual testing in development environment
5. **Deployment:** Use SST for AWS deployment

## Project Status

This is the **foundation scaffolding** for MCPlatform. The basic structure is complete and ready for feature development.

### ✅ Completed
- [x] Monorepo structure with Bun workspace
- [x] Next.js 15 dashboard with App Router
- [x] Database package with Drizzle ORM
- [x] SDK packages (server and client)
- [x] SST configuration for AWS deployment
- [x] Development tooling (TypeScript, ESLint, build scripts)

### 🚧 Next Steps
- [ ] Implement authentication system (Better Auth)
- [ ] Add oRPC for type-safe APIs
- [ ] Create UI components with shadcn/ui
- [ ] Implement business features per specifications
- [ ] Add comprehensive testing
- [ ] Set up CI/CD pipeline

## Documentation

- [Project Guide](./CLAUDE.md) - Comprehensive development guide
- [Product Requirements](./docs/0.prd.md) - Business requirements and specifications
- [Implementation Plan](./specifications/0.%20project-setup/implementation-plan.md) - Technical implementation strategy

## Support

For questions or issues:
1. Check the [CLAUDE.md](./CLAUDE.md) project guide
2. Review the specifications in `specifications/`
3. Create an issue in the repository