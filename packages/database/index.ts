import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Resource } from 'sst'
import * as schema from './src/schema'

const pg = Resource.Postgres
const dbUrl = `postgresql://${pg.username}:${pg.password}@${pg.host}:${pg.port}/${pg.database}`

export const db = drizzle(dbUrl, {
    schema: schema
})

// Re-export schema and types
export * from './src/schema'
export type { InferInsertModel, InferSelectModel } from 'drizzle-orm'