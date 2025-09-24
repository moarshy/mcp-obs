import { OnboardingClient } from './onboarding-client'
import { requireSession } from '@/lib/auth'

export const metadata = {
  title: 'Onboarding | mcp-obs',
  description: 'Set up your organization to get started with mcp-obs',
}

export default async function OnboardingPage() {
  const { user } = await requireSession({ organizationRequired: false })

  return <OnboardingClient user={user} />
}