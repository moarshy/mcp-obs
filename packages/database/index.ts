import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Resource } from 'sst'
import * as authSchema from './src/auth-schema'
import * as mcpAuthSchema from './src/mcp-auth-schema'

export const schema = {
    ...authSchema,
    ...mcpAuthSchema
}

const pg = Resource.Postgres
const dbUrl = `postgresql://${pg.username}:${pg.password}@${pg.host}:${pg.port}/${pg.database}`
export const db = drizzle(dbUrl, {
    schema: schema
})
export * from './src/auth-schema'
export * from './src/mcp-auth-schema'