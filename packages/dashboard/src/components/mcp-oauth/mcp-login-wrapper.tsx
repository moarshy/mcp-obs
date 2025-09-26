'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { McpLoginForm } from './mcp-login-form'

interface McpLoginWrapperProps {
  searchParams: {
    client_id?: string
    redirect_uri?: string
    response_type?: string
    scope?: string
    state?: string
    code_challenge?: string
    code_challenge_method?: string
    mcp_server_id?: string
    [key: string]: string | string[] | undefined
  }
}

export function McpLoginWrapper({ searchParams }: McpLoginWrapperProps) {
  const [server, setServer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method, mcp_server_id, ...otherParams } = searchParams

  useEffect(() => {
    async function fetchServerInfo() {
      try {
        // Use centralized MCP server API (MCPlatform pattern)
        // The subdomain resolution happens on the server via Host header
        const serverConfigUrl = new URL('/api/mcpserver/config', window.location.origin)

        const response = await fetch(serverConfigUrl.toString(), {
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          console.error('Server config fetch failed:', response.status, await response.text())
          setError('MCP server not found')
          return
        }

        const data = await response.json()
        setServer(data.server)
      } catch (err) {
        console.error('Error fetching server info:', err)
        setError('Failed to load server information')
      } finally {
        setLoading(false)
      }
    }

    fetchServerInfo()
  }, [mcp_server_id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    router.push(`/error?message=${encodeURIComponent(error)}`)
    return null
  }

  if (!server) {
    router.push('/error?message=MCP server not found')
    return null
  }

  // Prepare OAuth parameters for the login form
  const oauthParams = {
    client_id: client_id as string,
    redirect_uri: redirect_uri as string,
    response_type: response_type as string,
    scope: scope as string,
    state: state as string,
    code_challenge: code_challenge as string,
    code_challenge_method: code_challenge_method as string,
    ...otherParams
  }

  return (
    <McpLoginForm
      server={server}
      authParams={oauthParams}
    />
  )
}