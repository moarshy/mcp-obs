import { os } from '@orpc/server'

// Base router with error definitions (following MCPlatform pattern)
export const base = os.errors({
  UNAUTHORIZED: {},
  RESOURCE_NOT_FOUND: {},
  INVALID_SUBDOMAIN: {},
  SUBDOMAIN_ALREADY_EXISTS: {},
  ORGANIZATION_NOT_FOUND: {},
  INSUFFICIENT_PERMISSIONS: {},
  BAD_REQUEST: {},
  INTERNAL_SERVER_ERROR: {},
})