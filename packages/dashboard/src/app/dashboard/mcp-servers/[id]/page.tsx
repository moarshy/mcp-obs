import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { requireSession } from '@/lib/auth/session'
import {
  Server,
  Users,
  Activity,
  Settings,
  ExternalLink,
  Calendar,
  Shield,
  Key,
  BarChart3,
  TrendingUp,
  Clock,
  Globe,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { EditMcpServerDialog } from '@/components/mcp-servers/edit-mcp-server-dialog'
import { ApiKeyManagement } from '@/components/mcp-servers/api-key-management'

interface McpServerDetailsPageProps {
  params: {
    id: string
  }
}

export const metadata = {
  title: 'MCP Server Details | mcp-obs',
  description: 'View detailed analytics and settings for your MCP server',
}

async function McpServerDetailsContent({ serverId }: { serverId: string }) {
  const session = await requireSession()

  try {
    // Get the MCP server from database with organization verification
    const { db, mcpServer, member } = await import('database')
    const { eq, and } = await import('drizzle-orm')

    // Check user has access to organizations
    const userMemberships = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, session.user.id))

    if (userMemberships.length === 0) {
      notFound()
    }

    const organizationIds = userMemberships.map(m => m.organizationId)

    // Get the specific MCP server
    const serverData = await db
      .select()
      .from(mcpServer)
      .where(and(
        eq(mcpServer.id, serverId),
        // Ensure user has access to this server's organization
        // TODO: Use proper IN clause when available
      ))
      .then(rows => rows[0])

    if (!serverData) {
      notFound()
    }

    // Verify user has access to this server's organization
    const hasAccess = organizationIds.includes(serverData.organizationId)
    if (!hasAccess) {
      notFound()
    }

    const mcpServerData = serverData

    // Debug telemetry status
    console.log('MCP Server telemetry status:', {
      serverId: mcpServerData.id,
      telemetryEnabled: mcpServerData.telemetryEnabled,
      serverData: mcpServerData
    })

    const serverUrl = mcpServerData.slug

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/mcp-servers">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{mcpServerData.name}</h1>
                <div className="flex items-center space-x-4 text-muted-foreground">
                  <div className="flex items-center">
                    <Globe className="h-4 w-4 mr-1" />
                    <code className="text-sm">{serverUrl}</code>
                    <Button variant="ghost" size="sm" asChild className="ml-1 h-6 w-6 p-0">
                      <a href={`https://${serverUrl}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Created {new Date(mcpServerData.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <EditMcpServerDialog mcpServer={mcpServerData}>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Edit Server
              </Button>
            </EditMcpServerDialog>
            <Badge variant={mcpServerData.enabled ? "default" : "secondary"} className="h-8">
              {mcpServerData.enabled ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <div className="flex items-center mt-1">
                    <p className="text-2xl font-bold">0</p>
                    <div className="flex items-center ml-2 text-green-500">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      <span className="text-xs">+0%</span>
                    </div>
                  </div>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">API Calls (24h)</p>
                  <div className="flex items-center mt-1">
                    <p className="text-2xl font-bold">0</p>
                    <div className="flex items-center ml-2 text-muted-foreground">
                      <span className="text-xs">+0%</span>
                    </div>
                  </div>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">OAuth Clients</p>
                  <div className="flex items-center mt-1">
                    <p className="text-2xl font-bold">0</p>
                    <span className="text-xs text-muted-foreground ml-2">registered</span>
                  </div>
                </div>
                <Key className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                  <div className="flex items-center mt-1">
                    <p className="text-2xl font-bold">-</p>
                    <span className="text-xs text-muted-foreground ml-2">ms</span>
                  </div>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Server Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Server className="h-5 w-5 mr-2" />
                Server Configuration
              </CardTitle>
              <CardDescription>
                Current server settings and authentication configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant={mcpServerData.enabled ? "default" : "secondary"} className="mt-1">
                    {mcpServerData.enabled ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Registration</p>
                  <Badge variant={mcpServerData.allowRegistration ? "default" : "secondary"} className="mt-1">
                    {mcpServerData.allowRegistration ? "Allowed" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email Verification</p>
                  <Badge variant={mcpServerData.requireEmailVerification ? "default" : "secondary"} className="mt-1">
                    {mcpServerData.requireEmailVerification ? "Required" : "Optional"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">PKCE</p>
                  <Badge variant="default" className="mt-1">
                    Required
                  </Badge>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Authentication Methods</p>
                <div className="flex flex-wrap gap-2">
                  {mcpServerData.enablePasswordAuth && (
                    <Badge variant="outline">Email & Password</Badge>
                  )}
                  {mcpServerData.enableGoogleAuth && (
                    <Badge variant="outline">Google OAuth</Badge>
                  )}
                  {mcpServerData.enableGithubAuth && (
                    <Badge variant="outline">GitHub OAuth</Badge>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Access Token TTL</p>
                  <p>{Math.floor(mcpServerData.accessTokenExpiration / 3600)}h {Math.floor((mcpServerData.accessTokenExpiration % 3600) / 60)}m</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Refresh Token TTL</p>
                  <p>{Math.floor(mcpServerData.refreshTokenExpiration / 86400)}d</p>
                </div>
              </div>

              {mcpServerData.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{mcpServerData.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* OAuth Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="h-5 w-5 mr-2" />
                OAuth 2.1 Endpoints
              </CardTitle>
              <CardDescription>
                Use these endpoints for OAuth integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Authorization</p>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {mcpServerData.authorizationEndpoint}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Token</p>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {mcpServerData.tokenEndpoint}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Registration</p>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {mcpServerData.registrationEndpoint}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Introspection</p>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {mcpServerData.introspectionEndpoint}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Revocation</p>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {mcpServerData.revocationEndpoint}
                </code>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Well-known configuration</span>
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={`${mcpServerData.issuerUrl}/.well-known/oauth-authorization-server`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Telemetry Link */}
        {mcpServerData.telemetryEnabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Telemetry & Analytics
              </CardTitle>
              <CardDescription>
                View detailed telemetry analytics for this server
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div>
                  <h4 className="font-medium">OpenTelemetry Enabled</h4>
                  <p className="text-sm text-muted-foreground">
                    Performance metrics, usage analytics, and distributed traces are being collected
                  </p>
                </div>
                <Button asChild>
                  <Link href={`/dashboard/telemetry/${mcpServerData.id}`}>
                    View Analytics
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* API Key Management - Only show if telemetry is enabled */}
        {mcpServerData.telemetryEnabled && (
          <Card>
            <CardContent className="p-6">
              <ApiKeyManagement
                serverId={mcpServerData.id}
                serverSlug={mcpServerData.slug}
              />
            </CardContent>
          </Card>
        )}
      </div>
    )
  } catch (error) {
    console.error('Failed to load MCP server:', error)
    notFound()
  }
}

export default async function McpServerDetailsPage({ params }: McpServerDetailsPageProps) {
  const { id } = await params
  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="h-8 bg-muted rounded-md animate-pulse" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-20 bg-muted rounded-md animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-64 bg-muted rounded-md animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        }
      >
        <McpServerDetailsContent serverId={id} />
      </Suspense>
    </div>
  )
}