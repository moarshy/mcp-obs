import { os } from '@orpc/server'
import { authProcedures } from './procedures/auth'
import { mcpProcedures } from './procedures/mcp'

// Create main router with all procedures
export const appRouter = os({
  auth: authProcedures,
  mcp: mcpProcedures,
})

export type AppRouter = typeof appRouter