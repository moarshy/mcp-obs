import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireSession } from '@/lib/auth/session'
import { Plus, Server, Users, Activity, Settings, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { CreateMcpServerDialog } from '@/components/mcp-servers/create-mcp-server-dialog'
import { DeleteMcpServerDialog } from '@/components/mcp-servers/delete-mcp-server-dialog'
import { EditMcpServerDialog } from '@/components/mcp-servers/edit-mcp-server-dialog'

export const metadata = {
  title: 'MCP Servers | mcp-obs',
  description: 'Manage your MCP servers and view analytics',
}

async function McpServersList() {
  const session = await requireSession()

  try {
    // Get user's organizations
    const { db, mcpServer, member } = await import('database')
    const { eq } = await import('drizzle-orm')

    const userMemberships = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, session.user.id))

    if (userMemberships.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>No Organization Access</CardTitle>
            <CardDescription>
              You don't belong to any organization. Please contact an administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      )
    }

    // Get MCP servers for user's organizations
    const organizationIds = userMemberships.map(m => m.organizationId)

    const mcpServers = await db
      .select()
      .from(mcpServer)
      .where(
        // TODO: Use proper IN clause when available in organizationIds
        eq(mcpServer.organizationId, organizationIds[0])
      )
      .orderBy(mcpServer.createdAt)

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
            <CreateMcpServerDialog>
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
              <CreateMcpServerDialog>
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
                            {server.slug}
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
                        <EditMcpServerDialog mcpServer={server}>
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </EditMcpServerDialog>
                        <DeleteMcpServerDialog
                          serverId={server.id}
                          serverName={server.name}
                        >
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DeleteMcpServerDialog>
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
    console.error('Error loading MCP servers:', error)
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
