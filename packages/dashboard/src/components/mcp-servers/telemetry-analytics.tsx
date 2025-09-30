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
import { useState } from 'react'

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

  // Mock telemetry data - in real implementation, fetch from getTelemetryAnalyticsAction
  const mockTelemetryData: TelemetryStats = {
    summary: {
      totalCalls: 1247,
      avgLatency: 156,
      errorRate: 2.3,
      activeUsers: 23,
    },
    topTools: [
      { name: 'get_api_docs', calls: 456, avgLatency: 142, errorRate: 1.2 },
      { name: 'search_endpoints', calls: 321, avgLatency: 203, errorRate: 0.8 },
      { name: 'get_examples', calls: 289, avgLatency: 98, errorRate: 4.1 },
      { name: 'validate_schema', calls: 181, avgLatency: 267, errorRate: 3.7 },
    ],
    latencyPercentiles: {
      p50: 142,
      p95: 456,
      p99: 723,
    },
    timeSeries: [
      // Mock time series data
      { timestamp: '00:00', calls: 45, latency: 156, errors: 1 },
      { timestamp: '01:00', calls: 32, latency: 143, errors: 0 },
      { timestamp: '02:00', calls: 28, latency: 167, errors: 1 },
      // ... more data points
    ]
  }

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
                <p className="text-2xl font-bold">{mockTelemetryData.summary.totalCalls.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12% from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Latency</p>
                <p className="text-2xl font-bold">{mockTelemetryData.summary.avgLatency}ms</p>
              </div>
              <Timer className="h-8 w-8 text-orange-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-green-600">
              <TrendingDown className="h-3 w-3 mr-1" />
              -8ms from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold">{mockTelemetryData.summary.errorRate}%</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-red-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +0.3% from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{mockTelemetryData.summary.activeUsers}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +5 from last period
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
              {mockTelemetryData.topTools.map((tool, index) => (
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
                      style={{ width: `${(tool.calls / mockTelemetryData.topTools[0].calls) * 100}%` }}
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
                  <span className="text-sm font-medium">{mockTelemetryData.latencyPercentiles.p50}ms</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">95th percentile</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-muted h-2 rounded overflow-hidden">
                    <div className="h-full bg-yellow-500 w-[70%]" />
                  </div>
                  <span className="text-sm font-medium">{mockTelemetryData.latencyPercentiles.p95}ms</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">99th percentile</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-muted h-2 rounded overflow-hidden">
                    <div className="h-full bg-red-500 w-[90%]" />
                  </div>
                  <span className="text-sm font-medium">{mockTelemetryData.latencyPercentiles.p99}ms</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Key Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Telemetry API Keys
              </CardTitle>
              <CardDescription>Manage API keys for telemetry data export</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              Generate New Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded">mcpobs_live_•••••••••••••••</code>
                  <Badge variant="outline" className="text-green-600">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Default Telemetry API Key • Last used 2 hours ago</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Regenerate</Button>
                <Button variant="outline" size="sm">Revoke</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}