// Re-export auth configuration and utilities (client-safe)
export * from './config'
export * from './types'
export { auth } from './config'

// NOTE: Server-side utilities are NOT exported from this index
// Import them directly from their specific modules:
// - import { requireSession } from '@/lib/auth/session'
// - import { getServerSession, requireAuth, getUserOrganizations } from '@/lib/auth/server'
//
// This prevents "next/headers" imports from being included in non-server contexts

// Note: Client utilities should be imported directly from './client'
// to avoid server/client boundary issues