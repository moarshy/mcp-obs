import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireSession } from '@/lib/auth'
import { orpcServer } from '@/lib/orpc/server'
import { Plus, Server, Users, Activity, Settings, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { CreateMcpServerDialog } from '@/components/mcp-servers/create-mcp-server-dialog'

export const metadata = {
  title: 'MCP Servers | mcp-obs',
  description: 'Manage your MCP servers and view analytics',
}

async function McpServersList() {
  const { organization } = await requireSession({ organizationRequired: true })

  try {
    const mcpServers = await orpcServer.mcp.listMcpServers({
      organizationId: organization.id
    })

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>MCP Servers</CardTitle>
              <CardDescription>
                Manage and monitor your MCP servers and their configurations
              </CardDescription>
            </div>
            <CreateMcpServerDialog organizationId={organization.id}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Server
              </Button>
            </CreateMcpServerDialog>
          </div>
        </CardHeader>
        <CardContent>
          {mcpServers.length === 0 ? (
            <div className="text-center py-12">
              <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No MCP servers yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first MCP server to enable authentication and analytics for your users.
              </p>
              <CreateMcpServerDialog organizationId={organization.id}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create MCP Server
                </Button>
              </CreateMcpServerDialog>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name & URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Requests (24h)</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mcpServers.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Server className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{server.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {process.env.NODE_ENV === 'development'
                              ? `localhost:3000?mcp_server=${server.id}`
                              : `${server.slug}.mcp-obs.com`
                            }
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={server.enabled ? "default" : "secondary"}>
                        {server.enabled ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>0</span> {/* TODO: Add actual user count from analytics */}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span>0</span> {/* TODO: Add actual request count from analytics */}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(server.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link href={`/dashboard/mcp-servers/${server.id}`}>
                          <Button variant="ghost" size="sm">
                            <Activity className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    )
  } catch (error) {
    console.error('Failed to load MCP servers:', error)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error loading MCP servers</CardTitle>
          <CardDescription>
            Failed to load your MCP servers. Please try again later.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }
}

export default function McpServersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Servers</h1>
          <p className="text-muted-foreground">
            Manage authentication and analytics for your MCP servers
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        }
      >
        <McpServersList />
      </Suspense>
    </div>
  )
}