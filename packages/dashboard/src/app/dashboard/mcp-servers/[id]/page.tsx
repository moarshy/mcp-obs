import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { requireSession } from '@/lib/auth'
import { orpcServer } from '@/lib/orpc/server'
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
import { McpServerAnalytics } from '@/components/mcp-servers/mcp-server-analytics'
import { McpServerSettings } from '@/components/mcp-servers/mcp-server-settings'
import { EditMcpServerDialog } from '@/components/mcp-servers/edit-mcp-server-dialog'

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
  const { organization } = await requireSession({ organizationRequired: true })

  try {
    const mcpServer = await orpcServer.mcp.getMcpServer({ id: serverId })

    // Verify the server belongs to the current organization
    if (mcpServer.organizationId !== organization.id) {
      notFound()
    }

    const serverUrl = process.env.NODE_ENV === 'development'
      ? `localhost:3000?mcp_server=${mcpServer.id}`
      : `${mcpServer.slug}.mcp-obs.com`

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
                <h1 className="text-3xl font-bold tracking-tight">{mcpServer.name}</h1>
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
                    Created {new Date(mcpServer.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <EditMcpServerDialog mcpServer={mcpServer}>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Edit Server
              </Button>
            </EditMcpServerDialog>
            <Badge variant={mcpServer.enabled ? "default" : "secondary"} className="h-8">
              {mcpServer.enabled ? "Active" : "Inactive"}
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
                  <Badge variant={mcpServer.enabled ? "default" : "secondary"} className="mt-1">
                    {mcpServer.enabled ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Registration</p>
                  <Badge variant={mcpServer.allowRegistration ? "default" : "secondary"} className="mt-1">
                    {mcpServer.allowRegistration ? "Allowed" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email Verification</p>
                  <Badge variant={mcpServer.requireEmailVerification ? "default" : "secondary"} className="mt-1">
                    {mcpServer.requireEmailVerification ? "Required" : "Optional"}
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
                  {mcpServer.enablePasswordAuth && (
                    <Badge variant="outline">Email & Password</Badge>
                  )}
                  {mcpServer.enableGoogleAuth && (
                    <Badge variant="outline">Google OAuth</Badge>
                  )}
                  {mcpServer.enableGithubAuth && (
                    <Badge variant="outline">GitHub OAuth</Badge>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Access Token TTL</p>
                  <p>{Math.floor(mcpServer.accessTokenExpiration / 3600)}h {Math.floor((mcpServer.accessTokenExpiration % 3600) / 60)}m</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Refresh Token TTL</p>
                  <p>{Math.floor(mcpServer.refreshTokenExpiration / 86400)}d</p>
                </div>
              </div>

              {mcpServer.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{mcpServer.description}</p>
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
                  {mcpServer.authorizationEndpoint}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Token</p>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {mcpServer.tokenEndpoint}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Registration</p>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {mcpServer.registrationEndpoint}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Introspection</p>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {mcpServer.introspectionEndpoint}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Revocation</p>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {mcpServer.revocationEndpoint}
                </code>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Well-known configuration</span>
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={`${mcpServer.issuerUrl}/.well-known/oauth-authorization-server`}
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

        {/* Analytics Section */}
        <McpServerAnalytics serverId={mcpServer.id} />
      </div>
    )
  } catch (error) {
    console.error('Failed to load MCP server:', error)
    notFound()
  }
}

export default function McpServerDetailsPage({ params }: McpServerDetailsPageProps) {
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
        <McpServerDetailsContent serverId={params.id} />
      </Suspense>
    </div>
  )
}