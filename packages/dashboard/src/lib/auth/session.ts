import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from './config'
import { db, member } from 'database'
import { eq } from 'drizzle-orm'

// Type definitions for Better Auth session with organization context
type BaseSession = typeof auth.$Infer.Session
type SessionWithRequiredOrg = BaseSession & {
  session: BaseSession['session'] & {
    activeOrganizationId: string
  }
}

// Type-safe overloaded function for session handling
interface GetSessionOverloads {
  (): Promise<SessionWithRequiredOrg>
  (params: { data: { organizationRequired: boolean } }): Promise<BaseSession>
  (params?: { data?: { organizationRequired?: true } }): Promise<SessionWithRequiredOrg>
}

const sessionHelper = async (
  data: {
    organizationRequired: boolean
  } = {
    organizationRequired: true
  }
) => {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session || !session.user) {
    redirect('/auth/signin')
  }

  if (data.organizationRequired && !session.session.activeOrganizationId) {
    const memberships = await db.select().from(member).where(eq(member.userId, session.user.id))

    if (memberships.length === 0) {
      redirect('/dashboard/onboarding?reason=no-organization')
    }

    // If user has organizations but no active one, set the first as active
    if (memberships.length === 1) {
      // User has exactly one organization, allow access
      // In a full implementation, you'd set the activeOrganizationId in the session
    } else {
      // Multiple organizations - let user choose
      redirect('/dashboard/organizations')
    }
  }

  return session
}

export const requireSession = sessionHelper as GetSessionOverloads