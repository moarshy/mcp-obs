'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '../../auth/session'
import { base } from '../router'
import { db, supportTicket, mcpServer, member } from 'database'
import { eq, and, desc, count } from 'drizzle-orm'

const createSupportTicketSchema = z.object({
  mcpServerId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: z.string().default('Other'),
  mcpUserId: z.string().optional(),
  userEmail: z.string().email().optional(),
  sessionId: z.string().optional(),
  contextData: z.string().optional(),
  userAgent: z.string().optional(),
})

const updateSupportTicketStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['open', 'in_progress', 'closed']),
})

const getSupportTicketsSchema = z.object({
  status: z.enum(['open', 'in_progress', 'closed']).optional(),
  category: z.string().optional(),
  page: z.number().default(1),
  limit: z.number().default(20),
})

export const createSupportTicketAction = base
  .input(createSupportTicketSchema)
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

      // 3. Verify MCP server belongs to user's organization
      const mcpServerRecord = await db
        .select()
        .from(mcpServer)
        .where(and(
          eq(mcpServer.id, input.mcpServerId),
          eq(mcpServer.organizationId, organizationId)
        ))
        .then(rows => rows[0])

      if (!mcpServerRecord) {
        throw errors.RESOURCE_NOT_FOUND({ message: 'MCP server not found or access denied' })
      }

      // 4. Validate that either mcpUserId or userEmail is provided
      if (!input.mcpUserId && !input.userEmail) {
        throw errors.BAD_REQUEST({ message: 'Either mcpUserId or userEmail must be provided' })
      }

      // 5. Create support ticket
      const result = await db.insert(supportTicket).values({
        organizationId,
        mcpServerId: input.mcpServerId,
        title: input.title,
        description: input.description,
        category: input.category,
        mcpUserId: input.mcpUserId,
        userEmail: input.userEmail,
        sessionId: input.sessionId,
        contextData: input.contextData,
        userAgent: input.userAgent,
        status: 'open',
        priority: 'normal',
      }).returning()

      // 6. Cache revalidation
      revalidatePath('/dashboard/support-tickets')

      return result[0]
    } catch (error) {
      console.error('Error creating support ticket:', error)
      throw errors.INTERNAL_SERVER_ERROR({ message: 'Failed to create support ticket' })
    }
  })
  .actionable({})

export const updateSupportTicketStatusAction = base
  .input(updateSupportTicketStatusSchema)
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

      // 3. Verify ticket belongs to user's organization
      const existingTicket = await db
        .select()
        .from(supportTicket)
        .where(and(
          eq(supportTicket.id, input.id),
          eq(supportTicket.organizationId, organizationId)
        ))
        .then(rows => rows[0])

      if (!existingTicket) {
        throw errors.RESOURCE_NOT_FOUND({ message: 'Support ticket not found or access denied' })
      }

      // 4. Update ticket status
      const updateData: any = {
        status: input.status,
        updatedAt: new Date(),
      }

      // If closing the ticket, record who closed it and when
      if (input.status === 'closed' && existingTicket.status !== 'closed') {
        updateData.closedAt = new Date()
        updateData.closedBy = session.user.id
      }

      // If reopening a closed ticket, clear the closed metadata
      if (input.status !== 'closed' && existingTicket.closedAt) {
        updateData.closedAt = null
        updateData.closedBy = null
      }

      const result = await db
        .update(supportTicket)
        .set(updateData)
        .where(eq(supportTicket.id, input.id))
        .returning()

      // 5. Cache revalidation
      revalidatePath('/dashboard/support-tickets')
      revalidatePath(`/dashboard/support-tickets/${input.id}`)

      return result[0]
    } catch (error) {
      console.error('Error updating support ticket status:', error)
      throw errors.INTERNAL_SERVER_ERROR({ message: 'Failed to update support ticket status' })
    }
  })
  .actionable({})

export const getSupportTicketsAction = base
  .input(getSupportTicketsSchema)
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

      // 3. Build query conditions
      let whereConditions = [eq(supportTicket.organizationId, organizationId)]

      if (input.status) {
        whereConditions.push(eq(supportTicket.status, input.status))
      }

      if (input.category) {
        whereConditions.push(eq(supportTicket.category, input.category))
      }

      const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0]

      // 4. Get total count for pagination
      const totalCount = await db
        .select({ count: count() })
        .from(supportTicket)
        .where(whereClause)
        .then(rows => rows[0]?.count || 0)

      // 5. Get paginated tickets with MCP server information
      const offset = (input.page - 1) * input.limit

      const tickets = await db
        .select({
          id: supportTicket.id,
          title: supportTicket.title,
          description: supportTicket.description,
          category: supportTicket.category,
          status: supportTicket.status,
          priority: supportTicket.priority,
          mcpUserId: supportTicket.mcpUserId,
          userEmail: supportTicket.userEmail,
          sessionId: supportTicket.sessionId,
          contextData: supportTicket.contextData,
          userAgent: supportTicket.userAgent,
          createdAt: supportTicket.createdAt,
          updatedAt: supportTicket.updatedAt,
          closedAt: supportTicket.closedAt,
          closedBy: supportTicket.closedBy,
          // MCP Server info
          mcpServerName: mcpServer.name,
          mcpServerSlug: mcpServer.slug,
        })
        .from(supportTicket)
        .innerJoin(mcpServer, eq(supportTicket.mcpServerId, mcpServer.id))
        .where(whereClause)
        .orderBy(desc(supportTicket.createdAt))
        .limit(input.limit)
        .offset(offset)

      return {
        tickets,
        pagination: {
          page: input.page,
          limit: input.limit,
          total: totalCount,
          pages: Math.ceil(totalCount / input.limit)
        }
      }
    } catch (error) {
      console.error('Error fetching support tickets:', error)
      throw errors.INTERNAL_SERVER_ERROR({ message: 'Failed to fetch support tickets' })
    }
  })
  .actionable({})

export const getSupportTicketByIdAction = base
  .input(z.object({ id: z.string() }))
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

      // 3. Get ticket with MCP server information
      const ticket = await db
        .select({
          id: supportTicket.id,
          title: supportTicket.title,
          description: supportTicket.description,
          category: supportTicket.category,
          status: supportTicket.status,
          priority: supportTicket.priority,
          mcpUserId: supportTicket.mcpUserId,
          userEmail: supportTicket.userEmail,
          sessionId: supportTicket.sessionId,
          contextData: supportTicket.contextData,
          userAgent: supportTicket.userAgent,
          createdAt: supportTicket.createdAt,
          updatedAt: supportTicket.updatedAt,
          closedAt: supportTicket.closedAt,
          closedBy: supportTicket.closedBy,
          // MCP Server info
          mcpServerName: mcpServer.name,
          mcpServerSlug: mcpServer.slug,
          mcpServerId: mcpServer.id,
        })
        .from(supportTicket)
        .innerJoin(mcpServer, eq(supportTicket.mcpServerId, mcpServer.id))
        .where(and(
          eq(supportTicket.id, input.id),
          eq(supportTicket.organizationId, organizationId)
        ))
        .then(rows => rows[0])

      if (!ticket) {
        throw errors.RESOURCE_NOT_FOUND({ message: 'Support ticket not found or access denied' })
      }

      return ticket
    } catch (error) {
      console.error('Error fetching support ticket:', error)
      throw errors.INTERNAL_SERVER_ERROR({ message: 'Failed to fetch support ticket' })
    }
  })
  .actionable({})