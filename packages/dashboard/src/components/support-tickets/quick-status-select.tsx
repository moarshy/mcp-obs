'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { updateSupportTicketStatusAction } from '@/lib/orpc/actions/support-tickets'

interface QuickStatusSelectProps {
  ticketId: string
  currentStatus: 'open' | 'in_progress' | 'closed'
  onStatusChange?: (newStatus: 'open' | 'in_progress' | 'closed') => void
}

export function QuickStatusSelect({ ticketId, currentStatus, onStatusChange }: QuickStatusSelectProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusChange = async (newStatus: 'open' | 'in_progress' | 'closed') => {
    if (newStatus === currentStatus || isUpdating) return

    setIsUpdating(true)
    try {
      await updateSupportTicketStatusAction({
        id: ticketId,
        status: newStatus
      })
      onStatusChange?.(newStatus)
    } catch (error) {
      console.error('Failed to update ticket status:', error)
      // You could add a toast notification here
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="h-3 w-3" />
      case 'in_progress':
        return <Clock className="h-3 w-3" />
      case 'closed':
        return <CheckCircle className="h-3 w-3" />
      default:
        return null
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'open':
        return 'destructive' as const
      case 'in_progress':
        return 'default' as const
      case 'closed':
        return 'secondary' as const
      default:
        return 'default' as const
    }
  }

  return (
    <Select
      value={currentStatus}
      onValueChange={handleStatusChange}
      disabled={isUpdating}
    >
      <SelectTrigger asChild>
        <Badge
          variant={getStatusVariant(currentStatus)}
          className="cursor-pointer hover:opacity-80 transition-opacity"
        >
          {getStatusIcon(currentStatus)}
          <span className="ml-1">
            {isUpdating ? 'Updating...' : currentStatus.replace('_', ' ')}
          </span>
        </Badge>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="open">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3 w-3" />
            Open
          </div>
        </SelectItem>
        <SelectItem value="in_progress">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            In Progress
          </div>
        </SelectItem>
        <SelectItem value="closed">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-3 w-3" />
            Closed
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}