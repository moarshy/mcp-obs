import { type NextRequest, NextResponse } from 'next/server'

/**
 * MCP Server Support Ticket Creation API
 *
 * Handles support ticket creation from MCP server SDKs with proper
 * subdomain resolution and organization scoping
 */

async function getMcpServerConfiguration(request: NextRequest) {
  // Dynamic import to prevent bundling issues
  const { db, mcpServer } = await import('database')
  const { eq } = await import('drizzle-orm')

  // Extract subdomain from Host header (following MCPlatform pattern)
  const requestHost = request.headers.get('host') ?? new URL(request.url).host
  const requestHostname = requestHost.split(':')[0] // Remove port

  const isDevelopment = process.env.NODE_ENV === 'development'
  let subdomain = null

  if (isDevelopment) {
    // Development: extract from test.localhost format
    if (requestHostname.includes('.localhost')) {
      subdomain = requestHostname.split('.')[0] // Get first part
    }
  } else {
    // Production: extract from test.mcp-obs.com format
    const baseDomain = 'mcp-obs.com'
    if (requestHostname !== baseDomain && requestHostname !== `www.${baseDomain}`) {
      subdomain = requestHostname.split('.')[0] // Get first part
    }
  }

  if (!subdomain || subdomain.includes('.')) {
    return null
  }

  // Database lookup by subdomain slug
  const servers = await db
    .select()
    .from(mcpServer)
    .where(eq(mcpServer.slug, subdomain))
    .limit(1)

  return servers[0] || null
}

async function validateOAuthToken(request: NextRequest, serverConfig: any) {
  // Extract authorization header
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7) // Remove 'Bearer ' prefix

  try {
    // Use existing token validation from database package
    const { validateAccessToken } = await import('database')
    const validationResult = await validateAccessToken(serverConfig.id, token)

    if (!validationResult.valid) {
      return null
    }

    return {
      mcpUserId: validationResult.user?.id || null,
      sessionId: validationResult.token?.id || null, // Use token ID as session ID
    }
  } catch (error) {
    console.error('Token validation error:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get MCP server configuration using subdomain resolution
    const serverConfig = await getMcpServerConfiguration(request)

    if (!serverConfig) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    // Check if support tool is enabled for this server
    if (!serverConfig.supportToolEnabled) {
      return NextResponse.json(
        { error: 'Support tool is not enabled for this server' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { title, description, category = 'Other' } = body

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    // Validate field lengths
    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be 200 characters or less' },
        { status: 400 }
      )
    }

    if (description.length > 2000) {
      return NextResponse.json(
        { error: 'Description must be 2000 characters or less' },
        { status: 400 }
      )
    }

    // Try OAuth authentication first
    const oauthAuth = await validateOAuthToken(request, serverConfig)

    let mcpUserId = null
    let userEmail = null
    let sessionId = null

    if (oauthAuth) {
      // User is authenticated via OAuth
      mcpUserId = oauthAuth.mcpUserId
      sessionId = oauthAuth.sessionId
    } else {
      // Fallback to email collection for non-OAuth servers
      userEmail = body.userEmail

      if (!userEmail || !isValidEmail(userEmail)) {
        return NextResponse.json(
          { error: 'Valid email address is required when not authenticated' },
          { status: 400 }
        )
      }
    }

    // Capture session context (minimal for MVP)
    const contextData = JSON.stringify({
      toolCall: body.toolCall || null,
      timestamp: Date.now(),
      endpoint: '/api/mcpserver/support',
    })

    // Get user agent
    const userAgent = request.headers.get('user-agent') || ''

    // Create support ticket
    const { db, supportTicket } = await import('database')

    const result = await db.insert(supportTicket).values({
      organizationId: serverConfig.organizationId,
      mcpServerId: serverConfig.id,
      title: title.trim(),
      description: description.trim(),
      category: category,
      mcpUserId: mcpUserId,
      userEmail: userEmail,
      sessionId: sessionId,
      contextData: contextData,
      userAgent: userAgent,
      status: 'open',
      priority: 'normal',
    }).returning()

    const ticket = result[0]

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        title: ticket.title,
        category: ticket.category,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
      message: 'Support ticket created successfully'
    }, {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })

  } catch (error) {
    console.error('Error creating support ticket:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

// Helper function to validate email addresses
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}