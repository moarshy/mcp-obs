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
  allowRegistration: z.boolean().default(true),
  requireEmailVerification: z.boolean().default(false),
  enablePasswordAuth: z.boolean().default(true),
  enableGoogleAuth: z.boolean().default(false),
  enableGithubAuth: z.boolean().default(false),
})

const updateMcpServerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  description: z.string().optional(),
  allowRegistration: z.boolean().optional(),
  requireEmailVerification: z.boolean().optional(),
  enablePasswordAuth: z.boolean().optional(),
  enableGoogleAuth: z.boolean().optional(),
  enableGithubAuth: z.boolean().optional(),
  enabled: z.boolean().optional(),
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
      // 2. Get user's active organization
      const userMemberships = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, session.user.id))

      if (userMemberships.length === 0) {
        throw errors.UNAUTHORIZED({ message: 'No organization membership found' })
      }

      // Use the first organization for now (in real app, you'd use activeOrganizationId from session)
      const organizationId = userMemberships[0].organizationId

      // 3. Create MCP server with real database insert
      const issuerUrl = process.env.NODE_ENV === 'development'
        ? `http://localhost:3000`
        : `https://${input.slug}.mcp-obs.com`

      const result = await db.insert(mcpServer).values({
        name: input.name,
        slug: input.slug,
        description: input.description,
        organizationId,
        issuerUrl,
        authorizationEndpoint: `${issuerUrl}/oauth/authorize`,
        tokenEndpoint: `${issuerUrl}/oauth/token`,
        registrationEndpoint: `${issuerUrl}/oauth/register`,
        introspectionEndpoint: `${issuerUrl}/oauth/introspect`,
        revocationEndpoint: `${issuerUrl}/oauth/revoke`,
        allowRegistration: input.allowRegistration,
        requireEmailVerification: input.requireEmailVerification,
        enablePasswordAuth: input.enablePasswordAuth,
        enableGoogleAuth: input.enableGoogleAuth,
        enableGithubAuth: input.enableGithubAuth,
      }).returning()

      // 4. Cache revalidation (CRITICAL)
      revalidatePath('/dashboard/mcp-servers')

      return result[0]
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
      // Verify the server belongs to user's organization
      const userMemberships = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, session.user.id))

      const organizationIds = userMemberships.map(m => m.organizationId)

      const existingServer = await db
        .select()
        .from(mcpServer)
        .where(and(
          eq(mcpServer.id, input.id),
          // TODO: Add proper organization check once we have activeOrganizationId
        ))
        .then(rows => rows[0])

      if (!existingServer) {
        throw errors.RESOURCE_NOT_FOUND({ message: 'MCP server not found' })
      }

      // Update with only provided fields
      const updateData = Object.fromEntries(
        Object.entries(input).filter(([key, value]) => value !== undefined && key !== 'id')
      )

      // If slug is being updated, regenerate all OAuth endpoints
      if (input.slug && input.slug !== existingServer.slug) {
        const issuerUrl = `https://${input.slug}.mcp-obs.com`
        updateData.issuerUrl = issuerUrl
        updateData.authorizationEndpoint = `${issuerUrl}/oauth/authorize`
        updateData.tokenEndpoint = `${issuerUrl}/oauth/token`
        updateData.registrationEndpoint = `${issuerUrl}/oauth/register`
        updateData.introspectionEndpoint = `${issuerUrl}/oauth/introspect`
        updateData.revocationEndpoint = `${issuerUrl}/oauth/revoke`
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
      // Verify the server belongs to user's organization before deleting
      const existingServer = await db
        .select()
        .from(mcpServer)
        .where(eq(mcpServer.id, input.id))
        .then(rows => rows[0])

      if (!existingServer) {
        throw errors.RESOURCE_NOT_FOUND({ message: 'MCP server not found' })
      }

      // Check user has access to this organization
      const userMembership = await db
        .select()
        .from(member)
        .where(and(
          eq(member.userId, session.user.id),
          eq(member.organizationId, existingServer.organizationId)
        ))
        .then(rows => rows[0])

      if (!userMembership) {
        throw errors.INSUFFICIENT_PERMISSIONS({ message: 'Access denied' })
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