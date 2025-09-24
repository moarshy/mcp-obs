import { z } from 'zod'
import { os } from '@orpc/server'
import { protectedProcedure } from '../server'
import { ORPCError } from '@orpc/server'
import { db, mcpServer, organization, member } from 'database'
import { eq, and } from 'drizzle-orm'
import { validateMcpServerSlug, generateSuggestedSlug, generateMcpServerEndpoints } from '../../mcp-server-utils'

// MCP Server creation schema
const createMcpServerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').max(50, 'Slug must be 50 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  organizationId: z.string().uuid('Organization ID must be a valid UUID'),

  // Server configuration
  enabled: z.boolean().optional().default(true),
  allowRegistration: z.boolean().optional().default(true),
  requireEmailVerification: z.boolean().optional().default(false),

  // Authentication methods
  enablePasswordAuth: z.boolean().optional().default(true),
  enableGoogleAuth: z.boolean().optional().default(true),
  enableGithubAuth: z.boolean().optional().default(true),

  // OAuth Configuration (optional overrides)
  accessTokenExpiration: z.number().int().min(300).max(86400).optional(), // 5 minutes to 24 hours
  refreshTokenExpiration: z.number().int().min(3600).max(2592000).optional(), // 1 hour to 30 days
  scopesSupported: z.string().optional(),
})

// MCP Server update schema
const updateMcpServerSchema = z.object({
  id: z.string().uuid('Server ID must be a valid UUID'),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(2).max(50).optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  accessTokenExpiration: z.number().int().min(300).max(86400).optional(),
  refreshTokenExpiration: z.number().int().min(3600).max(2592000).optional(),
  scopesSupported: z.string().optional(),
})

// Helper function to check organization membership
async function checkOrganizationAccess(userId: string, organizationId: string, requiredRole?: string[]) {
  const membership = await db
    .select({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      member: {
        role: member.role,
      }
    })
    .from(organization)
    .innerJoin(member, eq(member.organizationId, organization.id))
    .where(and(
      eq(organization.id, organizationId),
      eq(member.userId, userId)
    ))
    .limit(1)

  const membershipData = membership[0]

  if (!membershipData) {
    return { hasAccess: false, membership: null }
  }

  if (requiredRole && !requiredRole.includes(membershipData.member.role)) {
    return { hasAccess: false, membership: membershipData }
  }

  return { hasAccess: true, membership: membershipData }
}

export const mcpProcedures = os({
  // Create new MCP server
  createMcpServer: protectedProcedure
    .input(createMcpServerSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Check if user has admin access to organization
        const { hasAccess } = await checkOrganizationAccess(ctx.user.id, input.organizationId, ['admin', 'owner'])

        if (!hasAccess) {
          throw new ORPCError({
            code: 403,
            message: 'You do not have permission to create MCP servers in this organization',
          })
        }

        // Validate slug
        const slugValidation = await validateMcpServerSlug(input.slug)
        if (!slugValidation.available) {
          throw new ORPCError({
            code: 400,
            message: slugValidation.message,
          })
        }

        // Generate OAuth endpoints
        const endpoints = generateMcpServerEndpoints(input.slug)

        // Create MCP server
        const newServer = await db.insert(mcpServer).values({
          name: input.name,
          slug: input.slug,
          description: input.description,
          organizationId: input.organizationId,
          issuerUrl: endpoints.issuerUrl,
          authorizationEndpoint: endpoints.authorizationEndpoint,
          tokenEndpoint: endpoints.tokenEndpoint,
          registrationEndpoint: endpoints.registrationEndpoint,
          introspectionEndpoint: endpoints.introspectionEndpoint,
          revocationEndpoint: endpoints.revocationEndpoint,
          accessTokenExpiration: input.accessTokenExpiration || 7200,
          refreshTokenExpiration: input.refreshTokenExpiration || 604800,
          scopesSupported: input.scopesSupported || 'read,write',
          enabled: input.enabled ?? true,
          allowRegistration: input.allowRegistration ?? true,
          requireEmailVerification: input.requireEmailVerification ?? false,
          enablePasswordAuth: input.enablePasswordAuth ?? true,
          enableGoogleAuth: input.enableGoogleAuth ?? true,
          enableGithubAuth: input.enableGithubAuth ?? true,
        }).returning()

        return newServer[0]
      } catch (error) {
        console.error('Error creating MCP server:', error)

        if (error instanceof ORPCError) {
          throw error
        }

        throw new ORPCError({
          code: 500,
          message: error instanceof Error ? error.message : 'Failed to create MCP server',
        })
      }
    }),

  // Get MCP server by ID
  getMcpServer: protectedProcedure
    .input(z.object({
      id: z.string().uuid('Server ID must be a valid UUID')
    }))
    .query(async ({ input, ctx }) => {
      try {
        const serverData = await db
          .select({
            server: mcpServer,
            organization: {
              id: organization.id,
              name: organization.name,
              slug: organization.slug,
            }
          })
          .from(mcpServer)
          .innerJoin(organization, eq(organization.id, mcpServer.organizationId))
          .where(eq(mcpServer.id, input.id))
          .limit(1)

        const server = serverData[0]

        if (!server) {
          throw new ORPCError({
            code: 404,
            message: 'MCP server not found',
          })
        }

        // Check if user has access to this organization
        const { hasAccess } = await checkOrganizationAccess(ctx.user.id, server.server.organizationId)

        if (!hasAccess) {
          throw new ORPCError({
            code: 403,
            message: 'You do not have access to this MCP server',
          })
        }

        return {
          ...server.server,
          organization: server.organization,
        }
      } catch (error) {
        console.error('Error fetching MCP server:', error)

        if (error instanceof ORPCError) {
          throw error
        }

        throw new ORPCError({
          code: 500,
          message: 'Failed to fetch MCP server',
        })
      }
    }),

  // List MCP servers for organization
  listMcpServers: protectedProcedure
    .input(z.object({
      organizationId: z.string().uuid('Organization ID must be a valid UUID'),
      limit: z.number().int().min(1).max(100).optional().default(50),
      offset: z.number().int().min(0).optional().default(0),
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Check if user has access to this organization
        const { hasAccess } = await checkOrganizationAccess(ctx.user.id, input.organizationId)

        if (!hasAccess) {
          throw new ORPCError({
            code: 403,
            message: 'You do not have access to this organization',
          })
        }

        const servers = await db
          .select()
          .from(mcpServer)
          .where(eq(mcpServer.organizationId, input.organizationId))
          .limit(input.limit)
          .offset(input.offset)
          .orderBy(mcpServer.createdAt)

        return servers
      } catch (error) {
        console.error('Error listing MCP servers:', error)

        if (error instanceof ORPCError) {
          throw error
        }

        throw new ORPCError({
          code: 500,
          message: 'Failed to list MCP servers',
        })
      }
    }),

  // Update MCP server
  updateMcpServer: protectedProcedure
    .input(updateMcpServerSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // First get the server to check organization
        const existingServer = await db
          .select()
          .from(mcpServer)
          .where(eq(mcpServer.id, input.id))
          .limit(1)

        const server = existingServer[0]

        if (!server) {
          throw new ORPCError({
            code: 404,
            message: 'MCP server not found',
          })
        }

        // Check if user has admin access to organization
        const { hasAccess } = await checkOrganizationAccess(ctx.user.id, server.organizationId, ['admin', 'owner'])

        if (!hasAccess) {
          throw new ORPCError({
            code: 403,
            message: 'You do not have permission to update this MCP server',
          })
        }

        // If updating slug, validate it
        if (input.slug && input.slug !== server.slug) {
          const slugValidation = await validateMcpServerSlug(input.slug, input.id)
          if (!slugValidation.available) {
            throw new ORPCError({
              code: 400,
              message: slugValidation.message,
            })
          }
        }

        // Prepare update data
        const updateData: any = {
          updatedAt: new Date(),
        }

        if (input.name) updateData.name = input.name
        if (input.description !== undefined) updateData.description = input.description
        if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl
        if (input.accessTokenExpiration) updateData.accessTokenExpiration = input.accessTokenExpiration
        if (input.refreshTokenExpiration) updateData.refreshTokenExpiration = input.refreshTokenExpiration
        if (input.scopesSupported) updateData.scopesSupported = input.scopesSupported

        // If slug is changing, update all OAuth endpoints
        if (input.slug && input.slug !== server.slug) {
          updateData.slug = input.slug
          const endpoints = generateMcpServerEndpoints(input.slug)
          updateData.issuerUrl = endpoints.issuerUrl
          updateData.authorizationEndpoint = endpoints.authorizationEndpoint
          updateData.tokenEndpoint = endpoints.tokenEndpoint
          updateData.registrationEndpoint = endpoints.registrationEndpoint
          updateData.introspectionEndpoint = endpoints.introspectionEndpoint
          updateData.revocationEndpoint = endpoints.revocationEndpoint
        }

        // Update server
        const updatedServer = await db
          .update(mcpServer)
          .set(updateData)
          .where(eq(mcpServer.id, input.id))
          .returning()

        return updatedServer[0]
      } catch (error) {
        console.error('Error updating MCP server:', error)

        if (error instanceof ORPCError) {
          throw error
        }

        throw new ORPCError({
          code: 500,
          message: error instanceof Error ? error.message : 'Failed to update MCP server',
        })
      }
    }),

  // Delete MCP server
  deleteMcpServer: protectedProcedure
    .input(z.object({
      id: z.string().uuid('Server ID must be a valid UUID')
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // First get the server to check organization
        const existingServer = await db
          .select()
          .from(mcpServer)
          .where(eq(mcpServer.id, input.id))
          .limit(1)

        const server = existingServer[0]

        if (!server) {
          throw new ORPCError({
            code: 404,
            message: 'MCP server not found',
          })
        }

        // Check if user has admin access to organization
        const { hasAccess } = await checkOrganizationAccess(ctx.user.id, server.organizationId, ['admin', 'owner'])

        if (!hasAccess) {
          throw new ORPCError({
            code: 403,
            message: 'You do not have permission to delete this MCP server',
          })
        }

        // Delete server (cascade deletes will handle related records)
        await db
          .delete(mcpServer)
          .where(eq(mcpServer.id, input.id))

        return { success: true, message: 'MCP server deleted successfully' }
      } catch (error) {
        console.error('Error deleting MCP server:', error)

        if (error instanceof ORPCError) {
          throw error
        }

        throw new ORPCError({
          code: 500,
          message: error instanceof Error ? error.message : 'Failed to delete MCP server',
        })
      }
    }),

  // Validate slug availability
  validateSlug: protectedProcedure
    .input(z.object({
      slug: z.string().min(2).max(50),
      excludeServerId: z.string().uuid().optional(),
    }))
    .query(async ({ input }) => {
      const validation = await validateMcpServerSlug(input.slug, input.excludeServerId)
      return {
        available: validation.available,
        message: validation.message
      }
    }),

  // Generate slug suggestions
  generateSlugSuggestions: protectedProcedure
    .input(z.object({
      baseName: z.string().min(1).max(100),
    }))
    .query(async ({ input }) => {
      const suggestions = await generateSuggestedSlug(input.baseName)
      return { suggestions }
    }),
})