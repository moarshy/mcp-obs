import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { requireSession } from '@/lib/auth/session'
import {
  BarChart3,
  Server,
  ArrowLeft,
  Key,
  Globe
} from 'lucide-react'
import Link from 'next/link'
import { TelemetryAnalytics } from '@/components/mcp-servers/telemetry-analytics'

interface TelemetryServerPageProps {
  params: {
    id: string
  }
}

export const metadata = {
  title: 'Server Telemetry | mcp-obs',
  description: 'Detailed telemetry analytics for MCP server',
}

async function TelemetryServerContent({ serverId }: { serverId: string }) {
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
        eq(mcpServer.telemetryEnabled, true) // Only show telemetry page for telemetry-enabled servers
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

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/telemetry">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Telemetry
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                  <BarChart3 className="h-8 w-8" />
                  {mcpServerData.name} Analytics
                </h1>
                <div className="flex items-center space-x-4 text-muted-foreground">
                  <div className="flex items-center">
                    <Globe className="h-4 w-4 mr-1" />
                    <code className="text-sm">{mcpServerData.slug}</code>
                  </div>
                  <div className="flex items-center">
                    <Server className="h-4 w-4 mr-1" />
                    Created {new Date(mcpServerData.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={mcpServerData.enabled ? "default" : "secondary"} className="h-8">
              {mcpServerData.enabled ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline" className="text-green-600 h-8">
              <BarChart3 className="h-3 w-3 mr-1" />
              Telemetry Enabled
            </Badge>
          </div>
        </div>

        {/* Telemetry Analytics */}
        <TelemetryAnalytics
          serverId={mcpServerData.id}
          serverSlug={mcpServerData.slug}
          telemetryEnabled={true}
        />
      </div>
    )
  } catch (error) {
    console.error('Failed to load MCP server telemetry:', error)
    notFound()
  }
}

export default async function TelemetryServerPage({ params }: TelemetryServerPageProps) {
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
          </div>
        }
      >
        <TelemetryServerContent serverId={id} />
      </Suspense>
    </div>
  )
}