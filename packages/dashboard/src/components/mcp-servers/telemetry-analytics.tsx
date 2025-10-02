'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  BarChart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Activity,
  Zap,
  AlertCircle,
  CheckCircle,
  Target,
  Timer,
  Database
} from 'lucide-react'
import React, { useState } from 'react'

interface TelemetryAnalyticsProps {
  serverId: string
  serverSlug: string
  telemetryEnabled: boolean
}

interface TelemetryStats {
  summary: {
    totalCalls: number
    avgLatency: number
    errorRate: number
    activeUsers: number
  }
  topTools: Array<{
    name: string
    calls: number
    avgLatency: number
    errorRate: number
  }>
  latencyPercentiles: {
    p50: number
    p95: number
    p99: number
  }
  timeSeries: Array<{
    timestamp: string
    calls: number
    latency: number
    errors: number
  }>
}

export function TelemetryAnalytics({ serverId, serverSlug, telemetryEnabled }: TelemetryAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h')
  const [loading, setLoading] = useState(false)
  const [telemetryData, setTelemetryData] = useState<TelemetryStats | null>(null)

  // Load telemetry data
  const loadTelemetryData = async () => {
    setLoading(true)
    try {
      // Import the action dynamically
      const { getTelemetryAnalyticsAction } = await import('@/lib/orpc/actions/telemetry-ingestion')

      // Fetch real data from the database
      const data = await getTelemetryAnalyticsAction({
        mcpServerId: serverId,
        timeRange
      })

      // Handle oRPC response format
      let analyticsData = data
      if (Array.isArray(data) && data.length >= 2 && data[0] === null && data[1]) {
        analyticsData = data[1]
      }

      if (analyticsData) {
        setTelemetryData(analyticsData)
      } else {
        setTelemetryData(null)
      }
    } catch (error) {
      console.error('Failed to load telemetry data:', error)
      setTelemetryData(null)
    } finally {
      setLoading(false)
    }
  }

  // Load data when component mounts or time range changes
  React.useEffect(() => {
    if (telemetryEnabled) {
      loadTelemetryData()
    }
  }, [telemetryEnabled, timeRange, serverId])

  const timeRangeLabels = {
    '1h': 'Last Hour',
    '6h': 'Last 6 Hours',
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days'
  }

  if (!telemetryEnabled) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Telemetry Analytics
              </CardTitle>
              <CardDescription>
                Real-time observability and performance insights for your MCP server
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              Disabled
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="flex flex-col items-center gap-4">
            <BarChart3 className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">Telemetry Not Enabled</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Enable telemetry to see detailed analytics about tool usage, performance metrics,
                and user behavior for your MCP server.
              </p>
            </div>
            <Button variant="outline" size="sm">
              Configure Telemetry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Telemetry Analytics
          </CardTitle>
          <CardDescription>Loading telemetry data...</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current mr-3"></div>
            Loading analytics data...
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show empty state if no data available
  if (!telemetryData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Telemetry Analytics
              </CardTitle>
              <CardDescription>
                Real-time observability for {serverSlug} • {timeRangeLabels[timeRange]}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
              <div className="flex gap-1">
                {(['1h', '6h', '24h', '7d', '30d'] as const).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="flex flex-col items-center gap-4">
            <BarChart3 className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">No Data Available</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                No telemetry data has been collected yet. Once your MCP server starts receiving
                requests with telemetry enabled, analytics will appear here.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadTelemetryData}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Telemetry Analytics
              </CardTitle>
              <CardDescription>
                Real-time observability for {serverSlug} • {timeRangeLabels[timeRange]}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
              <div className="flex gap-1">
                {(['1h', '6h', '24h', '7d', '30d'] as const).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tool Calls</p>
                <p className="text-2xl font-bold">{telemetryData?.summary?.totalCalls?.toLocaleString() || '0'}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <span>tool executions</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Latency</p>
                <p className="text-2xl font-bold">{telemetryData?.summary?.avgLatency || 0}ms</p>
              </div>
              <Timer className="h-8 w-8 text-orange-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <span>average response time</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold">{telemetryData?.summary?.errorRate || 0}%</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <span>error percentage</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{telemetryData?.summary?.activeUsers || 0}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <span>unique users</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Tools */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Top Tools
            </CardTitle>
            <CardDescription>Most frequently used tools in your MCP server</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(telemetryData?.topTools || []).map((tool, index) => (
                <div key={tool.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">#{index + 1}</span>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{tool.name}</code>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{tool.calls} calls</span>
                      <span>{tool.avgLatency}ms avg</span>
                      <Badge variant={tool.errorRate > 3 ? 'destructive' : 'outline'} className="text-xs">
                        {tool.errorRate}% errors
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full bg-muted h-2 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${(tool.calls / (telemetryData?.topTools?.[0]?.calls || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Latency Percentiles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Latency Distribution
            </CardTitle>
            <CardDescription>Response time percentiles for tool calls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">50th percentile (median)</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-muted h-2 rounded overflow-hidden">
                    <div className="h-full bg-green-500 w-[30%]" />
                  </div>
                  <span className="text-sm font-medium">{telemetryData?.latencyPercentiles?.p50 || 0}ms</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">95th percentile</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-muted h-2 rounded overflow-hidden">
                    <div className="h-full bg-yellow-500 w-[70%]" />
                  </div>
                  <span className="text-sm font-medium">{telemetryData?.latencyPercentiles?.p95 || 0}ms</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">99th percentile</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-muted h-2 rounded overflow-hidden">
                    <div className="h-full bg-red-500 w-[90%]" />
                  </div>
                  <span className="text-sm font-medium">{telemetryData?.latencyPercentiles?.p99 || 0}ms</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}