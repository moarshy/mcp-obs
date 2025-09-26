// This file is server-only and should not be imported in client components
import 'server-only'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

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
    session,
    user,
    headers: headerList,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

// Simplified procedure implementations without oRPC library issues
export const publicProcedure = {
  query: (handler: (params: { ctx: Context }) => any) => ({
    execute: async () => {
      const ctx = await createContext()
      return handler({ ctx })
    }
  }),
  mutation: (handler: (params: { ctx: Context, input?: any }) => any) => ({
    execute: async (input?: any) => {
      const ctx = await createContext()
      return handler({ ctx, input })
    }
  }),
  input: (schema: any) => ({
    query: (handler: (params: { ctx: Context, input: any }) => any) => ({
      execute: async (input: any) => {
        const ctx = await createContext()
        return handler({ ctx, input })
      }
    }),
    mutation: (handler: (params: { ctx: Context, input: any }) => any) => ({
      execute: async (input: any) => {
        const ctx = await createContext()
        return handler({ ctx, input })
      }
    })
  })
}

export const protectedProcedure = {
  query: (handler: (params: { ctx: Context & { user: NonNullable<Context['user']>, session: NonNullable<Context['session']> } }) => any) => ({
    execute: async () => {
      const ctx = await createContext()
      if (!ctx.session || !ctx.user) {
        throw new Error('Authentication required')
      }
      return handler({ ctx: { ...ctx, user: ctx.user, session: ctx.session } })
    }
  }),
  mutation: (handler: (params: { ctx: Context & { user: NonNullable<Context['user']>, session: NonNullable<Context['session']> }, input?: any }) => any) => ({
    execute: async (input?: any) => {
      const ctx = await createContext()
      if (!ctx.session || !ctx.user) {
        throw new Error('Authentication required')
      }
      return handler({ ctx: { ...ctx, user: ctx.user, session: ctx.session }, input })
    }
  }),
  input: (schema: any) => ({
    query: (handler: (params: { ctx: Context & { user: NonNullable<Context['user']>, session: NonNullable<Context['session']> }, input: any }) => any) => ({
      execute: async (input: any) => {
        const ctx = await createContext()
        if (!ctx.session || !ctx.user) {
          throw new Error('Authentication required')
        }
        return handler({ ctx: { ...ctx, user: ctx.user, session: ctx.session }, input })
      }
    }),
    mutation: (handler: (params: { ctx: Context & { user: NonNullable<Context['user']>, session: NonNullable<Context['session']> }, input: any }) => any) => ({
      execute: async (input: any) => {
        const ctx = await createContext()
        if (!ctx.session || !ctx.user) {
          throw new Error('Authentication required')
        }
        return handler({ ctx: { ...ctx, user: ctx.user, session: ctx.session }, input })
      }
    })
  })
}

// Simple server instance for backward compatibility
export const orpcServer = {
  createContext,
}