import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { name, slug } = await request.json()

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    // Use Better Auth API to create organization
    const organization = await auth.api.createOrganization({
      name,
      slug,
    }, {
      headers: request.headers
    })

    return NextResponse.json({
      success: true,
      organization
    })
  } catch (error) {
    console.error('Error creating organization:', error)

    // Check for unique constraint violation on slug
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return NextResponse.json({
        error: 'Organization slug already exists'
      }, { status: 409 })
    }

    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}