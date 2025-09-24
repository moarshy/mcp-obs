import { drizzle } from 'drizzle-orm/node-postgres'
import * as authSchema from './src/auth-schema'
import { Resource } from 'sst'

export const schema = {
    ...authSchema,
}

const pg = Resource.Postgres
const dbUrl = `postgresql://${pg.username}:${pg.password}@${pg.host}:${pg.port}/${pg.database}`
export const db = drizzle(dbUrl, {
    schema: schema
})
export * from './src/auth-schema'
