'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface TicketPaginationProps {
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export function TicketPagination({ pagination }: TicketPaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const navigateToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page === 1) {
      params.delete('page')
    } else {
      params.set('page', page.toString())
    }
    router.push(`/dashboard/support-tickets?${params.toString()}`)
  }

  if (pagination.pages <= 1) {
    return null
  }

  // Generate page numbers to show
  const getVisiblePages = () => {
    const delta = 2 // Show 2 pages before and after current
    const range = []
    const rangeWithDots = []

    for (
      let i = Math.max(2, pagination.page - delta);
      i <= Math.min(pagination.pages - 1, pagination.page + delta);
      i++
    ) {
      range.push(i)
    }

    if (pagination.page - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (pagination.page + delta < pagination.pages - 1) {
      rangeWithDots.push('...', pagination.pages)
    } else if (pagination.pages > 1) {
      rangeWithDots.push(pagination.pages)
    }

    return rangeWithDots
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} tickets
          </p>
          <div className="flex items-center gap-1">
            {pagination.page > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToPage(pagination.page - 1)}
              >
                <ChevronLeft className="h-3 w-3 mr-1" />
                Previous
              </Button>
            )}

            {getVisiblePages().map((page, index) => (
              <Button
                key={index}
                variant={page === pagination.page ? 'default' : 'outline'}
                size="sm"
                className="min-w-[32px]"
                onClick={() => typeof page === 'number' ? navigateToPage(page) : undefined}
                disabled={typeof page !== 'number'}
              >
                {page}
              </Button>
            ))}

            {pagination.page < pagination.pages && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToPage(pagination.page + 1)}
              >
                Next
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}