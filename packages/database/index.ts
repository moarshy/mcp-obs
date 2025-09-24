import { drizzle } from 'drizzle-orm/node-postgres'
import * as authSchema from './src/auth-schema'

export const schema = {
    ...authSchema,
}

let dbUrl: string

try {
    // Try to use SST Resource if available
    const { Resource } = await import('sst')
    const pg = Resource.Postgres
    dbUrl = `postgresql://${pg.username}:${pg.password}@${pg.host}:${pg.port}/${pg.database}`
} catch (error) {
    // Fallback to environment variable for local development
    dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mcp_obs'
    console.log('Using local database configuration:', dbUrl.replace(/:[^:@]*@/, ':***@'))
}

export const db = drizzle(dbUrl, {
    schema: schema
})
export * from './src/auth-schema'
