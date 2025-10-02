'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, Clock, CheckCircle, Loader2 } from 'lucide-react'
import { updateSupportTicketStatusAction } from '@/lib/orpc/actions/support-tickets'

interface StatusUpdateFormProps {
  ticketId: string
  currentStatus: 'open' | 'in_progress' | 'closed'
}

export function StatusUpdateForm({ ticketId, currentStatus }: StatusUpdateFormProps) {
  const [status, setStatus] = useState(currentStatus)
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()

  const handleStatusUpdate = async () => {
    if (status === currentStatus || isUpdating) return

    setIsUpdating(true)
    try {
      const result = await updateSupportTicketStatusAction({
        id: ticketId,
        status: status as 'open' | 'in_progress' | 'closed'
      })

      // Handle oRPC response format
      let updateResult = result
      if (Array.isArray(result) && result.length >= 2 && result[0] === null && result[1]) {
        updateResult = result[1]
      }

      if (updateResult) {
        // Refresh the page to show updated status
        router.refresh()
      } else {
        throw new Error('Update failed')
      }

    } catch (error) {
      console.error('Failed to update ticket status:', error)
      // Reset status on error
      setStatus(currentStatus)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={status} onValueChange={setStatus} disabled={isUpdating}>
          <SelectTrigger>
            <SelectValue />
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
        <Button
          onClick={handleStatusUpdate}
          className="w-full"
          disabled={isUpdating || status === currentStatus}
        >
          {isUpdating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            'Update Status'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}