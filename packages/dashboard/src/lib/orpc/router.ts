import { os } from '@orpc/server'
import { authProcedures } from './procedures/auth'

// Create main router with all procedures
export const appRouter = os({
  auth: authProcedures,
})

export type AppRouter = typeof appRouter