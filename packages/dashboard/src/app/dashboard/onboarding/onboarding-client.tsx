'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { OrganizationForm } from '@/components/dashboard/organization-form'

interface OnboardingClientProps {
  user: any // Type this properly based on your user type
}

export function OnboardingClient({ user }: OnboardingClientProps) {
  const searchParams = useSearchParams()
  const [showAlert, setShowAlert] = useState(false)

  useEffect(() => {
    // Check if user came from dashboard redirect by checking referrer or just show message
    const referrer = document.referrer
    const fromDashboard = referrer.includes('/dashboard') && !referrer.includes('/onboarding')

    if (fromDashboard || searchParams.get('reason') === 'no-organization') {
      setShowAlert(true)
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setShowAlert(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {showAlert && (
          <div className="mb-6 rounded-md bg-primary/10 p-4 border border-primary/20">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-primary">
                  Organization Required
                </h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>You need to create an organization before accessing the dashboard.</p>
                </div>
                <div className="mt-4">
                  <div className="-mx-2 -my-1.5 flex">
                    <button
                      type="button"
                      onClick={() => setShowAlert(false)}
                      className="ml-auto rounded-md bg-primary/10 px-2 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to mcp-obs</h1>
          <p className="text-muted-foreground">
            Let's set up your organization to get started
          </p>
        </div>

        <OrganizationForm />

        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            Already have an organization?{' '}
            <a href="/dashboard" className="text-primary hover:underline">
              Go to Dashboard
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}