import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
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

export type Session = typeof auth.$Infer.Session