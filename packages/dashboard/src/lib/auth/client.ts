'use client'

// Re-export from client-config to maintain compatibility
export {
  authClient,
  signIn,
  signUp,
  signOut,
  useSession,
  getCurrentUser,
  useAuth,
} from './client-config'