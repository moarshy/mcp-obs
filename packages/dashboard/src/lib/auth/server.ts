import { auth } from './config'
import { headers } from 'next/headers'

// Server-side auth utilities
export const getServerSession = async () => {
  const headersList = await headers()

  try {
    const session = await auth.api.getSession({
      headers: headersList
    })

    return {
      user: session?.user || null,
      session: session?.session || null,
    }
  } catch (error) {
    console.error('Error getting server session:', error)
    return {
      user: null,
      session: null,
    }
  }
}

// Check if user is authenticated on server
export const requireAuth = async () => {
  const { user, session } = await getServerSession()

  if (!user || !session) {
    throw new Error('Authentication required')
  }

  return { user, session }
}

// Get user organizations on server
export const getUserOrganizations = async (userId: string) => {
  try {
    const organizations = await auth.api.listOrganizations({
      userId,
    })

    return organizations || []
  } catch (error) {
    console.error('Error fetching user organizations:', error)
    return []
  }
}

// Check user organization membership
export const checkOrganizationMembership = async (userId: string, organizationSlug: string) => {
  try {
    const membership = await auth.api.getFullOrganization({
      userId,
      organizationSlug,
    })

    return membership
  } catch (error) {
    console.error('Error checking organization membership:', error)
    return null
  }
}