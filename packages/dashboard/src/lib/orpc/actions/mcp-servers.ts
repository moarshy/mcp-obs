'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '../../auth/session'
import { base } from '../router'
import { db, mcpServer, organization, member } from 'database'
import { eq, and } from 'drizzle-orm'

const createMcpServerSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  platformAuthEnabled: z.boolean().default(true),
  supportToolEnabled: z.boolean().default(false),
  supportToolTitle: z.string().optional(),
  supportToolDescription: z.string().optional(),
  supportToolCategories: z.string().optional(),
  telemetryEnabled: z.boolean().default(false),
})

const updateMcpServerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  description: z.string().optional(),
  platformAuthEnabled: z.boolean().optional(),
  telemetryEnabled: z.boolean().optional(),
})

const validateSlugSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
})


export const createMcpServerAction = base
  .input(createMcpServerSchema)
  .handler(async ({ input, errors }) => {
    // 1. Authentication
    const session = await requireSession()

    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: 'Authentication required' })
    }

    try {
      // 2. Get user's organization through membership
      const userMemberships = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, session.user.id))

      let organizationId: string

      if (userMemberships.length === 0) {
        // Create a new organization for the user
        const newOrg = await db.insert(organization).values({
          id: `org-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: `${session.user.name || session.user.email}'s Organization`,
          slug: `org-${session.user.id?.slice(-8) || Date.now()}`,
          createdAt: new Date(),
          metadata: JSON.stringify({ createdBy: session.user.id })
        }).returning()

        organizationId = newOrg[0].id

        // Add user as a member of the new organization
        await db.insert(member).values({
          id: `member-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          organizationId,
          userId: session.user.id,
          role: 'admin',
          createdAt: new Date()
        })
      } else {
        // Use the first organization
        organizationId = userMemberships[0].organizationId
      }

      // 3. Create MCP server with real database insert
      const issuerUrl = process.env.NODE_ENV === 'development'
        ? `http://${input.slug}.localhost:3000`
        : `https://${input.slug}.mcp-obs.com`

      const result = await db.insert(mcpServer).values({
        name: input.name,
        slug: input.slug,
        description: input.description,
        organizationId,
        issuerUrl,
        authorizationEndpoint: `${issuerUrl}/mcp-auth/oauth/authorize`,
        tokenEndpoint: `${issuerUrl}/mcp-auth/oauth/token`,
        registrationEndpoint: `${issuerUrl}/mcp-auth/oauth/register`,
        introspectionEndpoint: `${issuerUrl}/mcp-auth/oauth/introspect`,
        revocationEndpoint: `${issuerUrl}/mcp-auth/oauth/revoke`,
        // Default to sensible auth settings
        enabled: input.platformAuthEnabled,
        allowRegistration: input.platformAuthEnabled, // Only allow registration if auth is enabled
        requireEmailVerification: false, // Keep it simple by default
        enablePasswordAuth: input.platformAuthEnabled, // Enable if auth is on
        enableGoogleAuth: input.platformAuthEnabled, // Enable all social providers by default
        enableGithubAuth: input.platformAuthEnabled,
        // Support tool configuration
        supportToolEnabled: input.supportToolEnabled,
        supportToolTitle: input.supportToolTitle || 'Get Support',
        supportToolDescription: input.supportToolDescription || 'Report issues or ask questions',
        supportToolCategories: input.supportToolCategories || '["Bug Report", "Feature Request", "Documentation", "Other"]',
        // Telemetry configuration
        telemetryEnabled: input.telemetryEnabled,
      }).returning()

      const createdServer = result[0]

      // 5. Cache revalidation (CRITICAL)
      revalidatePath('/dashboard/mcp-servers')

      return createdServer
    } catch (error) {
      console.error('Error creating MCP server:', error)

      // Check for unique constraint violation
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw errors.SUBDOMAIN_ALREADY_EXISTS({ message: 'MCP server slug already exists' })
      }

      throw errors.RESOURCE_NOT_FOUND({ message: 'Failed to create MCP server' })
    }
  })
  .actionable({})

export const updateMcpServerAction = base
  .input(updateMcpServerSchema)
  .handler(async ({ input, errors }) => {
    const session = await requireSession()

    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: 'Authentication required' })
    }

    try {
      // Get user's organization through membership
      const userMemberships = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, session.user.id))

      if (userMemberships.length === 0) {
        throw errors.UNAUTHORIZED({ message: 'No organization membership found' })
      }

      const organizationId = userMemberships[0].organizationId

      const existingServer = await db
        .select()
        .from(mcpServer)
        .where(and(
          eq(mcpServer.id, input.id),
          eq(mcpServer.organizationId, organizationId)
        ))
        .then(rows => rows[0])

      if (!existingServer) {
        throw errors.RESOURCE_NOT_FOUND({ message: 'MCP server not found' })
      }

      // Update with only provided fields
      const updateData = Object.fromEntries(
        Object.entries(input).filter(([key, value]) => value !== undefined && key !== 'id' && key !== 'platformAuthEnabled')
      )

      // Handle platformAuthEnabled conversion to individual auth settings
      if (input.platformAuthEnabled !== undefined) {
        updateData.enabled = input.platformAuthEnabled
        updateData.allowRegistration = input.platformAuthEnabled
        updateData.requireEmailVerification = false // Keep simple
        updateData.enablePasswordAuth = input.platformAuthEnabled
        updateData.enableGoogleAuth = input.platformAuthEnabled
        updateData.enableGithubAuth = input.platformAuthEnabled
      }

      // If slug is being updated, regenerate all OAuth endpoints
      if (input.slug && input.slug !== existingServer.slug) {
        const issuerUrl = process.env.NODE_ENV === 'development'
          ? `http://${input.slug}.localhost:3000`
          : `https://${input.slug}.mcp-obs.com`
        updateData.issuerUrl = issuerUrl
        updateData.authorizationEndpoint = `${issuerUrl}/mcp-auth/oauth/authorize`
        updateData.tokenEndpoint = `${issuerUrl}/mcp-auth/oauth/token`
        updateData.registrationEndpoint = `${issuerUrl}/mcp-auth/oauth/register`
        updateData.introspectionEndpoint = `${issuerUrl}/mcp-auth/oauth/introspect`
        updateData.revocationEndpoint = `${issuerUrl}/mcp-auth/oauth/revoke`
      }

      const result = await db
        .update(mcpServer)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(mcpServer.id, input.id))
        .returning()

      revalidatePath('/dashboard/mcp-servers')
      revalidatePath(`/dashboard/mcp-servers/${input.id}`)

      return result[0]
    } catch (error) {
      console.error('Error updating MCP server:', error)
      throw errors.RESOURCE_NOT_FOUND({ message: 'Failed to update MCP server' })
    }
  })
  .actionable({})

export const deleteMcpServerAction = base
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, errors }) => {
    const session = await requireSession()

    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: 'Authentication required' })
    }

    try {
      // Get user's organization through membership
      const userMemberships = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, session.user.id))

      if (userMemberships.length === 0) {
        throw errors.UNAUTHORIZED({ message: 'No organization membership found' })
      }

      const organizationId = userMemberships[0].organizationId

      // Verify the server belongs to user's organization before deleting
      const existingServer = await db
        .select()
        .from(mcpServer)
        .where(and(
          eq(mcpServer.id, input.id),
          eq(mcpServer.organizationId, organizationId)
        ))
        .then(rows => rows[0])

      if (!existingServer) {
        throw errors.RESOURCE_NOT_FOUND({ message: 'MCP server not found' })
      }

      // Delete the server (cascading deletes will handle related records)
      await db.delete(mcpServer).where(eq(mcpServer.id, input.id))

      revalidatePath('/dashboard/mcp-servers')

      return { success: true }
    } catch (error) {
      console.error('Error deleting MCP server:', error)
      throw errors.RESOURCE_NOT_FOUND({ message: 'Failed to delete MCP server' })
    }
  })
  .actionable({})

export const validateSlugAction = base
  .input(validateSlugSchema)
  .handler(async ({ input, errors }) => {
    try {
      // Check if slug is already taken globally (across all organizations)
      const existingServer = await db
        .select({ id: mcpServer.id })
        .from(mcpServer)
        .where(eq(mcpServer.slug, input.slug))
        .then(rows => rows[0])

      if (existingServer) {
        return {
          available: false,
          message: 'This subdomain is already taken. Please choose a different one.'
        }
      }

      // Check if slug contains reserved words
      const reservedSlugs = ['www', 'api', 'admin', 'dashboard', 'app', 'mail', 'ftp', 'blog', 'help', 'support']
      if (reservedSlugs.includes(input.slug.toLowerCase())) {
        return {
          available: false,
          message: 'This subdomain is reserved. Please choose a different one.'
        }
      }

      return {
        available: true,
        message: 'This subdomain is available!'
      }
    } catch (error) {
      console.error('Error validating slug:', error)
      return {
        available: false,
        message: 'Error checking slug availability. Please try again.'
      }
    }
  })
  .actionable({})