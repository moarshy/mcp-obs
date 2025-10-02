import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireSession } from '@/lib/auth/session'
import {
  BarChart3,
  Server,
  Activity,
  Clock,
  Users,
  TrendingUp
} from 'lucide-react'
import { OrganizationTelemetryView } from '@/components/telemetry/organization-telemetry-view'

export const metadata = {
  title: 'Telemetry | mcp-obs',
  description: 'Monitor telemetry and analytics across all your MCP servers',
}

async function TelemetryPageContent() {
  const session = await requireSession()

  try {
    // Get all MCP servers with telemetry enabled for this user's organization
    const { db, mcpServer, member } = await import('database')
    const { eq, and } = await import('drizzle-orm')

    // Get user's organization
    const userMemberships = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, session.user.id))

    if (userMemberships.length === 0) {
      return (
        <div className="space-y-6">
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Organization Found</h3>
            <p className="text-muted-foreground">You need to be part of an organization to view telemetry data.</p>
          </div>
        </div>
      )
    }

    const organizationId = userMemberships[0].organizationId

    // Get all MCP servers for this organization with telemetry enabled
    const servers = await db
      .select({
        id: mcpServer.id,
        name: mcpServer.name,
        slug: mcpServer.slug,
        telemetryEnabled: mcpServer.telemetryEnabled,
        createdAt: mcpServer.createdAt,
        enabled: mcpServer.enabled
      })
      .from(mcpServer)
      .where(and(
        eq(mcpServer.organizationId, organizationId),
        eq(mcpServer.telemetryEnabled, true)
      ))

    console.log('Telemetry-enabled servers:', servers)

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <BarChart3 className="h-8 w-8" />
              Telemetry & Analytics
            </h1>
            <p className="text-muted-foreground">
              Monitor performance, usage, and insights across all your MCP servers
            </p>
          </div>
        </div>

        {servers.length === 0 ? (
          // No servers with telemetry enabled
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                No Telemetry Data Available
              </CardTitle>
              <CardDescription>
                Enable telemetry on your MCP servers to see analytics and performance data
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              <div className="flex flex-col items-center gap-4">
                <BarChart3 className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-medium">Get Started with Telemetry</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    To see telemetry data here, enable OpenTelemetry when creating or editing your MCP servers.
                    This will provide detailed insights into tool usage, performance metrics, and user behavior.
                  </p>
                </div>
                <Button asChild>
                  <a href="/dashboard/mcp-servers">
                    <Server className="h-4 w-4 mr-2" />
                    Manage MCP Servers
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Always show organization overview with server selection
          <OrganizationTelemetryView servers={servers} />
        )}
      </div>
    )
  } catch (error) {
    console.error('Failed to load telemetry page:', error)
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Telemetry</CardTitle>
            <CardDescription>
              Failed to load telemetry data. Please try refreshing the page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }
}

export default async function TelemetryPage() {
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
          </div>
        }
      >
        <TelemetryPageContent />
      </Suspense>
    </div>
  )
}