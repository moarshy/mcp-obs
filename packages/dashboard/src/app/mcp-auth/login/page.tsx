import { Suspense } from 'react'
import { McpLoginForm } from '@/components/mcp-oauth/mcp-login-form'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'
import { redirect } from 'next/navigation'

interface LoginPageProps {
  searchParams: {
    mcp_server_id?: string
    [key: string]: string | string[] | undefined
  }
}

async function LoginPageContent({ searchParams }: LoginPageProps) {
  const { mcp_server_id, ...authParams } = searchParams

  if (!mcp_server_id) {
    redirect('/error?message=Missing MCP server ID')
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

  return (
    <McpLoginForm
      server={server}
      authParams={authParams}
    />
  )
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }
    >
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  )
}