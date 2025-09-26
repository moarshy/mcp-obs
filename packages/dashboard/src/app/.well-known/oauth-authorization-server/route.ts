import { NextRequest } from 'next/server'

// Proxy to centralized MCP server API (MCPlatform pattern)
export async function GET(request: NextRequest) {
  // For simplicity, let's directly import the centralized function instead of proxying
  try {
    // Import the centralized API handler dynamically to avoid bundling issues
    const { GET: centralizedHandler } = await import('../../api/mcpserver/[...slug]/route')

    // Call the centralized handler with oauth-discovery action
    const response = await centralizedHandler(request, { params: { slug: ['oauth-discovery'] } })

    return response
  } catch (error) {
    console.error('Error calling centralized MCP API:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}