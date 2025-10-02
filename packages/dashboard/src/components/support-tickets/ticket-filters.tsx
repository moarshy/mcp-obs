'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'

interface TicketFiltersProps {
  mcpServers: Array<{
    id: string
    name: string
    slug: string
    enabled: boolean
  }>
}

export function TicketFilters({ mcpServers }: TicketFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '')
  const [statusValue, setStatusValue] = useState(searchParams.get('status') || 'all')
  const [categoryValue, setCategoryValue] = useState(searchParams.get('category') || 'all')
  const [serverValue, setServerValue] = useState(searchParams.get('mcpServerId') || 'all')

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== (searchParams.get('search') || '')) {
        updateUrl({ search: searchValue || undefined })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchValue, searchParams])

  const updateUrl = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== 'all') {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })

    // Reset to page 1 when filters change
    if (Object.keys(updates).some(key => key !== 'page')) {
      params.delete('page')
    }

    router.push(`/dashboard/support-tickets?${params.toString()}`)
  }, [router, searchParams])

  const handleStatusChange = (value: string) => {
    setStatusValue(value)
    updateUrl({ status: value === 'all' ? undefined : value })
  }

  const handleCategoryChange = (value: string) => {
    setCategoryValue(value)
    updateUrl({ category: value === 'all' ? undefined : value })
  }

  const handleServerChange = (value: string) => {
    setServerValue(value)
    updateUrl({ mcpServerId: value === 'all' ? undefined : value })
  }

  const clearFilters = () => {
    setSearchValue('')
    setStatusValue('all')
    setCategoryValue('all')
    setServerValue('all')
    router.push('/dashboard/support-tickets')
  }

  const hasActiveFilters = searchValue || statusValue !== 'all' || categoryValue !== 'all' || serverValue !== 'all'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filters</CardTitle>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 flex-wrap">
          <Select value={statusValue} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryValue} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Bug Report">Bug Report</SelectItem>
              <SelectItem value="Feature Request">Feature Request</SelectItem>
              <SelectItem value="Documentation">Documentation</SelectItem>
              <SelectItem value="Testing">Testing</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={serverValue} onValueChange={handleServerChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by MCP server" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Servers</SelectItem>
              {mcpServers.map((server) => (
                <SelectItem key={server.id} value={server.id}>
                  {server.name} {!server.enabled && '(Disabled)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Search tickets..."
            className="flex-1 min-w-[200px]"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  )
}