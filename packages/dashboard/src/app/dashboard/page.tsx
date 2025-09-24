import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getServerSession } from '@/lib/auth'

export const metadata = {
  title: 'Dashboard | mcp-obs',
  description: 'mcp-obs dashboard for managing MCP servers and organizations',
}

export default async function DashboardPage() {
  const { user } = await getServerSession()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Welcome back, {user?.name || user?.email}! Manage your MCP servers and organization here.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>MCP Servers</CardTitle>
            <CardDescription>
              Registered MCP servers in your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-gray-500 mt-1">
              No servers registered yet
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>
              Current authenticated sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-gray-500 mt-1">
              No active sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Requests</CardTitle>
            <CardDescription>
              Total API requests this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-gray-500 mt-1">
              No requests yet
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Follow these steps to set up your first MCP server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              1
            </div>
            <div>
              <h3 className="font-medium">Install the mcp-obs Server SDK</h3>
              <p className="text-sm text-gray-600 mt-1">
                Add authentication and observability to your MCP server with our SDK
              </p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 block">
                npm install @mcp-obs/server-sdk
              </code>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              2
            </div>
            <div>
              <h3 className="font-medium">Register Your MCP Server</h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure your server settings and get your authentication keys
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              3
            </div>
            <div>
              <h3 className="font-medium">Start Monitoring</h3>
              <p className="text-sm text-gray-600 mt-1">
                View real-time analytics, user sessions, and performance metrics
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}