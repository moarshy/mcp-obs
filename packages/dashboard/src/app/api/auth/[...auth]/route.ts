import { auth } from '@/lib/auth'

// For Better Auth, the handler is a function that needs to be called with Request and returns Response
async function handler(request: Request) {
  return auth.handler(request)
}

export { handler as GET, handler as POST }