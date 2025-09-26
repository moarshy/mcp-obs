# Database Management Guide

This guide covers how to manage database schema changes in the mcp-obs SST project.

## Overview

- **Database Package**: `packages/database/` - Contains all database schema definitions and migration tools
- **ORM**: Drizzle ORM with PostgreSQL
- **Infrastructure**: AWS RDS PostgreSQL managed by SST
- **Migration Strategy**: File-based migrations with automatic deployment

## Project Structure

```
packages/database/
├── src/
│   ├── auth-schema.ts          # Platform authentication tables
│   ├── mcp-auth-schema.ts      # MCP OAuth server tables
│   └── connection.ts           # Database connection utilities
├── migrations/                 # Generated migration files
│   ├── 0000_initial.sql
│   ├── 0001_add_mcp_tables.sql
│   └── meta/
│       └── _journal.json       # Migration tracking
├── drizzle.config.ts          # Drizzle configuration
├── migrator.ts                # SST Lambda migrator function
└── package.json               # Database package scripts
```

## Commands Reference

### 1. Schema Development

#### Generate Migrations (from project root)
```bash
# Method 1: Through SST (Recommended)
sst dev -- bun run db:generate

# Method 2: Direct command (requires SST to be running)
bun run db:generate
```

#### Apply Migrations
```bash
# Migrations are applied automatically by SST on deployment
# Manual application (if needed):
sst dev -- bun run db:migrate
```

#### Database Studio (GUI)
```bash
# Start Drizzle Studio for database inspection
bun run studio
```

#### Push Schema (Development only)
```bash
# Push schema directly without migrations (use carefully)
sst dev -- cd packages/database && bun run db:push
```

### 2. Package-level Commands (from packages/database/)

```bash
bun run db:generate     # Generate migration files
bun run db:migrate      # Apply migrations
bun run db:push         # Push schema directly
bun run db:studio       # Open Drizzle Studio
bun run db:pull         # Pull schema from database
bun run db:introspect   # Introspect existing database
```

## Workflow for Schema Changes

### Step 1: Modify Schema Files

Edit the schema files in `packages/database/src/`:

```typescript
// Example: Adding a new field to mcp-auth-schema.ts
export const mcpServer = pgTable('mcp_server', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  // Add new field:
  description: text('description'),
  // ... other fields
})
```

### Step 2: Generate Migration

```bash
# Make sure SST is running first
bun run dev

# In another terminal:
bun run db:generate
```

This creates:
- New migration file: `packages/database/migrations/XXXX_description.sql`
- Updates `meta/_journal.json` with migration entry

### Step 3: Review Migration

Check the generated SQL in `packages/database/migrations/`:

```sql
-- Example migration file
ALTER TABLE "mcp_server" ADD COLUMN "description" text;
```

### Step 4: Deploy Changes

Migrations are applied automatically when you deploy:

```bash
# Redeploy to apply migrations
# SST will automatically run the DatabaseMigrator function
```

Or manually trigger deployment:
```bash
# If SST is running, it should pick up changes automatically
# Otherwise, restart SST dev
```

## SST Database Configuration

### Infrastructure Setup (sst.config.ts)

```typescript
// PostgreSQL database
const postgres = new sst.aws.Postgres(`Postgres`, {
    vpc,
    database: 'mcp_obs',
    proxy: false
})

// Database migrator function
const migrator = new sst.aws.Function('DatabaseMigrator', {
    link: [postgres],
    vpc,
    handler: 'packages/database/migrator.handler',
    copyFiles: [
        {
            from: 'packages/database/migrations',
            to: 'migrations'
        }
    ],
    environment: {
        DATABASE_URL: $interpolate`postgres://${postgres.username}:${urlEncodedPostgresPassword}@${postgres.host}:${postgres.port}/${postgres.database}`
    }
})

// Automatic migration execution
new aws.lambda.Invocation('DatabaseMigratorInvocation', {
    input: Date.now().toString(),
    functionName: migrator.name
})
```

### Database Connection (packages/database/index.ts)

```typescript
import { Resource } from 'sst'
import { drizzle } from 'drizzle-orm/node-postgres'

const pg = Resource.Postgres
const dbUrl = `postgresql://${pg.username}:${pg.password}@${pg.host}:${pg.port}/${pg.database}`

export const db = drizzle(dbUrl, { schema })
```

## Common Scenarios

### 1. Adding a New Table

1. **Define schema** in `packages/database/src/mcp-auth-schema.ts`:
```typescript
export const newTable = pgTable('new_table', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

2. **Export schema** in the same file:
```typescript
// At the bottom of the file
export { newTable }
```

3. **Generate migration**:
```bash
bun run db:generate
```

### 2. Adding a Column

1. **Modify existing table** in schema file:
```typescript
export const mcpServer = pgTable('mcp_server', {
  // existing fields...
  newField: text('new_field'), // Add this line
})
```

2. **Generate migration**:
```bash
bun run db:generate
```

### 3. Renaming/Dropping Columns

⚠️ **Warning**: Be careful with destructive changes in production!

1. **Modify schema** (remove or rename field)
2. **Generate migration**:
```bash
bun run db:generate
```
3. **Review generated SQL** carefully before deploying

### 4. Database Reset (Development only)

If you need to completely reset the database:

```bash
# Remove SST stack (deletes database)
sst remove

# Clear migrations
rm -rf packages/database/migrations/*

# Recreate migrations
bun run db:generate

# Deploy fresh
bun run dev
```

## Troubleshooting

### Migration Failures

**Error**: `Can't find meta/_journal.json file`
```bash
# Create journal manually
mkdir -p packages/database/migrations/meta
echo '{"version":"7","dialect":"postgresql","entries":[]}' > packages/database/migrations/meta/_journal.json
```

**Error**: `Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"`
- Database user lacks permissions
- Try using `db:push` instead of migrations for development

**Error**: `ENOTFOUND` database host
- SST resources not available
- Make sure `sst dev` is running
- Run commands through `sst dev -- command`

### Schema Sync Issues

**Schema doesn't match migrations**:
```bash
# Reset and regenerate (development only)
rm -rf packages/database/migrations/*
bun run db:generate
```

**Database out of sync**:
```bash
# Use push to force sync (development only)
sst dev -- cd packages/database && bun run db:push
```

## Best Practices

### 1. Schema Design
- Use descriptive table and column names
- Always add `createdAt` and `updatedAt` timestamps
- Use UUIDs for primary keys where appropriate
- Add proper foreign key constraints

### 2. Migration Safety
- Always review generated migrations before applying
- Test migrations on development environment first
- Backup production database before major schema changes
- Use feature flags for gradual rollouts

### 3. Development Workflow
- Keep schema files organized and well-documented
- Use descriptive migration names
- Never edit applied migration files
- Always generate migrations for schema changes

### 4. Production Considerations
- Schedule migrations during low-traffic periods
- Monitor migration execution in AWS Lambda logs
- Have rollback plan for failed migrations
- Use database replicas for zero-downtime migrations

## Environment Variables

Required environment variables in `.env`:

```bash
# Local development (optional)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mcp_obs

# SST automatically provides these in deployed environment:
# - Database connection details via Resource.Postgres
# - SSL configuration for production
```

## Monitoring and Logs

### Migration Logs
Check SST console or AWS CloudWatch for migration logs:
```
DatabaseMigrator function logs show migration progress
```

### Database Studio
Access Drizzle Studio for database inspection:
```bash
bun run studio
```

### AWS Console
Monitor RDS metrics and logs in AWS Console for production issues.

---

## Quick Reference

| Task | Command |
|------|---------|
| Add table/column | Edit schema → `bun run db:generate` |
| View database | `bun run studio` |
| Apply migrations | Automatic on deploy |
| Reset database | `sst remove` → `bun run dev` |
| Fix sync issues | `sst dev -- cd packages/database && bun run db:push` |
| Check logs | SST Console → DatabaseMigrator function |