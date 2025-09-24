'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth/client'

const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  slug: z.string()
    .min(2, 'Organization slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Organization slug can only contain lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
})

type CreateOrganizationFormData = z.infer<typeof createOrganizationSchema>

// Enhanced slugify function from OrganizationForm
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

// Check slug availability
async function checkSlugAvailability(slug: string): Promise<boolean> {
  try {
    const response = await fetch('/api/organizations/check-slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug })
    })
    const data = await response.json()
    return data.available
  } catch (error) {
    console.error('Error checking slug availability:', error)
    return false
  }
}

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
  const [slugStatus, setSlugStatus] = useState<'checking' | 'available' | 'taken' | 'idle'>('idle')

  const form = useForm<CreateOrganizationFormData>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
    },
  })

  // Auto-generate slug from organization name
  useEffect(() => {
    const name = form.watch('name')
    const currentSlug = form.watch('slug')

    if (name && !currentSlug) {
      const suggestedSlug = slugify(name)
      if (suggestedSlug) {
        form.setValue('slug', suggestedSlug)
      }
    }
  }, [form.watch('name')])

  // Validate slug availability with debouncing
  useEffect(() => {
    const slug = form.watch('slug')

    if (!slug) {
      setSlugStatus('idle')
      return
    }

    const timeoutId = setTimeout(async () => {
      setSlugStatus('checking')
      const available = await checkSlugAvailability(slug)

      if (!available) {
        // Generate alternative with nanoid
        const alternativeSlug = `${slug}-${nanoid(6).toLowerCase()}`
        form.setValue('slug', alternativeSlug)
        setSlugStatus('available')
      } else {
        setSlugStatus('available')
      }
    }, 500) // Debounce for 500ms

    return () => clearTimeout(timeoutId)
  }, [form.watch('slug')])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('name', e.target.value)
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slugified = slugify(e.target.value)
    form.setValue('slug', slugified)
  }

  const getSlugStatusColor = () => {
    switch (slugStatus) {
      case 'checking': return 'text-yellow-600'
      case 'available': return 'text-green-600'
      case 'taken': return 'text-red-600'
      default: return 'text-gray-500'
    }
  }

  const getSlugStatusText = () => {
    switch (slugStatus) {
      case 'checking': return 'Checking availability...'
      case 'available': return '✓ Available'
      case 'taken': return '✗ Already taken'
      default: return 'Unique identifier for your organization'
    }
  }

  const onSubmit = async (data: CreateOrganizationFormData) => {
    if (slugStatus !== 'available') {
      setError('Please wait for slug validation to complete')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Use the same method as the working OrganizationForm
      const result = await authClient.organization.create({
        name: data.name,
        slug: data.slug,
      })

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
            <Input
              id="slug"
              placeholder="acme-inc"
              {...form.register('slug')}
              onChange={handleSlugChange}
              disabled={isLoading}
            />
            {form.formState.errors.slug && (
              <p className="text-sm text-red-600">{form.formState.errors.slug.message}</p>
            )}
            <p className={`text-xs ${getSlugStatusColor()}`}>
              {getSlugStatusText()}
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
            <Button type="submit" disabled={isLoading || slugStatus !== 'available'}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {slugStatus === 'checking' ? 'Validating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}