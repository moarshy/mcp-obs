import { appRouter } from '@/lib/orpc'
import { NextRequest } from 'next/server'

async function handler(request: NextRequest) {
  try {
    const { pathname, searchParams } = new URL(request.url)
    const path = pathname.replace('/api/rpc', '') || '/'

    // Extract procedure path from URL
    const segments = path.split('/').filter(Boolean)
    const method = request.method.toLowerCase()

    // For now, return a simple response to fix compilation
    // TODO: Implement proper oRPC handler when we have correct imports
    return Response.json({
      error: 'oRPC handler not implemented yet',
      path: segments,
      method
    }, { status: 501 })
  } catch (error) {
    return Response.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export { handler as GET, handler as POST }
export type AppRouter = typeof appRouter