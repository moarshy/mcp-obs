'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '../../auth/session'
import { auth } from '@/lib/auth'
import { base } from '../router'

const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
})

const inviteMemberSchema = z.object({
  organizationId: z.string(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
})

const updateMemberRoleSchema = z.object({
  organizationId: z.string(),
  userId: z.string(),
  role: z.enum(['owner', 'admin', 'member']),
})

export const createOrganizationAction = base
  .input(createOrganizationSchema)
  .handler(async ({ input, errors }) => {
    // 1. Authentication
    const session = await requireSession()

    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: 'Authentication required' })
    }

    try {
      // 3. Use Better Auth API to create organization
      const organization = await auth.api.createOrganization({
        name: input.name,
        slug: input.slug,
        userId: session.user.id,
      })

      // 4. Cache revalidation (CRITICAL)
      revalidatePath('/dashboard/onboarding')
      revalidatePath('/dashboard/organizations')
      revalidatePath('/dashboard')

      return organization
    } catch (error) {
      console.error('Error creating organization:', error)

      // Check for unique constraint violation on slug
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw errors.SUBDOMAIN_ALREADY_EXISTS({ message: 'Organization slug already exists' })
      }

      throw errors.RESOURCE_NOT_FOUND({ message: 'Failed to create organization' })
    }
  })
  .actionable({})

export const inviteMemberAction = base
  .input(inviteMemberSchema)
  .handler(async ({ input, errors }) => {
    const session = await requireSession()

    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: 'Authentication required' })
    }

    try {
      // Verify user has admin or owner role in the organization
      const membership = await auth.api.getFullOrganization({
        userId: session.user.id,
        organizationId: input.organizationId,
      })

      if (!membership || !['owner', 'admin'].includes(membership.member.role)) {
        throw errors.INSUFFICIENT_PERMISSIONS({
          message: 'You do not have permission to invite members to this organization'
        })
      }

      const invitation = await auth.api.inviteUser({
        email: input.email,
        organizationId: input.organizationId,
        role: input.role,
        invitedBy: session.user.id,
      })

      revalidatePath(`/dashboard/organizations/${input.organizationId}`)
      revalidatePath('/dashboard/organizations')

      return invitation
    } catch (error) {
      console.error('Error inviting member:', error)
      throw errors.RESOURCE_NOT_FOUND({
        message: error instanceof Error ? error.message : 'Failed to invite member'
      })
    }
  })
  .actionable({})

export const updateMemberRoleAction = base
  .input(updateMemberRoleSchema)
  .handler(async ({ input, errors }) => {
    const session = await requireSession()

    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: 'Authentication required' })
    }

    try {
      // Verify user has admin or owner role in the organization
      const membership = await auth.api.getFullOrganization({
        userId: session.user.id,
        organizationId: input.organizationId,
      })

      if (!membership || !['owner', 'admin'].includes(membership.member.role)) {
        throw errors.INSUFFICIENT_PERMISSIONS({
          message: 'You do not have permission to update member roles'
        })
      }

      // Update member role using Better Auth
      await auth.api.updateMember({
        organizationId: input.organizationId,
        userId: input.userId,
        role: input.role,
      })

      revalidatePath(`/dashboard/organizations/${input.organizationId}`)

      return { success: true }
    } catch (error) {
      console.error('Error updating member role:', error)
      throw errors.RESOURCE_NOT_FOUND({
        message: 'Failed to update member role'
      })
    }
  })
  .actionable({})

export const removeMemberAction = base
  .input(z.object({
    organizationId: z.string(),
    userId: z.string(),
  }))
  .handler(async ({ input, errors }) => {
    const session = await requireSession()

    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: 'Authentication required' })
    }

    try {
      // Verify user has admin or owner role in the organization
      const membership = await auth.api.getFullOrganization({
        userId: session.user.id,
        organizationId: input.organizationId,
      })

      if (!membership || !['owner', 'admin'].includes(membership.member.role)) {
        throw errors.INSUFFICIENT_PERMISSIONS({
          message: 'You do not have permission to remove members'
        })
      }

      // Remove member using Better Auth
      await auth.api.removeMember({
        organizationId: input.organizationId,
        userId: input.userId,
      })

      revalidatePath(`/dashboard/organizations/${input.organizationId}`)

      return { success: true }
    } catch (error) {
      console.error('Error removing member:', error)
      throw errors.RESOURCE_NOT_FOUND({
        message: 'Failed to remove member'
      })
    }
  })
  .actionable({})