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
import { updateMcpServerAction } from '@/lib/orpc/actions/mcp-servers'
import { validateSlug } from '@/lib/actions/validate-slug'
import { DeleteMcpServerDialog } from './delete-mcp-server-dialog'
import { Server, ExternalLink, AlertCircle, CheckCircle, Trash2 } from 'lucide-react'

interface EditMcpServerDialogProps {
  mcpServer: {
    id: string
    name: string
    slug: string
    description?: string | null
    enabled: boolean
    allowRegistration: boolean
    requireEmailVerification: boolean
    enablePasswordAuth: boolean
    enableGoogleAuth: boolean
    enableGithubAuth: boolean
    accessTokenExpiration: number
    refreshTokenExpiration: number
    scopesSupported: string
  }
  children: React.ReactNode
}

export function EditMcpServerDialog({ mcpServer, children }: EditMcpServerDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [slugValidation, setSlugValidation] = useState<{
    isChecking: boolean
    isAvailable: boolean | null
    message: string
  }>({
    isChecking: false,
    isAvailable: true, // Start as valid since it's the current slug
    message: 'Current slug'
  })

  const [formData, setFormData] = useState({
    name: mcpServer.name,
    slug: mcpServer.slug,
    description: mcpServer.description || '',
    // Derive platform auth enabled from existing auth settings
    platformAuthEnabled: mcpServer.enabled && (mcpServer.enablePasswordAuth || mcpServer.enableGoogleAuth || mcpServer.enableGithubAuth),
  })

  const router = useRouter()

  const handleSlugValidation = async (slug: string) => {
    if (!slug || slug === mcpServer.slug) {
      setSlugValidation({
        isChecking: false,
        isAvailable: true,
        message: slug === mcpServer.slug ? 'Current slug' : ''
      })
      return
    }

    setSlugValidation({ isChecking: true, isAvailable: null, message: 'Checking availability...' })

    try {
      const result = await validateSlug(slug, mcpServer.id)
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
    const timeoutId = setTimeout(() => handleSlugValidation(cleanSlug), 500)
    return () => clearTimeout(timeoutId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await updateMcpServerAction({
        id: mcpServer.id,
        name: formData.name !== mcpServer.name ? formData.name : undefined,
        slug: formData.slug !== mcpServer.slug ? formData.slug : undefined,
        description: formData.description !== (mcpServer.description || '') ? formData.description : undefined,
        platformAuthEnabled: formData.platformAuthEnabled,
      })

      setOpen(false)
      router.refresh()
    } catch (error: any) {
      setError(error.message || 'Failed to update MCP server')
    } finally {
      setIsLoading(false)
    }
  }


  const canSubmit = formData.name &&
                   formData.slug &&
                   (formData.slug === mcpServer.slug || slugValidation.isAvailable === true) &&
                   !isLoading

  const hasChanges = formData.name !== mcpServer.name ||
                    formData.slug !== mcpServer.slug ||
                    formData.description !== (mcpServer.description || '') ||
                    formData.platformAuthEnabled !== (mcpServer.enabled && (mcpServer.enablePasswordAuth || mcpServer.enableGoogleAuth || mcpServer.enableGithubAuth))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Server className="h-5 w-5 mr-2" />
            Edit MCP Server
          </DialogTitle>
          <DialogDescription>
            Update your MCP server configuration. Changes to authentication settings will affect
            existing and future OAuth flows.
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
              <Label htmlFor="edit-name">Server Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My MCP Server"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="edit-slug">Subdomain *</Label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Input
                    id="edit-slug"
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="my-server"
                    required
                    disabled={isLoading}
                    className={
                      formData.slug !== mcpServer.slug && slugValidation.isAvailable === false
                        ? "border-red-500" : ""
                    }
                  />
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

                {formData.slug && formData.slug !== mcpServer.slug && slugValidation.isAvailable === true && (
                  <div className="flex items-center p-2 bg-muted rounded-lg text-sm">
                    <ExternalLink className="h-3 w-3 mr-2 text-muted-foreground" />
                    <span className="text-muted-foreground">New URL: </span>
                    <code className="ml-1 px-1 bg-background rounded text-foreground">
                      {formData.slug}
                    </code>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of your MCP server"
                disabled={isLoading}
              />
            </div>
          </div>

          <Separator />

          {/* Simple Auth Configuration */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-3">Authentication</h4>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-platformAuthEnabled"
                  checked={formData.platformAuthEnabled}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, platformAuthEnabled: checked === true }))
                  }
                  disabled={isLoading}
                />
                <div>
                  <Label htmlFor="edit-platformAuthEnabled" className="text-sm font-medium">
                    Enable platform authentication
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Provides OAuth authentication with Google, GitHub, and email/password.
                    When disabled, your MCP server will be publicly accessible.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Danger Zone */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-destructive mb-3">Danger Zone</h4>
              <div className="border border-destructive/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Delete MCP Server</p>
                    <p className="text-xs text-muted-foreground">
                      Permanently delete this server and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  <DeleteMcpServerDialog
                    serverId={mcpServer.id}
                    serverName={mcpServer.name}
                  >
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isLoading}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </DeleteMcpServerDialog>
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
              disabled={!canSubmit || !hasChanges}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b border-current mr-2"></div>
                  Saving...
                </div>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}