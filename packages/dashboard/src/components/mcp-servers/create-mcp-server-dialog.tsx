'use client'

import { useState, useEffect, useRef } from 'react'
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
import { createMcpServerAction } from '@/lib/orpc/actions/mcp-servers'
import { Server, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react'

interface CreateMcpServerDialogProps {
  children: React.ReactNode
}

export function CreateMcpServerDialog({ children }: CreateMcpServerDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdServer, setCreatedServer] = useState<any>(null)
  const [slugValidation, setSlugValidation] = useState<{
    isChecking: boolean
    isAvailable: boolean | null
    message: string
  }>({
    isChecking: false,
    isAvailable: null,
    message: ''
  })

  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    platformAuthEnabled: true, // Simple toggle for platform auth
    supportToolEnabled: false,
    supportToolTitle: 'Get Support',
    supportToolDescription: 'Report issues or ask questions',
    supportToolCategories: 'Bug Report,Feature Request,Documentation,Other',
    telemetryEnabled: false, // OpenTelemetry option
  })

  const router = useRouter()

  // Debounced slug validation using useEffect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!formData.slug) {
      setSlugValidation({ isChecking: false, isAvailable: null, message: '' })
      return
    }

    debounceRef.current = setTimeout(() => {
      validateSlugAsync(formData.slug)
    }, 500)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [formData.slug])

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
      }
      return newData
    })
  }

  const validateSlugAsync = async (slug: string) => {
    if (!slug) {
      setSlugValidation({ isChecking: false, isAvailable: null, message: '' })
      return
    }

    setSlugValidation({ isChecking: true, isAvailable: null, message: 'Checking availability...' })

    try {
      // Call the API endpoint for slug validation
      const response = await fetch('/api/mcpserver/check-slug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to check slug availability')
      }

      setSlugValidation({
        isChecking: false,
        isAvailable: result.available,
        message: result.message
      })
    } catch (error: any) {
      setSlugValidation({
        isChecking: false,
        isAvailable: false,
        message: 'Error checking slug availability. Please try again.'
      })
    }
  }

  const handleSlugChange = (value: string) => {
    const cleanSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 50)

    setFormData(prev => ({ ...prev, slug: cleanSlug }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const newServer = await createMcpServerAction({
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        platformAuthEnabled: formData.platformAuthEnabled,
        supportToolEnabled: formData.supportToolEnabled,
        supportToolTitle: formData.supportToolTitle,
        supportToolDescription: formData.supportToolDescription,
        supportToolCategories: formData.supportToolCategories,
        telemetryEnabled: formData.telemetryEnabled,
      })

      // Store the created server info (including API key if generated)
      setCreatedServer(newServer)

      // Don't close the dialog immediately if we have an API key to show
      if (!newServer.telemetryApiKey) {
        setOpen(false)
      }

      setFormData({
        name: '',
        slug: '',
        description: '',
        platformAuthEnabled: true,
        supportToolEnabled: false,
        supportToolTitle: 'Get Support',
        supportToolDescription: 'Report issues or ask questions',
        supportToolCategories: 'Bug Report,Feature Request,Documentation,Other',
        telemetryEnabled: false,
      })
      setSlugValidation({ isChecking: false, isAvailable: null, message: '' })

      // Router refresh is handled by the server action's revalidatePath
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
            {createdServer ? 'MCP Server Created!' : 'Create MCP Server'}
          </DialogTitle>
          <DialogDescription>
            {createdServer
              ? 'Your MCP server has been created successfully!'
              : 'Set up a new MCP server with authentication and analytics. Your server will be accessible at a dedicated subdomain.'
            }
          </DialogDescription>
        </DialogHeader>

        {createdServer && createdServer.telemetryApiKey ? (
          // Success screen with API key
          <div className="space-y-6">
            <div className="flex items-center justify-center p-6">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>

            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Server Created Successfully!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your MCP server "{createdServer.name}" is ready to use.
                </p>
              </div>

              <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Telemetry API Key Generated
                  </span>
                </div>
                <p className="text-xs text-green-700 dark:text-green-300 mb-3">
                  Save this API key now - it won't be shown again for security reasons.
                </p>

                <div className="bg-white dark:bg-gray-800 border rounded p-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-mono flex-1 break-all">
                      {createdServer.telemetryApiKey}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(createdServer.telemetryApiKey)
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/40 rounded border">
                  <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-2">
                    Quick Setup:
                  </p>
                  <div className="font-mono text-xs text-green-700 dark:text-green-300">
                    <div>export MCP_OBS_API_KEY="{createdServer.telemetryApiKey}"</div>
                    <div className="mt-1">configureMCPTelemetry(&#123;</div>
                    <div>&nbsp;&nbsp;serverSlug: '{createdServer.slug}',</div>
                    <div>&nbsp;&nbsp;apiKey: process.env.MCP_OBS_API_KEY</div>
                    <div>&#125;)</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false)
                  setCreatedServer(null)
                }}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setOpen(false)
                  setCreatedServer(null)
                  router.push(`/dashboard/mcp-servers/${createdServer.id}`)
                }}
              >
                View Server
              </Button>
            </div>
          </div>
        ) : createdServer ? (
          // Success screen without API key
          <div className="space-y-6">
            <div className="flex items-center justify-center p-6">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Server Created Successfully!</h3>
              <p className="text-sm text-muted-foreground">
                Your MCP server "{createdServer.name}" is ready to use.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false)
                  setCreatedServer(null)
                }}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setOpen(false)
                  setCreatedServer(null)
                  router.push(`/dashboard/mcp-servers/${createdServer.id}`)
                }}
              >
                View Server
              </Button>
            </div>
          </div>
        ) : (
          // Original form
          <>

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
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="my-server"
                  required
                  disabled={isLoading}
                  className={slugValidation.isAvailable === false ? "border-red-500" : ""}
                />

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
                      {formData.slug}
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

          {/* Simple Auth Configuration */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-3">Authentication</h4>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="platformAuthEnabled"
                  checked={formData.platformAuthEnabled}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, platformAuthEnabled: checked === true }))
                  }
                  disabled={isLoading}
                />
                <div>
                  <Label htmlFor="platformAuthEnabled" className="text-sm font-medium">
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

          {/* Support Tool Configuration */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-3">Support Tool</h4>
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox
                  id="supportToolEnabled"
                  checked={formData.supportToolEnabled}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, supportToolEnabled: checked === true }))
                  }
                  disabled={isLoading}
                />
                <div>
                  <Label htmlFor="supportToolEnabled" className="text-sm font-medium">
                    Enable support tool
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically adds a support tool to your MCP server, allowing users to create tickets directly through tool calls.
                  </p>
                </div>
              </div>

              {formData.supportToolEnabled && (
                <div className="ml-6 space-y-4 p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="supportToolTitle">Tool Title</Label>
                    <Input
                      id="supportToolTitle"
                      value={formData.supportToolTitle}
                      onChange={(e) => setFormData(prev => ({ ...prev, supportToolTitle: e.target.value }))}
                      placeholder="Get Support"
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="supportToolDescription">Tool Description</Label>
                    <Input
                      id="supportToolDescription"
                      value={formData.supportToolDescription}
                      onChange={(e) => setFormData(prev => ({ ...prev, supportToolDescription: e.target.value }))}
                      placeholder="Report issues or ask questions"
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="supportToolCategories">Available Categories</Label>
                    <Input
                      id="supportToolCategories"
                      value={formData.supportToolCategories}
                      onChange={(e) => setFormData(prev => ({ ...prev, supportToolCategories: e.target.value }))}
                      placeholder="Bug Report,Feature Request,Documentation,Other"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Comma-separated list of available ticket categories
                    </p>
                  </div>

                  <div className="flex items-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="ml-2 text-sm text-blue-700 dark:text-blue-300">
                      When enabled, a "get_support_tool" will be automatically registered with your MCP server,
                      allowing users to create support tickets through natural language interactions.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium mb-3">Telemetry & Analytics</h4>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="telemetryEnabled"
                  checked={formData.telemetryEnabled}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, telemetryEnabled: checked === true }))
                  }
                  disabled={isLoading}
                />
                <div>
                  <Label htmlFor="telemetryEnabled" className="text-sm font-medium">
                    Enable OpenTelemetry
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically collects performance metrics, usage analytics, and distributed traces.
                    Provides detailed insights into tool usage and user behavior.
                  </p>
                </div>
              </div>

              {formData.telemetryEnabled && (
                <div className="mt-4 p-4 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-green-700 dark:text-green-300 space-y-2">
                      <p>
                        <strong>API Key Generated:</strong> A telemetry API key will be automatically generated
                        when your MCP server is created. Use this key to configure the mcp-obs SDK.
                      </p>
                      <div className="bg-green-100 dark:bg-green-900/40 p-2 rounded border font-mono text-xs">
                        <div>// TypeScript SDK</div>
                        <div>configureMCPTelemetry(&#123;</div>
                        <div>&nbsp;&nbsp;serverSlug: '{formData.slug || 'your-server'}',</div>
                        <div>&nbsp;&nbsp;apiKey: process.env.MCP_OBS_API_KEY</div>
                        <div>&#125;)</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
        </>
        )}
      </DialogContent>
    </Dialog>
  )
}