'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Server, Github } from 'lucide-react'
import { createMCPAuth } from '@/lib/auth/mcp/auth'

interface McpLoginFormProps {
  server: {
    id: string
    name: string
    slug: string
    description?: string | null
    logoUrl?: string | null
    organizationId: string
  }
  authParams: Record<string, any>
}

export function McpLoginForm({ server, authParams }: McpLoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // Create MCP auth instance for this server
      const mcpAuth = createMCPAuth(server.id, server.organizationId)

      // Attempt login
      const result = await mcpAuth.signIn.email({
        email,
        password,
        callbackURL: buildCallbackUrl()
      })

      if (result.error) {
        setError(result.error.message || 'Login failed')
      } else {
        // Redirect to continue OAuth flow
        const callbackUrl = buildCallbackUrl()
        router.push(callbackUrl)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setIsLoading(true)
    setError('')

    try {
      // Create MCP auth instance for this server
      const mcpAuth = createMCPAuth(server.id, server.organizationId)

      // Initiate social login
      const result = await mcpAuth.signIn.social({
        provider,
        callbackURL: buildCallbackUrl()
      })

      if (result.error) {
        setError(result.error.message || `${provider} login failed`)
        setIsLoading(false)
      }
      // For social logins, the page will redirect automatically
    } catch (err) {
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  const buildCallbackUrl = () => {
    // Build URL to continue OAuth flow
    const baseUrl = process.env.NODE_ENV === 'development'
      ? `http://localhost:3000?mcp_server=${server.id}`
      : `https://${server.slug}.mcp-obs.com`

    const consentUrl = new URL('/mcp-auth/consent', baseUrl)

    // Add all authorization parameters
    Object.entries(authParams).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        consentUrl.searchParams.set(key, value)
      }
    })

    consentUrl.searchParams.set('mcp_server_id', server.id)

    return consentUrl.toString()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            {server.logoUrl ? (
              <img
                src={server.logoUrl}
                alt={server.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                <Server className="w-8 h-8 text-primary" />
              </div>
            )}
          </div>

          <div>
            <CardTitle className="text-2xl">
              Sign in to <span className="text-primary">{server.name}</span>
            </CardTitle>
            <CardDescription className="mt-2">
              {server.description || 'Enter your credentials to continue'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              {error}
            </div>
          )}

          {/* Social Login Buttons */}
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={() => handleSocialLogin('google')}
              disabled={isLoading}
              className="w-full"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <Button
              variant="outline"
              onClick={() => handleSocialLogin('github')}
              disabled={isLoading}
              className="w-full"
            >
              <Github className="mr-2 h-4 w-4" />
              Continue with GitHub
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <a href="#" className="text-primary hover:underline">
                Sign up
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}