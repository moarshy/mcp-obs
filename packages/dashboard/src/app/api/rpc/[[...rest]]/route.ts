import { createORPCHandler } from '@orpc/next'
import { appRouter } from '@/lib/orpc'

const handler = createORPCHandler({
  router: appRouter,
})

export const { GET, POST } = handler
export type AppRouter = typeof appRouter