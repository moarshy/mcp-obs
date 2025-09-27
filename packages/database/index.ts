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

// Re-export OAuth validation functions from dashboard package for server SDK usage
export {
  validateAccessToken,
  introspectToken,
  checkTokenScope,
  extractUserFromToken,
  generateWWWAuthenticateHeader,
  type TokenValidationResult,
  type TokenIntrospectionResponse
} from '../dashboard/src/lib/mcp-oauth/token-validation'

// Re-export MCP server utilities
export { getMcpServerBySlug } from '../dashboard/src/lib/mcp-server-utils'