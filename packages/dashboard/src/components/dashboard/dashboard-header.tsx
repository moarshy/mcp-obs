'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { OrganizationSwitcher } from '@/components/organization/organization-switcher'
import { InviteMemberDialog } from '@/components/organization/invite-member-dialog'
import { authClient } from '@/lib/auth/client'
import { LogOut, Plus, Users } from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
}

interface Organization {
  id: string
  name: string
  slug: string
  role: 'owner' | 'admin' | 'member'
}

interface DashboardHeaderProps {
  user: User
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Load user organizations on mount
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const response = await fetch('/api/rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'auth.getMe',
            params: {},
          }),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.data?.organizations) {
            setOrganizations(result.data.organizations)
            if (result.data.organizations.length > 0) {
              setCurrentOrganization(result.data.organizations[0])
            }
          }
        }
      } catch (error) {
        console.error('Failed to load organizations:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrganizations()
  }, [])

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
      router.push('/auth/signin')
      router.refresh()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  const handleOrganizationChange = (organization: Organization) => {
    setCurrentOrganization(organization)
  }

  const canInviteMembers = currentOrganization && ['owner', 'admin'].includes(currentOrganization.role)

  return (
    <header className="bg-card border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-card-foreground">mcp-obs</h1>

            {!isLoading && organizations.length > 0 && (
              <OrganizationSwitcher
                organizations={organizations}
                currentOrganization={currentOrganization}
                onOrganizationChange={handleOrganizationChange}
              />
            )}
          </div>

          <div className="flex items-center space-x-4">
            {canInviteMembers && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInviteDialog(true)}
              >
                <Users className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            )}

            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {user.name || user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {currentOrganization && (
        <InviteMemberDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          onSuccess={() => {
            // Refresh organizations list
            window.location.reload()
          }}
        />
      )}
    </header>
  )
}