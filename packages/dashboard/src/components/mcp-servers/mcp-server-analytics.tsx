'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  Activity,
  Key,
  Shield,
  AlertCircle,
  CheckCircle,
  Calendar
} from 'lucide-react'
import { useState } from 'react'

interface McpServerAnalyticsProps {
  serverId: string
}

export function McpServerAnalytics({ serverId }: McpServerAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('24h')

  // Mock data - in real implementation, fetch from analytics API
  const mockData = {
    requests: {
      total: 0,
      change: 0,
      data: [] as Array<{ time: string; count: number }>
    },
    users: {
      total: 0,
      active: 0,
      newUsers: 0,
      change: 0
    },
    authentication: {
      successful: 0,
      failed: 0,
      successRate: 0
    },
    endpoints: [
      { path: '/oauth/token', requests: 0, avgResponse: 0, status: 'healthy' },
      { path: '/oauth/authorize', requests: 0, avgResponse: 0, status: 'healthy' },
      { path: '/oauth/introspect', requests: 0, avgResponse: 0, status: 'healthy' },
    ],
    clients: {
      total: 0,
      active: 0,
      topClients: [] as Array<{ name: string; requests: number }>
    }
  }

  const timeRangeLabels = {
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days'
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Analytics & Insights</h2>
          <p className="text-muted-foreground text-sm">
            Monitor usage patterns and performance metrics for your MCP server
          </p>
        </div>
        <div className="flex space-x-2">
          {Object.entries(timeRangeLabels).map(([value, label]) => (
            <Button
              key={value}
              variant={timeRange === value ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(value as any)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* No Data State */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Request Activity
          </CardTitle>
          <CardDescription>
            API request volume and trends over {timeRangeLabels[timeRange].toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-medium">No activity data yet</h3>
                <p className="text-sm text-muted-foreground">
                  Once your MCP server receives API calls, you'll see request patterns and trends here.
                </p>
              </div>
              <div className="flex items-center justify-center space-x-4 text-sm">
                <div className="flex items-center text-muted-foreground">
                  <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                  Successful requests
                </div>
                <div className="flex items-center text-muted-foreground">
                  <div className="w-2 h-2 bg-destructive rounded-full mr-2"></div>
                  Failed requests
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              User Analytics
            </CardTitle>
            <CardDescription>
              User authentication and engagement metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{mockData.users.total}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{mockData.users.active}</p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">New users ({timeRangeLabels[timeRange].toLowerCase()})</span>
                <span className="font-medium">{mockData.users.newUsers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">User growth</span>
                <div className="flex items-center">
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-sm font-medium">+{mockData.users.change}%</span>
                </div>
              </div>
            </div>

            {mockData.users.total === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  No users have authenticated yet. Share your OAuth endpoints to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Authentication Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Authentication Health
            </CardTitle>
            <CardDescription>
              OAuth flow success rates and security metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">{mockData.authentication.successRate}%</p>
              <p className="text-sm text-muted-foreground">Success Rate</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground">Successful</span>
                  <span className="font-medium">{mockData.authentication.successful}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full w-0"></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground">Failed</span>
                  <span className="font-medium">{mockData.authentication.failed}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full w-0"></div>
                </div>
              </div>
            </div>

            {mockData.authentication.successful === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  No authentication attempts yet. Authentication metrics will appear here once users start signing in.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Endpoints Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Endpoint Performance
          </CardTitle>
          <CardDescription>
            Response times and status for OAuth endpoints
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockData.endpoints.map((endpoint) => (
              <div key={endpoint.path} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Badge
                    variant={endpoint.status === 'healthy' ? 'default' : 'destructive'}
                    className="w-2 h-2 p-0 rounded-full"
                  >
                    <span className="sr-only">{endpoint.status}</span>
                  </Badge>
                  <code className="text-sm font-mono">{endpoint.path}</code>
                </div>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Activity className="h-3 w-3 mr-1" />
                    <span>{endpoint.requests} requests</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    <span>{endpoint.avgResponse}ms avg</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {mockData.endpoints.every(e => e.requests === 0) && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-medium mb-1">Endpoints Ready</h3>
              <p className="text-sm text-muted-foreground">
                Your OAuth endpoints are configured and ready to receive requests.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OAuth Clients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Key className="h-5 w-5 mr-2" />
            OAuth Clients
          </CardTitle>
          <CardDescription>
            Registered clients and their usage patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">{mockData.clients.total}</p>
              <p className="text-sm text-muted-foreground">Total Clients</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">{mockData.clients.active}</p>
              <p className="text-sm text-muted-foreground">Active Clients</p>
            </div>
          </div>

          {mockData.clients.total === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">No OAuth clients registered</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Clients will appear here once they register using your registration endpoint.
              </p>
              <div className="text-center">
                <code className="text-xs bg-muted p-2 rounded inline-block">
                  POST {serverId}/oauth/register
                </code>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="font-medium">Top Active Clients</h4>
              {mockData.clients.topClients.map((client, index) => (
                <div key={client.name} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm font-medium">{client.name}</span>
                  <span className="text-sm text-muted-foreground">{client.requests} requests</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}