import { Suspense } from 'react'
import { ConsentScreen } from '@/components/mcp-oauth/consent-screen'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'
import { getOAuthClient } from '@/lib/mcp-oauth/client-registration'
import { createMCPAuth } from '@/lib/auth/mcp/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

interface ConsentPageProps {
  searchParams: {
    mcp_server_id?: string
    client_id?: string
    redirect_uri?: string
    scope?: string
    state?: string
    code_challenge?: string
    code_challenge_method?: string
    response_type?: string
  }
}

async function ConsentPageContent({ searchParams }: ConsentPageProps) {
  const {
    mcp_server_id,
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
    response_type
  } = searchParams

  if (!mcp_server_id || !client_id || !redirect_uri || !code_challenge) {
    redirect('/error?message=Missing required parameters')
  }

  // Get MCP server
  const { db, mcpServer } = await import('database')
  const { eq } = await import('drizzle-orm')

  const servers = await db
    .select()
    .from(mcpServer)
    .where(eq(mcpServer.id, mcp_server_id))
    .limit(1)

  const server = servers[0]
  if (!server) {
    redirect('/error?message=MCP server not found')
  }

  // Get OAuth client
  const client = await getOAuthClient(mcp_server_id, client_id)
  if (!client) {
    redirect('/error?message=OAuth client not found')
  }

  // Check user authentication
  const mcpAuth = createMCPAuth(server.id, server.organizationId)

  let session
  try {
    session = await mcpAuth.api.getSession({
      headers: await headers()
    })
  } catch (error) {
    session = null
  }

  if (!session?.user) {
    // Redirect to login with authorization parameters
    const loginUrl = new URL('/mcp-auth/login', process.env.NODE_ENV === 'development'
      ? `http://localhost:3000?mcp_server=${server.id}`
      : `https://${server.slug}.mcp-obs.com`)

    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) loginUrl.searchParams.set(key, value)
    })

    redirect(loginUrl.toString())
  }

  const requestedScopes = scope?.split(' ') || ['read']
  const supportedScopes = server.scopesSupported.split(',')

  return (
    <ConsentScreen
      server={server}
      client={client}
      user={session.user}
      requestedScopes={requestedScopes}
      supportedScopes={supportedScopes}
      authorizationParams={{
        client_id: client_id,
        redirect_uri: redirect_uri,
        scope: scope || 'read',
        state: state || '',
        code_challenge: code_challenge,
        code_challenge_method: code_challenge_method || 'S256',
        response_type: response_type || 'code',
      }}
    />
  )
}

export default function ConsentPage({ searchParams }: ConsentPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }
    >
      <ConsentPageContent searchParams={searchParams} />
    </Suspense>
  )
}