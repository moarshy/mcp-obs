import { type NextRequest, NextResponse } from 'next/server'
import { db, mcpServer } from 'database'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const { slug } = await request.json()

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    // Check if slug contains reserved words
    const reservedSlugs = ['www', 'api', 'admin', 'dashboard', 'app', 'mail', 'ftp', 'blog', 'help', 'support']
    if (reservedSlugs.includes(slug.toLowerCase())) {
      return NextResponse.json({
        available: false,
        slug,
        message: 'This subdomain is reserved. Please choose a different one.'
      })
    }

    // Check if slug already exists
    const existingServer = await db
      .select({ id: mcpServer.id })
      .from(mcpServer)
      .where(eq(mcpServer.slug, slug))
      .limit(1)

    const available = existingServer.length === 0

    return NextResponse.json({
      available,
      slug,
      message: available
        ? 'This subdomain is available!'
        : 'This subdomain is already taken. Please choose a different one.'
    })
  } catch (error) {
    console.error('Error checking MCP server slug availability:', error)
    return NextResponse.json({
      available: false,
      error: 'Error checking slug availability. Please try again.'
    }, { status: 500 })
  }
}