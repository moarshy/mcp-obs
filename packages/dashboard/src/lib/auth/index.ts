// Re-export auth configuration and utilities
export * from './config'
export * from './types'
export { auth } from './config'

// Server-side utilities (only import on server)
export * from './server'

// Note: Client utilities should be imported directly from './client'
// to avoid server/client boundary issues