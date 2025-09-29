import { NextRequest, NextResponse } from 'next/server'
import { db, mcpServer } from 'database'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json(
        { error: 'Server slug is required' },
        { status: 400 }
      )
    }

    // Get server configuration by slug
    const server = await db
      .select({
        id: mcpServer.id,
        name: mcpServer.name,
        slug: mcpServer.slug,
        description: mcpServer.description,
        supportToolEnabled: mcpServer.supportToolEnabled,
        supportToolTitle: mcpServer.supportToolTitle,
        supportToolDescription: mcpServer.supportToolDescription,
        supportToolCategories: mcpServer.supportToolCategories,
        enabled: mcpServer.enabled,
        allowRegistration: mcpServer.allowRegistration,
        enablePasswordAuth: mcpServer.enablePasswordAuth,
        enableGoogleAuth: mcpServer.enableGoogleAuth,
        enableGithubAuth: mcpServer.enableGithubAuth,
      })
      .from(mcpServer)
      .where(eq(mcpServer.slug, slug))
      .then(rows => rows[0])

    if (!server) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      )
    }

    // Parse support tool categories from JSON string
    let supportToolCategories
    try {
      supportToolCategories = server.supportToolCategories
        ? JSON.parse(server.supportToolCategories)
        : ["Bug Report", "Feature Request", "Documentation", "Other"]
    } catch (error) {
      // Fallback to comma-separated parsing if JSON parsing fails
      supportToolCategories = server.supportToolCategories
        ? server.supportToolCategories.split(',').map((s: string) => s.trim())
        : ["Bug Report", "Feature Request", "Documentation", "Other"]
    }

    return NextResponse.json({
      id: server.id,
      name: server.name,
      slug: server.slug,
      description: server.description,
      supportToolEnabled: server.supportToolEnabled,
      supportToolTitle: server.supportToolTitle || 'Get Support',
      supportToolDescription: server.supportToolDescription || 'Report issues or ask questions',
      supportToolCategories: supportToolCategories,
      authEnabled: server.enabled,
      allowRegistration: server.allowRegistration,
      enablePasswordAuth: server.enablePasswordAuth,
      enableGoogleAuth: server.enableGoogleAuth,
      enableGithubAuth: server.enableGithubAuth,
    })

  } catch (error) {
    console.error('Error fetching server config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}