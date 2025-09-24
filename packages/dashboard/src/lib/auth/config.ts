import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  db,
  user,
  session,
  account,
  verification,
  invitation,
  member,
  organization as organizationTable,
  oauthApplication,
  oauthAccessToken,
  oauthConsent
} from 'database'
import { eq } from 'drizzle-orm'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      session,
      account,
      verification,
      invitation,
      member,
      organization: organizationTable,
      oauthApplication,
      oauthAccessToken,
      oauthConsent
    }
  }),
  plugins: [
    organization({
      async sendInvitationEmail(data) {
        // For now, we'll use shareable links instead of sending emails
        // This will be implemented when we create the invitation system
        console.log('Invitation email would be sent to:', data.email)
      },
      organizationLimit: 10, // Max organizations per user
      memberLimit: 100, // Max members per organization
    })
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disabled for development as specified
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
})

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

export type Session = typeof auth.$Infer.Session