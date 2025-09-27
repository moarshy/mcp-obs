import type { NextPage } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { McpOidcRegisterForm } from '@/components/mcp-oauth/mcp-oidc-register-form'
import { getMcpServerBySlug } from '@/lib/mcp-server-utils'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const McpOidcRegisterPage: NextPage<PageProps> = async ({ searchParams }) => {
  try {
    // Get MCP server context from subdomain
    const headerList = await headers()
    const host = headerList.get('host') || ''
    const resolvedSearchParams = await searchParams

    let mcpServer = null
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (isDevelopment) {
      // Development: extract subdomain from localhost
      const hostWithoutPort = host.replace(/:\d+$/, '')

      if (hostWithoutPort.includes('.localhost')) {
        const subdomain = hostWithoutPort.replace('.localhost', '')
        if (subdomain && !subdomain.includes('.')) {
          mcpServer = await getMcpServerBySlug(subdomain)
        }
      }
    } else {
      // Production: extract subdomain
      const baseDomain = 'mcp-obs.com'
      const hostWithoutPort = host.replace(/:\d+$/, '')

      if (hostWithoutPort !== baseDomain && hostWithoutPort !== `www.${baseDomain}`) {
        const subdomain = hostWithoutPort.replace(`.${baseDomain}`, '')
        if (subdomain && !subdomain.includes('.')) {
          mcpServer = await getMcpServerBySlug(subdomain)
        }
      }
    }

    if (!mcpServer) {
      redirect('/?error=server_not_found')
    }

    if (!mcpServer.enabled) {
      redirect(`/?error=server_disabled&server=${mcpServer.name}`)
    }

    // Extract OAuth parameters from search params
    const authParams = {
      client_id: Array.isArray(resolvedSearchParams.client_id)
        ? resolvedSearchParams.client_id[0]
        : resolvedSearchParams.client_id,
      redirect_uri: Array.isArray(resolvedSearchParams.redirect_uri)
        ? resolvedSearchParams.redirect_uri[0]
        : resolvedSearchParams.redirect_uri,
      response_type: Array.isArray(resolvedSearchParams.response_type)
        ? resolvedSearchParams.response_type[0]
        : resolvedSearchParams.response_type,
      scope: Array.isArray(resolvedSearchParams.scope)
        ? resolvedSearchParams.scope[0]
        : resolvedSearchParams.scope,
      state: Array.isArray(resolvedSearchParams.state)
        ? resolvedSearchParams.state[0]
        : resolvedSearchParams.state,
      code_challenge: Array.isArray(resolvedSearchParams.code_challenge)
        ? resolvedSearchParams.code_challenge[0]
        : resolvedSearchParams.code_challenge,
      code_challenge_method: Array.isArray(resolvedSearchParams.code_challenge_method)
        ? resolvedSearchParams.code_challenge_method[0]
        : resolvedSearchParams.code_challenge_method,
    }

    // Validate that we have OAuth context (required parameters)
    if (!authParams.client_id || !authParams.redirect_uri || !authParams.code_challenge) {
      redirect(`/mcp-oidc/register-standalone?error=missing_oauth_context&server=${mcpServer.slug}`)
    }

    return (
      <McpOidcRegisterForm
        server={{
          id: mcpServer.id,
          name: mcpServer.name,
          slug: mcpServer.slug,
          description: mcpServer.description || '',
          enablePasswordAuth: mcpServer.enablePasswordAuth,
          enableGoogleAuth: mcpServer.enableGoogleAuth,
          enableGithubAuth: mcpServer.enableGithubAuth,
        }}
        authParams={authParams}
      />
    )

  } catch (error) {
    console.error('Error in MCP-OIDC register page:', error)
    redirect('/?error=internal_error')
  }
}

export default McpOidcRegisterPage