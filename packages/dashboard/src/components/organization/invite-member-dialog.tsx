'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

const inviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['admin', 'member'], {
    required_error: 'Please select a role',
  }),
})

type InviteMemberFormData = z.infer<typeof inviteMemberSchema>

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  onSuccess,
}: InviteMemberDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<InviteMemberFormData>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  })

  const onSubmit = async (data: InviteMemberFormData) => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'auth.inviteMember',
          params: {
            email: data.email,
            role: data.role,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to send invitation')
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error.message || 'Failed to send invitation')
      }

      // Reset form and close dialog
      form.reset()
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      form.reset()
      setError(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization. They'll receive an email with a link to accept the invitation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              {...form.register('email')}
              disabled={isLoading}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              {...form.register('role')}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            {form.formState.errors.role && (
              <p className="text-sm text-red-600">{form.formState.errors.role.message}</p>
            )}
            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>Member:</strong> Can view organization data and manage assigned MCP servers</p>
              <p><strong>Admin:</strong> Can manage organization settings, invite members, and manage all MCP servers</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}