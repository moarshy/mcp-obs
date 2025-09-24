'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Shield, ExternalLink, User, Server, AlertTriangle } from 'lucide-react'

interface ConsentScreenProps {
  server: {
    id: string
    name: string
    slug: string
    description?: string | null
    logoUrl?: string | null
    organizationId: string
  }
  client: {
    id: string
    clientId: string
    clientName: string
    clientUri?: string | null
    logoUri?: string | null
    redirectUris: string
  }
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  requestedScopes: string[]
  supportedScopes: string[]
  authorizationParams: {
    client_id: string
    redirect_uri: string
    scope: string
    state: string
    code_challenge: string
    code_challenge_method: string
    response_type: string
  }
}

const SCOPE_DESCRIPTIONS: Record<string, { title: string; description: string; icon: string }> = {
  read: {
    title: 'Read Access',
    description: 'View and retrieve data from the MCP server',
    icon: '👁️'
  },
  write: {
    title: 'Write Access',
    description: 'Create, modify, and delete data on the MCP server',
    icon: '✏️'
  },
  admin: {
    title: 'Administrative Access',
    description: 'Full administrative control over the MCP server',
    icon: '🔧'
  },
  execute: {
    title: 'Execute Commands',
    description: 'Run commands and tools on the MCP server',
    icon: '⚡'
  },
  files: {
    title: 'File Access',
    description: 'Read, write, and manage files on the MCP server',
    icon: '📁'
  },
  resources: {
    title: 'Resource Access',
    description: 'Access and manage server resources',
    icon: '🔗'
  }
}

export function ConsentScreen({
  server,
  client,
  user,
  requestedScopes,
  supportedScopes,
  authorizationParams
}: ConsentScreenProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rememberConsent, setRememberConsent] = useState(false)

  const redirectUris = JSON.parse(client.redirectUris) as string[]
  const redirectUri = authorizationParams.redirect_uri

  const handleSubmit = async (action: 'approve' | 'deny') => {
    setIsSubmitting(true)

    // Create form data for submission
    const formData = new FormData()
    formData.append('action', action)
    formData.append('client_id', authorizationParams.client_id)
    formData.append('redirect_uri', authorizationParams.redirect_uri)
    formData.append('scope', authorizationParams.scope)
    formData.append('state', authorizationParams.state)
    formData.append('code_challenge', authorizationParams.code_challenge)
    formData.append('code_challenge_method', authorizationParams.code_challenge_method)
    if (rememberConsent) {
      formData.append('remember_consent', 'on')
    }

    // Submit to authorization endpoint
    const response = await fetch('/api/mcp-oauth/authorize', {
      method: 'POST',
      body: formData,
    })

    // The server will redirect, so we don't need to handle the response
    if (response.redirected) {
      window.location.href = response.url
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-4">
            {/* Client Logo */}
            {client.logoUri ? (
              <img
                src={client.logoUri}
                alt={client.clientName}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-primary" />
              </div>
            )}

            <div className="text-2xl font-bold text-muted-foreground">→</div>

            {/* Server Logo */}
            {server.logoUrl ? (
              <img
                src={server.logoUrl}
                alt={server.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                <Server className="w-6 h-6 text-secondary-foreground" />
              </div>
            )}
          </div>

          <div>
            <CardTitle className="text-xl">
              Authorize <span className="text-primary">{client.clientName}</span>
            </CardTitle>
            <CardDescription className="text-sm mt-2">
              {client.clientName} is requesting access to your account on <strong>{server.name}</strong>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* User Info */}
          <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name || user.email}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.name || user.email}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>

          {/* Requested Permissions */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Requested Permissions</h3>
            </div>

            <div className="space-y-2">
              {requestedScopes.map((scope) => {
                const scopeInfo = SCOPE_DESCRIPTIONS[scope] || {
                  title: scope,
                  description: `Access to ${scope} functionality`,
                  icon: '🔹'
                }

                return (
                  <div key={scope} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <div className="text-lg">{scopeInfo.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-sm">{scopeInfo.title}</p>
                        <Badge variant={scope === 'admin' ? 'destructive' : 'secondary'}>
                          {scope}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {scopeInfo.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Security Notice for High-Risk Scopes */}
          {requestedScopes.some(scope => ['admin', 'write', 'execute'].includes(scope)) && (
            <div className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="text-xs text-yellow-700 dark:text-yellow-300">
                <strong>Security Notice:</strong> This application is requesting permissions that allow it to modify data or execute commands. Only approve if you trust this application.
              </div>
            </div>
          )}

          <Separator />

          {/* Client Information */}
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Application:</span>
              <span className="font-medium">{client.clientName}</span>
            </div>
            {client.clientUri && (
              <div className="flex justify-between">
                <span>Website:</span>
                <a
                  href={client.clientUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center space-x-1"
                >
                  <span>Visit</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            <div className="flex justify-between">
              <span>Redirect to:</span>
              <span className="font-mono truncate max-w-32" title={redirectUri}>
                {new URL(redirectUri).hostname}
              </span>
            </div>
          </div>

          {/* Remember Consent */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberConsent}
              onCheckedChange={(checked) => setRememberConsent(checked === true)}
            />
            <label
              htmlFor="remember"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Remember this choice
            </label>
          </div>
        </CardContent>

        <CardFooter className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => handleSubmit('deny')}
            disabled={isSubmitting}
            className="flex-1"
          >
            Deny
          </Button>
          <Button
            onClick={() => handleSubmit('approve')}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Processing...' : 'Authorize'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}