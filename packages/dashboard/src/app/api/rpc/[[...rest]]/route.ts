import { appRouter } from '@/lib/orpc/router'
import { createORPCHandler } from '@orpc/next'
import { getServerSession } from '@/lib/auth'

// Create oRPC context
const createContext = async () => {
  try {
    const { user, session } = await getServerSession()
    return { user, session }
  } catch (error) {
    return { user: null, session: null }
  }
}

const handler = createORPCHandler({
  router: appRouter,
  createContext,
})

export { handler as GET, handler as POST }
export type AppRouter = typeof appRouter