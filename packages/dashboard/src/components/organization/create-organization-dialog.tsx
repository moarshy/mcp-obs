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

const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  slug: z.string()
    .min(2, 'Organization slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Organization slug can only contain lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
})

type CreateOrganizationFormData = z.infer<typeof createOrganizationSchema>

interface Organization {
  id: string
  name: string
  slug: string
  role: 'owner' | 'admin' | 'member'
}

interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (organization: Organization) => void
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOrganizationDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<CreateOrganizationFormData>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
    },
  })

  // Auto-generate slug from organization name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    form.setValue('name', name)
    form.setValue('slug', slug)
  }

  const onSubmit = async (data: CreateOrganizationFormData) => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'auth.createOrganization',
          params: {
            name: data.name,
            slug: data.slug,
            description: data.description,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create organization')
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error.message || 'Failed to create organization')
      }

      // Reset form and close dialog
      form.reset()
      onSuccess({
        id: result.data.id,
        name: result.data.name,
        slug: result.data.slug,
        role: 'owner' as const,
      })
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
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Create a new organization to manage your MCP servers and team members.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              placeholder="Acme Inc"
              {...form.register('name')}
              onChange={handleNameChange}
              disabled={isLoading}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Organization Slug</Label>
            <div className="flex">
              <span className="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-md">
                https://
              </span>
              <Input
                id="slug"
                placeholder="acme-inc"
                {...form.register('slug')}
                disabled={isLoading}
                className="rounded-l-none"
              />
              <span className="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-50 border border-l-0 border-gray-300 rounded-r-md">
                .mcplatform.com
              </span>
            </div>
            {form.formState.errors.slug && (
              <p className="text-sm text-red-600">{form.formState.errors.slug.message}</p>
            )}
            <p className="text-xs text-gray-500">
              This will be your organization's subdomain URL for authentication
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="Brief description of your organization"
              {...form.register('description')}
              disabled={isLoading}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-red-600">{form.formState.errors.description.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Organization
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}