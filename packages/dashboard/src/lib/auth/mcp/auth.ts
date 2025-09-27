import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import {
  db,
  mcpEndUser,
  mcpSession,
  mcpAccount,
  mcpVerification,
  mcpOauthClient,
  mcpOauthToken,
  mcpOauthCode,
  mcpOauthConsent
} from 'database'

// Create MCP-specific Better Auth instance using our existing schema
export function createMCPAuth(serverId: string, organizationId: string) {
  return betterAuth({
    basePath: '/mcp-oidc/auth',

    // Use drizzle adapter with our existing MCP schema
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        // Core Better Auth tables (MCPlatform pattern)
        user: mcpEndUser,
        session: mcpSession,
        account: mcpAccount,
        verification: mcpVerification,
        // OAuth-specific tables (MCPlatform pattern)
        oauthApplication: mcpOauthClient,
        oauthAccessToken: mcpOauthToken,
        oauthCode: mcpOauthCode,
        oauthConsent: mcpOauthConsent,
      },
    }),

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
      database: {
        generateId: () => crypto.randomUUID(),
      },
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