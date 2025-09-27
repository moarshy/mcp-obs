'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { McpOidcLoginForm } from './mcp-oidc-login-form'

interface McpOidcLoginWrapperProps {
  searchParams: {
    client_id?: string
    redirect_uri?: string
    response_type?: string
    scope?: string
    state?: string
    code_challenge?: string
    code_challenge_method?: string
    [key: string]: string | string[] | undefined
  }
}

export function McpOidcLoginWrapper({ searchParams }: McpOidcLoginWrapperProps) {
  const [server, setServer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    code_challenge,
    code_challenge_method,
    ...otherParams
  } = searchParams

  useEffect(() => {
    async function fetchServerInfo() {
      try {
        // Use centralized MCP server API (following MCPlatform vhost resolution pattern)
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

        // Validate that authentication is enabled for this server
        if (!data.server.enabled) {
          setError('Authentication is disabled for this MCP server')
          return
        }

      } catch (err) {
        console.error('Error fetching server info:', err)
        setError('Failed to load server information')
      } finally {
        setLoading(false)
      }
    }

    fetchServerInfo()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full space-y-6 p-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 text-destructive">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold text-foreground">
              Configuration Error
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error}
            </p>
          </div>
          <div className="text-center">
            <a
              href="/"
              className="text-primary hover:text-primary/90 text-sm font-medium"
            >
              ← Go back to homepage
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!server) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Server Not Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The requested MCP server could not be found.
          </p>
        </div>
      </div>
    )
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
    <McpOidcLoginForm
      server={server}
      authParams={oauthParams}
    />
  )
}