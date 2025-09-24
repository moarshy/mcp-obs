'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { authClient } from '@/lib/auth/client'
import {
  LayoutDashboard,
  LogOut,
  Settings,
  HelpCircle,
  Search,
  ChevronDown,
  Building2,
  Server
} from 'lucide-react'
import appIcon from '@/assets/appicon.png'
import { CreateOrganizationDialog } from '@/components/organization/create-organization-dialog'

interface User {
  id: string
  name: string
  email: string
}

interface Organization {
  id: string
  name: string
  slug: string
}

interface DashboardSidebarProps {
  user: User
  organizations: Organization[]
}

const sidebarItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    current: true
  },
  {
    name: 'MCP Servers',
    href: '/dashboard/mcp-servers',
    icon: Server,
    current: false
  }
]

const bottomItems = [
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings
  },
  {
    name: 'Get Help',
    href: '/dashboard/help',
    icon: HelpCircle
  },
  {
    name: 'Search',
    href: '/dashboard/search',
    icon: Search
  }
]

export function DashboardSidebar({ user, organizations }: DashboardSidebarProps) {
  const router = useRouter()
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(
    organizations.length > 0 ? organizations[0] : null
  )
  const [showOrgDropdown, setShowOrgDropdown] = useState(false)
  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false)

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
      router.push('/auth/signin')
      router.refresh()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  const handleCreateOrganizationSuccess = (newOrganization: Organization) => {
    // Add new organization to the list and set it as current
    setCurrentOrganization(newOrganization)
    setShowCreateOrgDialog(false)
    // Refresh the page to load the new organization
    router.refresh()
  }

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="flex items-center px-6 py-4 border-b border-sidebar-border">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-lg overflow-hidden">
            <Image
              src={appIcon}
              alt="mcp-obs"
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="ml-3 text-sidebar-foreground font-semibold">mcp-obs</span>
        </div>
      </div>

      {/* Organization Switcher */}
      {currentOrganization && (
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="relative">
            <button
              onClick={() => setShowOrgDropdown(!showOrgDropdown)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="flex items-center min-w-0">
                <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {currentOrganization.name}
                  </p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </button>

            {/* Dropdown */}
            {showOrgDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      setCurrentOrganization(org)
                      setShowOrgDropdown(false)
                    }}
                    className="w-full flex items-center px-3 py-2 text-sm text-left hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                  >
                    <Building2 className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                    <span className="text-white truncate">{org.name}</span>
                    {org.id === currentOrganization.id && (
                      <span className="ml-auto text-blue-400 text-xs">Current</span>
                    )}
                  </button>
                ))}
                <div className="border-t border-gray-700">
                  <button
                    onClick={() => {
                      setShowOrgDropdown(false)
                      setShowCreateOrgDialog(true)
                    }}
                    className="w-full flex items-center px-3 py-2 text-sm text-left hover:bg-gray-700 rounded-b-lg text-gray-400"
                  >
                    <span className="text-lg mr-2">+</span>
                    Create Organization
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.name}>
                <a
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 text-sm font-medium rounded-lg
                    ${item.current
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }
                  `}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="px-4 py-4 border-t border-gray-800">
        <ul className="space-y-2 mb-4">
          {bottomItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.name}>
                <a
                  href={item.href}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-300 rounded-lg hover:bg-gray-800 hover:text-white"
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </a>
              </li>
            )
          })}
        </ul>

        {/* User profile */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
          <div className="flex items-center min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-medium">
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </span>
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {user.name || 'User'}
              </p>
              <p className="text-gray-400 text-xs truncate">
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="ml-2 p-1 text-gray-400 hover:text-white flex-shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={showCreateOrgDialog}
        onOpenChange={setShowCreateOrgDialog}
        onSuccess={handleCreateOrganizationSuccess}
      />
    </div>
  )
}