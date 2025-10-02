'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  Server,
  Activity,
  Clock,
  Users,
  Wrench
} from 'lucide-react'

interface OrganizationTelemetryViewProps {
  servers: Array<{
    id: string
    name: string
    slug: string
    enabled: boolean
  }>
}

export function OrganizationTelemetryView({ servers }: OrganizationTelemetryViewProps) {
  const [orgData, setOrgData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [timeRange, setTimeRange] = React.useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h')

  React.useEffect(() => {
    const loadOrgData = async () => {
      setLoading(true)
      try {
        const { getOrganizationTelemetryAction } = await import('@/lib/orpc/actions/telemetry-ingestion')

        const data = await getOrganizationTelemetryAction({ timeRange })

        // Handle oRPC response format
        let analyticsData = data
        if (Array.isArray(data) && data.length >= 2 && data[0] === null && data[1]) {
          analyticsData = data[1]
        }

        setOrgData(analyticsData)
      } catch (error) {
        console.error('Failed to load organization telemetry:', error)
        setOrgData(null)
      } finally {
        setLoading(false)
      }
    }

    loadOrgData()
  }, [timeRange])

  const timeRangeLabels = {
    '1h': 'Last Hour',
    '6h': 'Last 6 Hours',
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days'
  }

  return (
    <div className="space-y-6">
      {/* Time range selector and overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organization Overview</CardTitle>
              <CardDescription>
                Cross-server telemetry analytics • {timeRangeLabels[timeRange]}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {(['1h', '6h', '24h', '7d', '30d'] as const).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                  disabled={loading}
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Overview metrics across all servers */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Servers</p>
                <p className="text-2xl font-bold">{servers.filter(s => s.enabled).length}</p>
              </div>
              <Server className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <span>of {servers.length} total with telemetry</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tool Calls</p>
                <p className="text-2xl font-bold">
                  {loading ? '...' : (orgData?.summary?.totalCalls?.toLocaleString() || '0')}
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <span>across all servers</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold">
                  {loading ? '...' : `${orgData?.summary?.avgLatency || 0}ms`}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <span>average latency</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">
                  {loading ? '...' : (orgData?.summary?.activeUsers || 0)}
                </p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <span>unique users</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top insights */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Most Used Server
            </CardTitle>
            <CardDescription>Server with highest tool call volume</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ) : orgData?.mostUsedServer ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{orgData.mostUsedServer.serverName}</h4>
                  <Badge variant="outline">{orgData.mostUsedServer.calls.toLocaleString()} calls</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{orgData.mostUsedServer.serverSlug}</code>
                  • {orgData.mostUsedServer.avgLatency}ms avg • {orgData.mostUsedServer.errorRate}% errors
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Most Called Tool
            </CardTitle>
            <CardDescription>Tool with highest usage across all servers</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ) : orgData?.mostCalledTool ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{orgData.mostCalledTool.toolName}</h4>
                  <Badge variant="outline">{orgData.mostCalledTool.calls.toLocaleString()} calls</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  From <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{orgData.mostCalledTool.serverSlug}</code>
                  • {orgData.mostCalledTool.avgLatency}ms avg • {orgData.mostCalledTool.errorRate}% errors
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Server selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Individual Server Analytics
          </CardTitle>
          <CardDescription>
            View detailed metrics and tool usage for each MCP server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {servers.map((server) => (
              <div key={server.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${server.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div>
                    <h4 className="font-medium">{server.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{server.slug}</code>
                      <span>•</span>
                      <span>{server.enabled ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={`/dashboard/telemetry/${server.id}`}>
                    <BarChart3 className="h-3 w-3 mr-1.5" />
                    View Details
                  </a>
                </Button>
              </div>
            ))}
          </div>
          {servers.length === 1 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 You have one MCP server with telemetry enabled. Add more servers to see cross-server comparisons in the overview above.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}