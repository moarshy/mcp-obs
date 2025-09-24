'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/client'
import {
  LayoutDashboard,
  LogOut,
  Settings,
  HelpCircle,
  Search,
  Moon
} from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
}

interface DashboardSidebarProps {
  user: User
}

const sidebarItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    current: true
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

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
      router.push('/auth/signin')
      router.refresh()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="flex items-center px-6 py-4 border-b border-gray-800">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">⚡</span>
          </div>
          <span className="ml-3 text-white font-semibold">mcp-obs</span>
        </div>
      </div>

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
    </div>
  )
}