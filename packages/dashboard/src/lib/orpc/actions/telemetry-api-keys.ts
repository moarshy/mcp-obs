'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '../../auth/session'
import { base } from '../router'
import { db, mcpServer, mcpServerApiKey, member } from 'database'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

const generateApiKeySchema = z.object({
  mcpServerId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
})

const revokeApiKeySchema = z.object({
  apiKeyId: z.string().uuid(),
})

const listApiKeysSchema = z.object({
  mcpServerId: z.string().uuid(),
})

// Generate API key with format: mcpobs_{env}_{random}
function generateApiKeyString(env: string = 'live'): string {
  const randomPart = randomBytes(16).toString('hex')
  return `mcpobs_${env}_${randomPart}`
}

export const generateApiKeyAction = base
  .input(generateApiKeySchema)
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

      if (userMemberships.length === 0) {
        throw errors.UNAUTHORIZED({ message: 'No organization membership found' })
      }

      const organizationId = userMemberships[0].organizationId

      // 3. Verify user has access to this MCP server
      const server = await db
        .select()
        .from(mcpServer)
        .where(and(
          eq(mcpServer.id, input.mcpServerId),
          eq(mcpServer.organizationId, organizationId)
        ))

      if (server.length === 0) {
        throw errors.RESOURCE_NOT_FOUND({ message: 'MCP server not found or access denied' })
      }

      // 4. Check if telemetry is enabled
      if (!server[0].telemetryEnabled) {
        throw errors.UNAUTHORIZED({ message: 'Telemetry must be enabled for this MCP server' })
      }

      // 5. Generate API key and hash it
      const plainApiKey = generateApiKeyString()
      const saltRounds = 12
      const apiKeyHash = await bcrypt.hash(plainApiKey, saltRounds)

      // 6. Insert API key record
      const result = await db.insert(mcpServerApiKey).values({
        mcpServerId: input.mcpServerId,
        organizationId: organizationId,
        apiKeyHash: apiKeyHash,
        name: input.name || 'Telemetry API Key',
      }).returning()

      // 7. Cache revalidation
      revalidatePath(`/dashboard/mcp-servers/${input.mcpServerId}/settings`)
      revalidatePath('/dashboard/mcp-servers')

      // 8. Return API key (show once only)
      return {
        id: result[0].id,
        name: result[0].name,
        apiKey: plainApiKey, // Only returned once
        createdAt: result[0].createdAt,
      }
    } catch (error) {
      console.error('Error generating API key:', error)
      throw errors.INTERNAL_SERVER_ERROR({ message: 'Failed to generate API key' })
    }
  })
  .actionable({})

export const revokeApiKeyAction = base
  .input(revokeApiKeySchema)
  .handler(async ({ input, errors }) => {
    const session = await requireSession()

    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: 'Authentication required' })
    }

    try {
      // Get user's organization
      const userMemberships = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, session.user.id))

      if (userMemberships.length === 0) {
        throw errors.UNAUTHORIZED({ message: 'No organization membership found' })
      }

      const organizationId = userMemberships[0].organizationId

      // Verify access to this API key
      const existingKey = await db
        .select()
        .from(mcpServerApiKey)
        .where(and(
          eq(mcpServerApiKey.id, input.apiKeyId),
          eq(mcpServerApiKey.organizationId, organizationId),
          isNull(mcpServerApiKey.revokedAt)
        ))

      if (existingKey.length === 0) {
        throw errors.RESOURCE_NOT_FOUND({ message: 'API key not found or already revoked' })
      }

      // Mark as revoked
      const result = await db
        .update(mcpServerApiKey)
        .set({
          revokedAt: new Date(),
        })
        .where(eq(mcpServerApiKey.id, input.apiKeyId))
        .returning()

      // Cache revalidation
      revalidatePath(`/dashboard/mcp-servers/${existingKey[0].mcpServerId}/settings`)
      revalidatePath('/dashboard/mcp-servers')

      return {
        success: true,
        revokedAt: result[0].revokedAt,
      }
    } catch (error) {
      console.error('Error revoking API key:', error)
      throw errors.INTERNAL_SERVER_ERROR({ message: 'Failed to revoke API key' })
    }
  })
  .actionable({})

export const listApiKeysAction = base
  .input(listApiKeysSchema)
  .handler(async ({ input, errors }) => {
    const session = await requireSession()

    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: 'Authentication required' })
    }

    try {
      // Get user's organization
      const userMemberships = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, session.user.id))

      if (userMemberships.length === 0) {
        throw errors.UNAUTHORIZED({ message: 'No organization membership found' })
      }

      const organizationId = userMemberships[0].organizationId

      // Verify access to MCP server
      const server = await db
        .select()
        .from(mcpServer)
        .where(and(
          eq(mcpServer.id, input.mcpServerId),
          eq(mcpServer.organizationId, organizationId)
        ))

      if (server.length === 0) {
        throw errors.RESOURCE_NOT_FOUND({ message: 'MCP server not found or access denied' })
      }

      // Get API keys for this server (exclude hash, never expose it)
      const keys = await db
        .select({
          id: mcpServerApiKey.id,
          name: mcpServerApiKey.name,
          lastUsedAt: mcpServerApiKey.lastUsedAt,
          createdAt: mcpServerApiKey.createdAt,
          revokedAt: mcpServerApiKey.revokedAt,
        })
        .from(mcpServerApiKey)
        .where(eq(mcpServerApiKey.mcpServerId, input.mcpServerId))
        .orderBy(desc(mcpServerApiKey.createdAt))

      return keys.map(key => ({
        ...key,
        status: key.revokedAt ? 'revoked' : 'active',
        // Security: Never expose the actual API key hash
        apiKeyPreview: key.revokedAt ? null : 'mcpobs_live_•••••••••••••••',
      }))
    } catch (error) {
      console.error('Error listing API keys:', error)
      throw errors.INTERNAL_SERVER_ERROR({ message: 'Failed to list API keys' })
    }
  })
  .actionable({})

// Utility function for SDK/internal use - validates API key during telemetry ingestion
export async function validateApiKeyForTelemetry(apiKeyString: string): Promise<{
  isValid: boolean
  organizationId?: string
  mcpServerId?: string
  mcpServerSlug?: string
} | null> {
  try {
    // Parse expected format: mcpobs_{env}_{random}
    if (!apiKeyString.startsWith('mcpobs_')) {
      return { isValid: false }
    }

    // Get all non-revoked API keys for comparison
    const activeKeys = await db
      .select({
        id: mcpServerApiKey.id,
        apiKeyHash: mcpServerApiKey.apiKeyHash,
        organizationId: mcpServerApiKey.organizationId,
        mcpServerId: mcpServerApiKey.mcpServerId,
        mcpServerSlug: mcpServer.slug,
        telemetryEnabled: mcpServer.telemetryEnabled,
      })
      .from(mcpServerApiKey)
      .innerJoin(mcpServer, eq(mcpServerApiKey.mcpServerId, mcpServer.id))
      .where(and(
        isNull(mcpServerApiKey.revokedAt),
        eq(mcpServer.telemetryEnabled, true)
      ))

    // Check each key until we find a match
    for (const key of activeKeys) {
      const isMatch = await bcrypt.compare(apiKeyString, key.apiKeyHash)
      if (isMatch) {
        // Update last used timestamp
        await db
          .update(mcpServerApiKey)
          .set({ lastUsedAt: new Date() })
          .where(eq(mcpServerApiKey.id, key.id))

        return {
          isValid: true,
          organizationId: key.organizationId,
          mcpServerId: key.mcpServerId,
          mcpServerSlug: key.mcpServerSlug,
        }
      }
    }

    return { isValid: false }
  } catch (error) {
    console.error('Error validating API key:', error)
    return { isValid: false }
  }
}