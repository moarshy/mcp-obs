import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireSession } from '@/lib/auth'
import { TrendingUp, TrendingDown, Plus } from 'lucide-react'

export const metadata = {
  title: 'Dashboard | mcp-obs',
  description: 'mcp-obs dashboard for managing MCP servers and organizations',
}

export default async function DashboardPage() {
  const { user } = await requireSession({ organizationRequired: true })

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">MCP Tool Calls</p>
                <div className="flex items-center mt-2">
                  <p className="text-3xl font-bold text-white">107</p>
                  <div className="flex items-center ml-2 text-green-500">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    <span className="text-sm">+12.5%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Trending up this month</p>
                <p className="text-xs text-gray-400">Tool calls for the last 6 months</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Support Tickets</p>
                <div className="flex items-center mt-2">
                  <p className="text-3xl font-bold text-white">5</p>
                  <div className="flex items-center ml-2 text-red-500">
                    <TrendingDown className="h-4 w-4 mr-1" />
                    <span className="text-sm">-20%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Down 20% this period</p>
                <p className="text-xs text-gray-400">Acquisition needs attention</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Active Users</p>
                <div className="flex items-center mt-2">
                  <p className="text-3xl font-bold text-white">2</p>
                  <div className="flex items-center ml-2 text-green-500">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    <span className="text-sm">+12.5%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Strong user retention</p>
                <p className="text-xs text-gray-400">Engagement exceed targets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Quick Actions</p>
                <div className="flex items-center mt-2">
                  <p className="text-3xl font-bold text-white">1</p>
                  <div className="flex items-center ml-2 text-gray-400">
                    <span className="text-sm">Available</span>
                  </div>
                </div>
                <Button size="sm" className="mt-2 bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Server
                </Button>
                <p className="text-xs text-gray-400 mt-1">Create new resources</p>
                <p className="text-xs text-gray-400">Quickly create new resources for your organization</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MCP Activity Chart */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">MCP Activity</CardTitle>
              <CardDescription className="text-gray-400">No MCP activity data available</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" className="text-gray-400 border-gray-600 hover:bg-gray-700">
                Past hour
              </Button>
              <Button variant="outline" size="sm" className="text-gray-400 border-gray-600 hover:bg-gray-700">
                Past day
              </Button>
              <Button variant="outline" size="sm" className="text-gray-400 border-gray-600 hover:bg-gray-700 bg-gray-700">
                Past week
              </Button>
              <Button variant="outline" size="sm" className="text-gray-400 border-gray-600 hover:bg-gray-700">
                Past month
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400">No tool calls or connections recorded yet</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}