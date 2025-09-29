import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageSquare, Clock, CheckCircle, AlertCircle, User, Mail, Calendar } from 'lucide-react'
import { getSupportTicketsAction } from '@/lib/orpc/actions/support-tickets'

interface SupportTicketsPageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

// Server Component for data fetching
async function SupportTicketsContent({ searchParams }: SupportTicketsPageProps) {
  const status = Array.isArray(searchParams.status)
    ? searchParams.status[0]
    : searchParams.status as 'open' | 'in_progress' | 'closed' | undefined

  const category = Array.isArray(searchParams.category)
    ? searchParams.category[0]
    : searchParams.category as string | undefined

  const page = parseInt(Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page || '1')

  try {
    const result = await getSupportTicketsAction({
      status,
      category,
      page,
      limit: 20
    })

    if (!result || !result.tickets) {
      return (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No support tickets found.</p>
            </div>
          </CardContent>
        </Card>
      )
    }

    const { tickets, pagination } = result

    return (
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Select defaultValue={status || "all"}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue={category || "all"}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Bug Report">Bug Report</SelectItem>
                  <SelectItem value="Feature Request">Feature Request</SelectItem>
                  <SelectItem value="Documentation">Documentation</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Search tickets..."
                className="flex-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      <a href={`/dashboard/support-tickets/${ticket.id}`} className="hover:underline">
                        {ticket.title}
                      </a>
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {ticket.mcpServerName}
                      </div>
                      {ticket.mcpUserId ? (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          User ID: {ticket.mcpUserId.substring(0, 8)}...
                        </div>
                      ) : ticket.userEmail ? (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {ticket.userEmail}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      ticket.status === 'open' ? 'destructive' :
                      ticket.status === 'in_progress' ? 'default' :
                      'secondary'
                    }>
                      {ticket.status === 'open' && <AlertCircle className="h-3 w-3 mr-1" />}
                      {ticket.status === 'in_progress' && <Clock className="h-3 w-3 mr-1" />}
                      {ticket.status === 'closed' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline">
                      {ticket.category}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {ticket.description}
                </p>
              </CardContent>
            </Card>
          ))}

          {tickets.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No support tickets match your current filters.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} tickets
                </p>
                <div className="flex gap-2">
                  {pagination.page > 1 && (
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  )}
                  {pagination.page < pagination.pages && (
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  } catch (error) {
    console.error('Error fetching support tickets:', error)
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="mx-auto h-12 w-12 mb-4 text-destructive opacity-50" />
            <p>Failed to load support tickets.</p>
            <p className="text-xs">Please try again later.</p>
          </div>
        </CardContent>
      </Card>
    )
  }
}

export default function SupportTicketsPage({ searchParams }: SupportTicketsPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
        <p className="text-muted-foreground">
          Manage support requests from your MCP server users
        </p>
      </div>

      <Suspense fallback={
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      }>
        <SupportTicketsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}