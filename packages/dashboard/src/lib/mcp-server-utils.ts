import { db } from 'database'
import { mcpServer } from 'database'
import { eq } from 'drizzle-orm'

// Reserved subdomains that cannot be used for MCP servers
const RESERVED_SLUGS = [
  'www', 'api', 'admin', 'docs', 'status', 'blog', 'mail', 'ftp',
  'mx', 'ns1', 'ns2', 'test', 'dev', 'staging', 'prod', 'app',
  'dashboard', 'console', 'panel', 'support', 'help', 'cdn',
  'assets', 'static', 'media', 'files', 'download', 'upload',
  'auth', 'oauth', 'login', 'logout', 'register', 'signup',
  'well-known', 'mcp', 'client', 'server'
]

export async function validateMcpServerSlug(
  slug: string,
  excludeServerId?: string
): Promise<{ available: boolean; message: string }> {
  // Basic validation
  if (!slug || slug.length < 2) {
    return { available: false, message: 'Slug must be at least 2 characters long' }
  }

  if (slug.length > 50) {
    return { available: false, message: 'Slug must be 50 characters or less' }
  }

  // Format validation
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  if (!slugRegex.test(slug)) {
    return {
      available: false,
      message: 'Slug must contain only lowercase letters, numbers, and hyphens (no consecutive hyphens or leading/trailing hyphens)'
    }
  }

  // Reserved slug check
  if (RESERVED_SLUGS.includes(slug)) {
    return { available: false, message: 'This slug is reserved and cannot be used' }
  }

  // Database uniqueness check
  const existingServer = await db
    .select({ id: mcpServer.id })
    .from(mcpServer)
    .where(eq(mcpServer.slug, slug))
    .limit(1)

  if (existingServer.length > 0 && existingServer[0].id !== excludeServerId) {
    return { available: false, message: 'This slug is already taken' }
  }

  return { available: true, message: 'Slug is available' }
}

export async function generateSuggestedSlug(baseName: string): Promise<string[]> {
  const baseSlug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30) // Leave room for suffix

  const suggestions: string[] = []

  // Try base slug first
  const baseValidation = await validateMcpServerSlug(baseSlug)
  if (baseValidation.valid) {
    suggestions.push(baseSlug)
  }

  // Generate numbered variations
  for (let i = 2; i <= 10; i++) {
    const numberedSlug = `${baseSlug}-${i}`
    const validation = await validateMcpServerSlug(numberedSlug)
    if (validation.valid) {
      suggestions.push(numberedSlug)
    }
  }

  // Generate abbreviated variations
  if (baseSlug.length > 10) {
    const abbreviated = baseSlug.substring(0, 10)
    for (let i = 1; i <= 5; i++) {
      const abbreviatedSlug = `${abbreviated}-${i}`
      const validation = await validateMcpServerSlug(abbreviatedSlug)
      if (validation.valid) {
        suggestions.push(abbreviatedSlug)
      }
    }
  }

  return suggestions.slice(0, 5) // Return top 5 suggestions
}

export async function getMcpServerBySlug(slug: string) {
  const server = await db
    .select()
    .from(mcpServer)
    .where(eq(mcpServer.slug, slug))
    .limit(1)

  return server[0] || null
}

export async function getMcpServerByPort(port: number) {
  // For development port-based routing, we could map ports to slugs
  // This is a placeholder - actual implementation would depend on dev setup
  const devSlugMapping: Record<number, string> = {
    3001: 'dev1',
    3002: 'dev2',
    3003: 'dev3',
  }

  const slug = devSlugMapping[port]
  if (!slug) return null

  return getMcpServerBySlug(slug)
}

export function generateMcpServerEndpoints(slug: string, baseUrl?: string) {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const base = baseUrl || (isDevelopment ? 'http://localhost:3000' : 'https://mcp-obs.com')

  const issuerUrl = isDevelopment
    ? `${base}?mcp_server=${slug}`
    : `https://${slug}.mcp-obs.com`

  return {
    issuerUrl,
    authorizationEndpoint: `${issuerUrl}/oauth/authorize`,
    tokenEndpoint: `${issuerUrl}/oauth/token`,
    registrationEndpoint: `${issuerUrl}/oauth/register`,
    introspectionEndpoint: `${issuerUrl}/oauth/introspect`,
    revocationEndpoint: `${issuerUrl}/oauth/revoke`,
  }
}