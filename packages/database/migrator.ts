import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { Resource } from 'sst'

export const handler = async () => {
    // Get database URL from SST Resource
    const DATABASE_URL = Resource.Postgres.connectionString
    if (!DATABASE_URL) {
        throw new Error('Database connection string not available from SST Resource')
    }

    console.log('Starting database migration...')

    const client = postgres(DATABASE_URL, { max: 1 })
    const db = drizzle(client)

    try {
        await migrate(db, { migrationsFolder: './migrations' })
        console.log('✅ Database migration completed successfully')
        return { statusCode: 200, body: 'Migration completed' }
    } catch (error) {
        console.error('❌ Database migration failed:', error)
        throw error
    } finally {
        await client.end()
    }
}