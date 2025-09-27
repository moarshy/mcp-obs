#!/usr/bin/env bun

/**
 * Simple Database Reset Script
 *
 * This script directly uses the database connection to reset everything
 * Usage: bun sst dev -- bun scripts/database/simple-reset.ts
 */

async function resetDatabase() {
  try {
    console.log('🔥 Starting database reset...')

    // Import database connection
    const { db } = await import('database')

    console.log('📝 Step 1: Dropping all tables...')

    // Drop all tables with CASCADE
    const dropStatements = [
      'DROP TABLE IF EXISTS "walkthrough_progress" CASCADE',
      'DROP TABLE IF EXISTS "mcp_tool_calls" CASCADE',
      'DROP TABLE IF EXISTS "upstream_oauth_tokens" CASCADE',
      'DROP TABLE IF EXISTS "mcp_server_session" CASCADE',
      'DROP TABLE IF EXISTS "mcp_server_user" CASCADE',
      'DROP TABLE IF EXISTS "mcp_oauth_code" CASCADE',
      'DROP TABLE IF EXISTS "mcp_oauth_consent" CASCADE',
      'DROP TABLE IF EXISTS "mcp_oauth_token" CASCADE',
      'DROP TABLE IF EXISTS "mcp_oauth_client" CASCADE',
      'DROP TABLE IF EXISTS "mcp_end_user" CASCADE',
      'DROP TABLE IF EXISTS "verification" CASCADE',
      'DROP TABLE IF EXISTS "session" CASCADE',
      'DROP TABLE IF EXISTS "member" CASCADE',
      'DROP TABLE IF EXISTS "invitation" CASCADE',
      'DROP TABLE IF EXISTS "account" CASCADE',
      'DROP TABLE IF EXISTS "user" CASCADE',
      'DROP TABLE IF EXISTS "oauth_consent" CASCADE',
      'DROP TABLE IF EXISTS "oauth_application" CASCADE',
      'DROP TABLE IF EXISTS "oauth_access_token" CASCADE',
      'DROP TABLE IF EXISTS "organization" CASCADE',
      'DROP TABLE IF EXISTS "mcp_server" CASCADE',
      'DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE',
      'DROP TABLE IF EXISTS "mcp_account" CASCADE',
      'DROP TABLE IF EXISTS "mcp_session" CASCADE',
      'DROP TABLE IF EXISTS "mcp_verification" CASCADE',

    ]

    // Execute each drop statement
    for (const statement of dropStatements) {
      try {
        await db.execute(statement as any)
        console.log(`✅ ${statement}`)
      } catch (error: any) {
        console.log(`⚠️  ${statement} - ${error.message}`)
      }
    }

    console.log('✅ All tables dropped')

    console.log('')
    console.log('🎉 Database reset complete!')
    console.log('💡 Run the migration commands to recreate tables:')
    console.log('')
    console.log('1. Clear migration history manually:')
    console.log('   rm packages/database/migrations/*.sql')
    console.log('   rm packages/database/migrations/meta/*_snapshot.json')
    console.log('')
    console.log('2. Reset migration journal:')
    console.log('   echo \'{"version":"7","dialect":"postgresql","entries":[]}\' > packages/database/migrations/meta/_journal.json')
    console.log('')
    console.log('3. Generate and run fresh migrations:')
    console.log('   bun sst dev -- bun run db:generate')
    console.log('   bun sst dev -- bun run db:migrate')
    console.log('')
    console.log('4. Create test data:')
    console.log('   bun sst dev -- bun scripts/database/create-test-data.ts')

  } catch (error) {
    console.error('❌ Database reset failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

// Run the script
resetDatabase()