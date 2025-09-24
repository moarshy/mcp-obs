import { type NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { auth } from '@/lib/auth'
import { z } from 'zod'

// Organization creation schema
const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
})

async function handler(request: NextRequest) {
  try {
    const { user, session } = await getServerSession()

    if (!user || !session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (request.method === 'POST') {
      const body = await request.json()

      // Handle oRPC-style calls
      if (body.method === 'auth.createOrganization') {
        try {
          const validatedData = createOrganizationSchema.parse(body.params)

          // Create organization using Better Auth
          const organization = await auth.api.createOrganization({
            name: validatedData.name,
            slug: validatedData.slug,
            userId: user.id,
          })

          return NextResponse.json({
            data: organization,
            error: null
          })
        } catch (error) {
          console.error('Error creating organization:', error)

          if (error instanceof z.ZodError) {
            return NextResponse.json({
              error: { message: 'Invalid input data', details: error.errors }
            }, { status: 400 })
          }

          return NextResponse.json({
            error: { message: error instanceof Error ? error.message : 'Failed to create organization' }
          }, { status: 400 })
        }
      }
    }

    // Default response for unhandled methods/paths
    return NextResponse.json({
      error: 'Method not supported',
      availableMethods: ['POST'],
      availableEndpoints: ['auth.createOrganization']
    }, { status: 405 })

  } catch (error) {
    console.error('RPC handler error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export { handler as GET, handler as POST }