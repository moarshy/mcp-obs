import { type NextRequest, NextResponse } from 'next/server'
import { db } from 'database'
import { organization } from 'database/src/auth-schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const { slug } = await request.json()

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    // Check if slug already exists
    const existingOrg = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug))
      .limit(1)

    const available = existingOrg.length === 0

    return NextResponse.json({ available, slug })
  } catch (error) {
    console.error('Error checking slug availability:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}