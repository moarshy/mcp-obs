import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as authSchema from './src/auth-schema'
import * as mcpAuthSchema from './src/mcp-auth-schema'
import * as businessSchema from './src/schema'

export const schema = {
    ...authSchema,
    ...mcpAuthSchema,
    ...businessSchema
}

// MCPlatform pattern: Direct SST Resource access (no fallback)
// Must run under `sst dev` for Resources to be available
import { Resource } from 'sst'

const pg = Resource.Postgres
const dbUrl = `postgresql://${pg.username}:${pg.password}@${pg.host}:${pg.port}/${pg.database}`
export const db = drizzle(dbUrl, {
    schema: schema
})
export * from './src/auth-schema'
export * from './src/mcp-auth-schema'
export * from './src/schema'