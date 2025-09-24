'use client'

import { auth } from './config'

// Client-side auth utilities
export const authClient = auth.createClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:3000',
})

// Client-side auth hooks and utilities
export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient

// Helper function to get current user on client
export const getCurrentUser = () => {
  const session = useSession()
  return session.data?.user || null
}

// Helper function to check if user is authenticated
export const useAuth = () => {
  const session = useSession()
  return {
    user: session.data?.user || null,
    isLoading: session.isPending,
    isAuthenticated: !!session.data?.user,
    session: session.data?.session || null,
  }
}