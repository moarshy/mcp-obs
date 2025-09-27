import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db, mcpEndUser } from 'database'

// Create MCP-specific Better Auth instance using our existing schema
export function createMCPAuth(serverId: string, organizationId: string) {
  return betterAuth({
    // Use drizzle adapter with our existing MCP schema
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        // Map Better Auth expected table names to our existing tables
        user: mcpEndUser,
        // Better Auth will auto-create session and account tables if needed
      },
    }),

    // Base URL will be set dynamically
    baseURL: process.env.NODE_ENV === 'development'
      ? `http://localhost:3000/mcp-oidc/auth`
      : undefined,

    // End-user authentication providers
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: false, // Disable for now
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        enabled: !!process.env.GOOGLE_CLIENT_ID,
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        enabled: !!process.env.GITHUB_CLIENT_ID,
      },
    },

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
    },

    // Store MCP context for use in session and callbacks
    plugins: [
      {
        id: 'mcp-context',
        init() {
          return {
            mcpServerId: serverId,
            organizationId: organizationId,
          }
        }
      }
    ],

    // Advanced configuration
    advanced: {
      generateId: () => crypto.randomUUID(),
      crossSubDomainCookies: {
        enabled: false,
      }
    }
  })
}

// Type definitions for MCP auth
export type MCPAuthInstance = ReturnType<typeof createMCPAuth>
export type MCPSession = MCPAuthInstance['$Infer']['Session']
export type MCPUser = MCPAuthInstance['$Infer']['User']