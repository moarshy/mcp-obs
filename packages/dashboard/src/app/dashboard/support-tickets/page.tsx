import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, Clock, CheckCircle, AlertCircle, User, Mail, Calendar } from 'lucide-react'
import { getSupportTicketsAction, getMcpServersAction } from '@/lib/orpc/actions/support-tickets'
import { TicketFilters } from '@/components/support-tickets/ticket-filters'
import { TicketPagination } from '@/components/support-tickets/ticket-pagination'

interface SupportTicketsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Server Component for data fetching
async function SupportTicketsContent({ searchParams }: SupportTicketsPageProps) {
  const params = await searchParams

  const status = Array.isArray(params.status)
    ? params.status[0]
    : params.status as 'open' | 'in_progress' | 'closed' | undefined

  const category = Array.isArray(params.category)
    ? params.category[0]
    : params.category as string | undefined

  const mcpServerId = Array.isArray(params.mcpServerId)
    ? params.mcpServerId[0]
    : params.mcpServerId as string | undefined

  const search = Array.isArray(params.search)
    ? params.search[0]
    : params.search as string | undefined

  const page = parseInt(Array.isArray(params.page) ? params.page[0] : params.page || '1')

  try {
    // Fetch tickets and MCP servers in parallel
    const [rawResult, mcpServersRaw] = await Promise.all([
      getSupportTicketsAction({
        status,
        category,
        mcpServerId,
        search,
        page,
        limit: 20
      }),
      getMcpServersAction({})
    ])

    // Handle the case where oRPC might return [null, actualData] format
    let result = rawResult
    if (Array.isArray(rawResult) && rawResult.length >= 2 && rawResult[0] === null && rawResult[1]) {
      result = rawResult[1]
    }

    let mcpServers = mcpServersRaw
    if (Array.isArray(mcpServersRaw) && mcpServersRaw.length >= 2 && mcpServersRaw[0] === null && mcpServersRaw[1]) {
      mcpServers = mcpServersRaw[1]
    }

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
        <TicketFilters mcpServers={mcpServers || []} />

        {/* Search Results Summary */}
        {(search || status || category || mcpServerId) && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {pagination.total} ticket{pagination.total !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
              {(status && status !== 'all') && ` with status "${status}"`}
              {(category && category !== 'all') && ` in category "${category}"`}
            </div>
          </div>
        )}

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
                        {ticket.mcpServerName || 'Unknown Server'}
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
        <TicketPagination pagination={pagination} />
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

export default async function SupportTicketsPage({ searchParams }: SupportTicketsPageProps) {
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