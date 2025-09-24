import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import {
  db,
  mcpServer,
  mcpEndUser,
  mcpOauthClient,
  mcpOauthToken,
  mcpOauthConsent,
} from 'database'
import { createMCPDrizzleAdapter } from './adapter'

// Create MCP-specific OAuth server configuration
export function createMCPAuth(serverId: string, organizationId: string) {
  return betterAuth({
    // Use custom MCP adapter instead of standard drizzle adapter
    database: createMCPDrizzleAdapter(serverId),

    // Base URL will be set by the subdomain routing
    baseURL: process.env.NODE_ENV === 'development'
      ? `http://localhost:3000?mcp_server=${serverId}`
      : undefined, // Will be determined by subdomain

    // End-user authentication providers
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      },
    },

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
    },

    // Advanced configuration for OAuth-specific features will be handled
    // through custom endpoints and middleware rather than built-in Better Auth plugins
    advanced: {
      // Custom token generation
      generateId: () => crypto.randomUUID(),

      // Cross-origin configuration for MCP clients
      crossSubDomainCookies: {
        enabled: false, // Each MCP server has its own domain
      }
    }
  })
}

// Type definitions for MCP auth
export type MCPAuthInstance = ReturnType<typeof createMCPAuth>
export type MCPSession = MCPAuthInstance['$Infer']['Session']
export type MCPUser = MCPAuthInstance['$Infer']['User']