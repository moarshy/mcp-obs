import { McpLoginWrapper } from '@/components/mcp-oauth/mcp-login-wrapper'

interface LoginPageProps {
  searchParams: Promise<{
    client_id?: string
    redirect_uri?: string
    response_type?: string
    scope?: string
    state?: string
    code_challenge?: string
    code_challenge_method?: string
    mcp_server_id?: string
    [key: string]: string | string[] | undefined
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams
  return <McpLoginWrapper searchParams={resolvedSearchParams} />
}