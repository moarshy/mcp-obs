import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

// Database connection utility
export function createConnection(connectionString: string) {
  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  })

  return drizzle(client, { schema })
}

// Default connection for development (will be overridden in production)
export const db = createConnection(
  process.env.DATABASE_URL || 'postgresql://localhost:5432/mcplatform_dev'
)