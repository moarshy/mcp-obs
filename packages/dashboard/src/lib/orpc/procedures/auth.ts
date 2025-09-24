import { z } from 'zod'
import { router } from '@orpc/server'
import { protectedProcedure, publicProcedure } from '../server'
import { auth } from '@/lib/auth'
import { ORPCError } from '@orpc/server'

// Organization creation schema
const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
})

// Organization switching schema
const switchOrganizationSchema = z.object({
  organizationSlug: z.string(),
})

// Team invitation schema
const inviteMemberSchema = z.object({
  organizationId: z.string(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
})

export const authProcedures = router({
  // Get current user with organizations
  getMe: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const organizations = await auth.api.listUserOrganizations({
          userId: ctx.user.id,
        })

        return {
          user: ctx.user,
          organizations: organizations || [],
        }
      } catch (error) {
        console.error('Error fetching user organizations:', error)
        return {
          user: ctx.user,
          organizations: [],
        }
      }
    }),

  // Create new organization
  createOrganization: protectedProcedure
    .input(createOrganizationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const organization = await auth.api.createOrganization({
          name: input.name,
          slug: input.slug,
          userId: ctx.user.id,
        })

        return organization
      } catch (error) {
        console.error('Error creating organization:', error)
        throw new ORPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to create organization',
        })
      }
    }),

  // Get organization details
  getOrganization: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        // First check if user has access to this organization
        const membership = await auth.api.getUserOrganization({
          userId: ctx.user.id,
          organizationSlug: input.slug,
        })

        if (!membership) {
          throw new ORPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this organization',
          })
        }

        return membership
      } catch (error) {
        console.error('Error fetching organization:', error)
        throw new ORPCError({
          code: 'NOT_FOUND',
          message: 'Organization not found or access denied',
        })
      }
    }),

  // Invite member to organization
  inviteMember: protectedProcedure
    .input(inviteMemberSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify user has admin or owner role in the organization
        const membership = await auth.api.getUserOrganization({
          userId: ctx.user.id,
          organizationId: input.organizationId,
        })

        if (!membership || !['owner', 'admin'].includes(membership.member.role)) {
          throw new ORPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to invite members to this organization',
          })
        }

        const invitation = await auth.api.inviteUser({
          email: input.email,
          organizationId: input.organizationId,
          role: input.role,
          invitedBy: ctx.user.id,
        })

        return invitation
      } catch (error) {
        console.error('Error inviting member:', error)
        throw new ORPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to invite member',
        })
      }
    }),

  // List organization members
  getOrganizationMembers: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        // Verify user has access to this organization
        const membership = await auth.api.getUserOrganization({
          userId: ctx.user.id,
          organizationId: input.organizationId,
        })

        if (!membership) {
          throw new ORPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this organization',
          })
        }

        const members = await auth.api.getOrganizationMembers({
          organizationId: input.organizationId,
        })

        return members || []
      } catch (error) {
        console.error('Error fetching organization members:', error)
        throw new ORPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to fetch organization members',
        })
      }
    }),
})