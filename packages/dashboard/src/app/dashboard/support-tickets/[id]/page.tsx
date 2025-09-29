import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Calendar, Clock, CheckCircle, AlertCircle, User, Mail, Server, Code } from 'lucide-react'
import { getSupportTicketByIdAction, updateSupportTicketStatusAction } from '@/lib/orpc/actions/support-tickets'
import Link from 'next/link'

interface SupportTicketDetailsPageProps {
  params: Promise<{ id: string }>
}

// Server Component for data fetching
async function SupportTicketDetailsContent({ ticketId }: { ticketId: string }) {
  try {
    const ticket = await getSupportTicketByIdAction({ id: ticketId })

    if (!ticket) {
      notFound()
    }

    const statusColors = {
      open: 'destructive',
      in_progress: 'default',
      closed: 'secondary'
    } as const

    const statusIcons = {
      open: AlertCircle,
      in_progress: Clock,
      closed: CheckCircle
    }

    const StatusIcon = statusIcons[ticket.status as keyof typeof statusIcons]

    // Parse context data if available
    let contextData = null
    try {
      contextData = ticket.contextData ? JSON.parse(ticket.contextData) : null
    } catch (error) {
      console.error('Failed to parse context data:', error)
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard/support-tickets">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tickets
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{ticket.title}</h1>
            <p className="text-muted-foreground">
              Ticket #{ticket.id.substring(0, 8)} • {ticket.mcpServerName}
            </p>
          </div>
          <Badge variant={statusColors[ticket.status as keyof typeof statusColors]}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {ticket.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                    {ticket.description}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Session Context */}
            {contextData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Session Context
                  </CardTitle>
                  <CardDescription>
                    Technical details captured when the ticket was created
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg p-4">
                    <pre className="text-xs text-muted-foreground overflow-x-auto">
                      {JSON.stringify(contextData, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Management */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form action={updateSupportTicketStatusAction}>
                  <input type="hidden" name="id" value={ticket.id} />
                  <Select name="status" defaultValue={ticket.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-3 w-3" />
                          Open
                        </div>
                      </SelectItem>
                      <SelectItem value="in_progress">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          In Progress
                        </div>
                      </SelectItem>
                      <SelectItem value="closed">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3" />
                          Closed
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" className="w-full mt-2">
                    Update Status
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Ticket Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Created</p>
                    <p className="text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {ticket.updatedAt !== ticket.createdAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Last Updated</p>
                      <p className="text-muted-foreground">
                        {new Date(ticket.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                {ticket.closedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Closed</p>
                      <p className="text-muted-foreground">
                        {new Date(ticket.closedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">MCP Server</p>
                    <p className="text-muted-foreground">
                      {ticket.mcpServerName} ({ticket.mcpServerSlug})
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className="w-fit">
                  {ticket.category}
                </Badge>

                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">User Information</p>
                  {ticket.mcpUserId ? (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        User ID: {ticket.mcpUserId}
                      </span>
                    </div>
                  ) : ticket.userEmail ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {ticket.userEmail}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No user information available
                    </p>
                  )}
                </div>

                {ticket.userAgent && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium mb-1">User Agent</p>
                    <p className="text-xs text-muted-foreground break-all">
                      {ticket.userAgent}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error fetching support ticket:', error)
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="mx-auto h-12 w-12 mb-4 text-destructive opacity-50" />
              <p className="font-medium">Failed to load ticket</p>
              <p className="text-sm">Please try again later or check the ticket ID.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}

export default async function SupportTicketDetailsPage({ params }: SupportTicketDetailsPageProps) {
  const { id } = await params

  return (
    <Suspense fallback={
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-9 w-32 bg-muted rounded animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-8 bg-muted rounded w-1/2 animate-pulse" />
            <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
          </div>
          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="h-6 bg-muted rounded w-24 animate-pulse" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="h-6 bg-muted rounded w-16 animate-pulse" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-10 bg-muted rounded animate-pulse" />
                <div className="h-9 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    }>
      <SupportTicketDetailsContent ticketId={id} />
    </Suspense>
  )
}