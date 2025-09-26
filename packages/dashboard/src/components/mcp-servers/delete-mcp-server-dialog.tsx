'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { deleteMcpServerAction } from '@/lib/orpc/actions/mcp-servers'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface DeleteMcpServerDialogProps {
  serverId: string
  serverName: string
  children: React.ReactNode
}

export function DeleteMcpServerDialog({ serverId, serverName, children }: DeleteMcpServerDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleDelete = async () => {
    setIsLoading(true)
    setError('')

    try {
      await deleteMcpServerAction({ id: serverId })
      setOpen(false)
      // Redirect to MCP servers list after successful deletion
      router.push('/dashboard/mcp-servers')
      router.refresh()
    } catch (error: any) {
      setError(error.message || 'Failed to delete MCP server')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-red-600">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Delete MCP Server
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{serverName}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-red-800 dark:text-red-200 mb-2">
                  This will permanently delete:
                </p>
                <ul className="text-red-700 dark:text-red-300 space-y-1">
                  <li>• The MCP server configuration</li>
                  <li>• All associated OAuth clients</li>
                  <li>• User sessions and analytics data</li>
                  <li>• Authentication endpoints</li>
                </ul>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b border-current mr-2"></div>
                Deleting...
              </div>
            ) : (
              <div className="flex items-center">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Server
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}