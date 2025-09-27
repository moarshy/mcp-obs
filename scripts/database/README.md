# 🗄️ Database Reset & Management Scripts

This directory contains scripts for managing the mcp-obs database, particularly for resetting and recreating the database during development.

## 🔥 Database Reset Process

When you need to completely reset your database (common during schema development), follow these steps:

### Quick Reset (All Steps)

```bash
# Navigate to project root
cd /Users/arshath/play/naptha/mcp-obs

# Step 1: Drop all tables
bun sst dev -- bun scripts/database/simple-reset.ts

# Step 2: Clear migration files
rm packages/database/migrations/*.sql
rm packages/database/migrations/meta/*_snapshot.json

# Step 3: Reset migration journal
echo '{"version":"7","dialect":"postgresql","entries":[]}' > packages/database/migrations/meta/_journal.json

# Step 4: Generate fresh migrations
bun sst dev -- bun run db:generate

# Step 5: Apply fresh migrations
bun sst dev -- bun run db:migrate

# Step 6: Create test data
bun sst dev -- bun scripts/database/create-test-data.ts
```

### Step-by-Step Explanation

#### 1. **Drop All Tables** 🗑️
```bash
bun sst dev -- bun scripts/database/simple-reset.ts
```
- Connects directly to the SST database
- Drops all existing tables with CASCADE
- Handles errors gracefully (tables that don't exist)
- Resets the `__drizzle_migrations` table

#### 2. **Clear Migration History** 🧹
```bash
rm packages/database/migrations/*.sql
rm packages/database/migrations/meta/*_snapshot.json
```
- Removes all generated migration SQL files
- Removes Drizzle snapshot files that track schema changes

#### 3. **Reset Migration Journal** 📝
```bash
echo '{"version":"7","dialect":"postgresql","entries":[]}' > packages/database/migrations/meta/_journal.json
```
- Resets Drizzle's migration tracking journal
- Sets up empty journal for fresh migration generation

#### 4. **Generate Fresh Migrations** ⚙️
```bash
bun sst dev -- bun run db:generate
```
- Analyzes your current schema files in `packages/database/src/`
- Generates new migration SQL based on your TypeScript schemas
- Creates migration files like `0000_something.sql`

#### 5. **Apply Fresh Migrations** 🚀
```bash
bun sst dev -- bun run db:migrate
```
- Executes the generated migration SQL against your database
- Creates all tables, indexes, and constraints
- Your database now matches your TypeScript schemas

#### 6. **Create Test Data** 🏗️
```bash
bun sst dev -- bun scripts/database/create-test-data.ts
```
- Creates a test organization
- Creates a test MCP server with slug "test" (for test.localhost:3000)
- Creates OAuth endpoint configurations
- Creates a test platform user
- Sets up data needed for OAuth testing

## 📋 What Gets Created

After running the complete reset process, you'll have:

### Database Schema
- ✅ `organization` - Platform organizations
- ✅ `user`, `session`, `account` - Platform auth (Better Auth)
- ✅ `member`, `invitation` - Organization management
- ✅ `mcp_server` - MCP server configurations ⚠️ **This was missing before!**
- ✅ `mcp_end_user` - Better Auth compatible MCP users
- ✅ `mcp_oauth_*` - OAuth flow tables (clients, tokens, codes, consent)
- ✅ `mcp_server_user` - Business logic user capture
- ✅ `mcp_server_session` - User-to-server links
- ✅ `mcp_tool_calls` - Analytics and usage tracking

### Test Data
- **Test Organization**: "Test Organization"
- **Test MCP Server**:
  - Name: "Test MCP Server"
  - Slug: "test" (accessible at test.localhost:3000)
  - Full OAuth endpoint configuration
- **Test Platform User**: test@example.com

## 🔗 OAuth Endpoints (After Reset)

Once the reset is complete, these endpoints will work:

- **Discovery**: `http://test.localhost:3000/.well-known/oauth-authorization-server`
- **Registration**: `http://test.localhost:3000/mcp-auth/oauth/register`
- **Authorization**: `http://test.localhost:3000/mcp-auth/oauth/authorize`
- **Token**: `http://test.localhost:3000/mcp-auth/oauth/token`
- **Login**: `http://test.localhost:3000/mcp-oidc/login`

## 🚨 When to Use Database Reset

Use database reset when:
- ✅ Schema changes cause migration conflicts
- ✅ You've dropped important tables accidentally (like `mcp_server`)
- ✅ Migration history is corrupted
- ✅ You want to start fresh with clean test data
- ✅ Database constraints are preventing migrations

## ⚠️ Important Notes

1. **SST Required**: All commands must be run with `bun sst dev --` prefix to use the SST database connection
2. **Development Only**: These scripts are for development databases only
3. **Data Loss**: Database reset completely destroys all existing data
4. **Test Data**: The test data script creates minimal data needed for OAuth testing
5. **Migration Order**: Always follow the exact step order for best results

## 🔧 Troubleshooting

### "Cannot find module" errors
Make sure you're running commands from the project root and using the `bun sst dev --` prefix.

### "Table already exists" errors
Run the reset script first to drop all tables before generating migrations.

### "No such file or directory" errors
Ensure the migrations directory structure exists:
```bash
mkdir -p packages/database/migrations/meta
```

### OAuth endpoints returning 500 errors
Make sure you've run the test data creation script after migrations to create the test MCP server.

## 📁 Files in this Directory

- `simple-reset.ts` - Main database reset script
- `create-test-data.ts` - Test data creation script
- `reset-database.sh` - Shell script version (deprecated, use TypeScript version)
- `README.md` - This documentation file

## 🎯 Next Steps After Reset

1. Verify your server is running: `bun dev`
2. Test OAuth discovery: Visit `http://test.localhost:3000/.well-known/oauth-authorization-server`
3. Test complete OAuth flow with Playwright or manual testing
4. Create additional test data as needed for your specific testing scenarios