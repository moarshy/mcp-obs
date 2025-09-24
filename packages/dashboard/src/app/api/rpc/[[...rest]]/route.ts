import { createNextHandler } from '@orpc/next'
import { appRouter } from '@/lib/orpc'

const handler = createNextHandler({
  router: appRouter,
})

export const { GET, POST } = handler
export type AppRouter = typeof appRouter