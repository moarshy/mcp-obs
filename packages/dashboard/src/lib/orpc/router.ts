import { router } from '@orpc/server/router'
import { authProcedures } from './procedures/auth'

// Create main router with all procedures
export const appRouter = router({
  auth: authProcedures,
})

export type AppRouter = typeof appRouter