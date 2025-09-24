import { ORPCError, procedure, router } from '@orpc/server'
import { db } from 'database'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { z } from 'zod'

// Create base context with database access
export const createContext = async () => {
  const headerList = await headers()

  // Get session from Better Auth
  let session = null
  let user = null

  try {
    const sessionResult = await auth.api.getSession({
      headers: headerList
    })
    session = sessionResult?.session
    user = sessionResult?.user
  } catch (error) {
    // Session might not exist, which is fine for public procedures
    console.debug('No valid session found:', error)
  }

  return {
    db,
    session,
    user,
    headers: headerList,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

// Base procedure without authentication requirement
export const publicProcedure = procedure
  .use(async (ctx, meta, next) => {
    const context = await createContext()
    return next({ ctx: context })
  })

// Protected procedure that requires authentication
export const protectedProcedure = procedure
  .use(async (ctx, meta, next) => {
    const context = await createContext()

    if (!context.session || !context.user) {
      throw new ORPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      })
    }

    return next({ ctx: context })
  })

// Organization-scoped procedure that requires both auth and organization membership
export const orgProcedure = protectedProcedure
  .input(z.object({
    organizationId: z.string().uuid(),
  }))

export type PublicContext = Context
export type ProtectedContext = Context & { session: NonNullable<Context['session']>, user: NonNullable<Context['user']> }
export type OrgContext = ProtectedContext