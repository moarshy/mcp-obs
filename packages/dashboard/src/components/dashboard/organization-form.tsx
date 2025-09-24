'use client'

import { useState, useEffect } from 'react'
import { nanoid } from 'nanoid'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth/client'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

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

export function OrganizationForm() {
  const [organizationName, setOrganizationName] = useState('')
  const [organizationSlug, setOrganizationSlug] = useState('')
  const [slugStatus, setSlugStatus] = useState<'checking' | 'available' | 'taken' | 'idle'>('idle')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-suggest slug based on organization name
  useEffect(() => {
    if (organizationName && !organizationSlug) {
      const suggestedSlug = slugify(organizationName)
      if (suggestedSlug) {
        setOrganizationSlug(suggestedSlug)
      }
    }
  }, [organizationName, organizationSlug])

  // Validate slug availability
  useEffect(() => {
    if (!organizationSlug) {
      setSlugStatus('idle')
      return
    }

    const timeoutId = setTimeout(async () => {
      setSlugStatus('checking')
      const available = await checkSlugAvailability(organizationSlug)

      if (!available) {
        // Generate alternative with nanoid
        const alternativeSlug = `${organizationSlug}-${nanoid(6).toLowerCase()}`
        setOrganizationSlug(alternativeSlug)
        setSlugStatus('available')
      } else {
        setSlugStatus('available')
      }
    }, 500) // Debounce for 500ms

    return () => clearTimeout(timeoutId)
  }, [organizationSlug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (slugStatus !== 'available') return

    setIsSubmitting(true)
    try {
      const result = await authClient.organization.create({
        name: organizationName,
        slug: organizationSlug,
      })

      if (result.error) {
        console.error('Failed to create organization:', result.error)
      } else {
        window.location.href = '/dashboard'
      }
    } catch (error) {
      console.error('Error creating organization:', error)
    } finally {
      setIsSubmitting(false)
    }
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
      default: return 'This will be used as your organization\'s unique identifier'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Your Organization</CardTitle>
        <CardDescription>
          Set up your organization to manage MCP servers and team members
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organizationName">Organization Name</Label>
            <Input
              id="organizationName"
              type="text"
              placeholder="Acme Inc"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required
            />
            <p className="text-sm text-gray-500">
              This will be the display name for your organization
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizationSlug">Organization Slug</Label>
            <Input
              id="organizationSlug"
              type="text"
              placeholder="acme-inc"
              value={organizationSlug}
              onChange={(e) => setOrganizationSlug(slugify(e.target.value))}
              required
            />
            <p className={`text-sm ${getSlugStatusColor()}`}>
              {getSlugStatusText()}
            </p>
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || slugStatus !== 'available'}
            >
              {isSubmitting ? 'Creating...' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}