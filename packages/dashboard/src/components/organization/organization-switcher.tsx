'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { CreateOrganizationDialog } from './create-organization-dialog'
import { cn } from '@/lib/utils'

interface Organization {
  id: string
  name: string
  slug: string
  role: 'owner' | 'admin' | 'member'
}

interface OrganizationSwitcherProps {
  organizations: Organization[]
  currentOrganization: Organization | null
  onOrganizationChange: (organization: Organization) => void
}

export function OrganizationSwitcher({
  organizations,
  currentOrganization,
  onOrganizationChange,
}: OrganizationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const router = useRouter()

  const handleOrganizationSelect = (organization: Organization) => {
    onOrganizationChange(organization)
    setIsOpen(false)
    // Refresh the page to load new organization data
    router.refresh()
  }

  return (
    <>
      <div className="relative">
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-[200px] justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          {currentOrganization ? (
            <div className="flex flex-col items-start">
              <span className="font-medium">{currentOrganization.name}</span>
              <span className="text-xs text-gray-500 capitalize">{currentOrganization.role}</span>
            </div>
          ) : (
            "Select organization..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>

        {isOpen && (
          <div className="absolute top-full mt-1 w-[200px] rounded-md border bg-white shadow-md z-50">
            <div className="p-1">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  className={cn(
                    "w-full flex items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100",
                    currentOrganization?.id === org.id && "bg-gray-100"
                  )}
                  onClick={() => handleOrganizationSelect(org)}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{org.name}</span>
                    <span className="text-xs text-gray-500 capitalize">{org.role}</span>
                  </div>
                  {currentOrganization?.id === org.id && (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              ))}

              <div className="border-t mt-1 pt-1">
                <button
                  className="w-full flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100"
                  onClick={() => {
                    setIsOpen(false)
                    setShowCreateDialog(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Organization
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close dropdown when clicking outside */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </div>

      <CreateOrganizationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={(newOrg) => {
          setShowCreateDialog(false)
          handleOrganizationSelect(newOrg)
        }}
      />
    </>
  )
}