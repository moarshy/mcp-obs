'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { orpcClient } from '@/lib/orpc'
import { Server, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react'

interface CreateMcpServerDialogProps {
  organizationId: string
  children: React.ReactNode
}

export function CreateMcpServerDialog({ organizationId, children }: CreateMcpServerDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [slugValidation, setSlugValidation] = useState<{
    isChecking: boolean
    isAvailable: boolean | null
    message: string
  }>({
    isChecking: false,
    isAvailable: null,
    message: ''
  })

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    enabled: true,
    allowRegistration: true,
    requireEmailVerification: false,
    enablePasswordAuth: true,
    enableGoogleAuth: true,
    enableGithubAuth: true,
  })

  const router = useRouter()

  const generateSlugFromName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)
  }

  const handleNameChange = (value: string) => {
    setFormData(prev => {
      const newData = { ...prev, name: value }
      // Auto-generate slug if it's empty or matches the previous auto-generated slug
      if (!prev.slug || prev.slug === generateSlugFromName(prev.name)) {
        newData.slug = generateSlugFromName(value)
        if (newData.slug) {
          validateSlug(newData.slug)
        }
      }
      return newData
    })
  }

  const validateSlug = async (slug: string) => {
    if (!slug) {
      setSlugValidation({ isChecking: false, isAvailable: null, message: '' })
      return
    }

    setSlugValidation({ isChecking: true, isAvailable: null, message: 'Checking availability...' })

    try {
      const result = await orpcClient.mcp.validateSlug({ slug })
      setSlugValidation({
        isChecking: false,
        isAvailable: result.available,
        message: result.message
      })
    } catch (error) {
      setSlugValidation({
        isChecking: false,
        isAvailable: false,
        message: 'Error checking slug availability'
      })
    }
  }

  const handleSlugChange = (value: string) => {
    const cleanSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 50)

    setFormData(prev => ({ ...prev, slug: cleanSlug }))

    // Debounce slug validation
    const timeoutId = setTimeout(() => validateSlug(cleanSlug), 500)
    return () => clearTimeout(timeoutId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const newServer = await orpcClient.mcp.createMcpServer({
        ...formData,
        organizationId,
      })

      setOpen(false)
      setFormData({
        name: '',
        slug: '',
        description: '',
        enabled: true,
        allowRegistration: true,
        requireEmailVerification: false,
        enablePasswordAuth: true,
        enableGoogleAuth: true,
        enableGithubAuth: true,
      })
      setSlugValidation({ isChecking: false, isAvailable: null, message: '' })

      // Refresh the page to show the new server
      router.refresh()
    } catch (error: any) {
      setError(error.message || 'Failed to create MCP server')
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = formData.name &&
                   formData.slug &&
                   slugValidation.isAvailable === true &&
                   !isLoading

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Server className="h-5 w-5 mr-2" />
            Create MCP Server
          </DialogTitle>
          <DialogDescription>
            Set up a new MCP server with authentication and analytics. Your server will be accessible
            at a dedicated subdomain.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Server Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My MCP Server"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="slug">Subdomain *</Label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="my-server"
                    required
                    disabled={isLoading}
                    className={slugValidation.isAvailable === false ? "border-red-500" : ""}
                  />
                  <span className="ml-2 text-sm text-muted-foreground whitespace-nowrap">
                    .mcp-obs.com
                  </span>
                </div>

                {formData.slug && (
                  <div className="flex items-center text-sm">
                    {slugValidation.isChecking ? (
                      <div className="flex items-center text-muted-foreground">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-2"></div>
                        {slugValidation.message}
                      </div>
                    ) : slugValidation.isAvailable === true ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-3 w-3 mr-2" />
                        {slugValidation.message}
                      </div>
                    ) : slugValidation.isAvailable === false ? (
                      <div className="flex items-center text-red-600">
                        <AlertCircle className="h-3 w-3 mr-2" />
                        {slugValidation.message}
                      </div>
                    ) : null}
                  </div>
                )}

                {formData.slug && slugValidation.isAvailable === true && (
                  <div className="flex items-center p-2 bg-muted rounded-lg text-sm">
                    <ExternalLink className="h-3 w-3 mr-2 text-muted-foreground" />
                    <span className="text-muted-foreground">Your server will be accessible at: </span>
                    <code className="ml-1 px-1 bg-background rounded text-foreground">
                      {process.env.NODE_ENV === 'development'
                        ? `localhost:3000?mcp_server=${formData.slug}`
                        : `${formData.slug}.mcp-obs.com`
                      }
                    </code>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of your MCP server"
                disabled={isLoading}
              />
            </div>
          </div>

          <Separator />

          {/* Server Configuration */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-3">Server Configuration</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({ ...prev, enabled: checked === true }))
                    }
                    disabled={isLoading}
                  />
                  <Label htmlFor="enabled" className="text-sm">
                    Enable server (users can authenticate)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allowRegistration"
                    checked={formData.allowRegistration}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({ ...prev, allowRegistration: checked === true }))
                    }
                    disabled={isLoading}
                  />
                  <Label htmlFor="allowRegistration" className="text-sm">
                    Allow user registration (new users can sign up)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requireEmailVerification"
                    checked={formData.requireEmailVerification}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({ ...prev, requireEmailVerification: checked === true }))
                    }
                    disabled={isLoading}
                  />
                  <Label htmlFor="requireEmailVerification" className="text-sm">
                    Require email verification
                  </Label>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">Authentication Methods</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enablePasswordAuth"
                    checked={formData.enablePasswordAuth}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({ ...prev, enablePasswordAuth: checked === true }))
                    }
                    disabled={isLoading}
                  />
                  <Label htmlFor="enablePasswordAuth" className="text-sm">
                    Email & Password authentication
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enableGoogleAuth"
                    checked={formData.enableGoogleAuth}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({ ...prev, enableGoogleAuth: checked === true }))
                    }
                    disabled={isLoading}
                  />
                  <Label htmlFor="enableGoogleAuth" className="text-sm">
                    Google OAuth
                  </Label>
                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enableGithubAuth"
                    checked={formData.enableGithubAuth}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({ ...prev, enableGithubAuth: checked === true }))
                    }
                    disabled={isLoading}
                  />
                  <Label htmlFor="enableGithubAuth" className="text-sm">
                    GitHub OAuth
                  </Label>
                  <Badge variant="secondary" className="text-xs">Developer-friendly</Badge>
                </div>
              </div>
            </div>
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
              type="submit"
              disabled={!canSubmit}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b border-current mr-2"></div>
                  Creating...
                </div>
              ) : (
                'Create Server'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}