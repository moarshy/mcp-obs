'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface McpOidcRegisterFormProps {
  server: {
    id: string
    name: string
    slug: string
    description?: string
    enablePasswordAuth: boolean
    enableGoogleAuth: boolean
    enableGithubAuth: boolean
  }
  authParams: {
    client_id?: string
    redirect_uri?: string
    response_type?: string
    scope?: string
    state?: string
    code_challenge?: string
    code_challenge_method?: string
    [key: string]: any
  }
}

export function McpOidcRegisterForm({ server, authParams }: McpOidcRegisterFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate passwords match
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match')
      }

      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }

      // Register user in Better Auth MCP system
      const response = await fetch('/mcp-oidc/auth/sign-up/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password
        })
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('Registration failed with status:', response.status, 'Response:', errorText)
        const errorData = (() => {
          try { return JSON.parse(errorText) } catch { return {} }
        })()
        throw new Error(errorData.message || errorText || 'Registration failed')
      }

      console.log('Better Auth MCP registration successful for:', formData.email)

      // After successful registration, complete OAuth flow
      await completeOAuthFlow()

    } catch (err) {
      console.error('Registration error:', err)
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialRegister = async (provider: 'google' | 'github') => {
    setLoading(true)
    setError('')

    try {
      // Store OAuth parameters in localStorage for retrieval after social login
      const oauthState = {
        ...authParams,
        provider,
        timestamp: Date.now(),
      }
      localStorage.setItem('mcp_oauth_state', JSON.stringify(oauthState))

      // Redirect to Better Auth social provider endpoint
      const socialUrl = `/mcp-oidc/auth/sign-in/${provider}`
      const params = new URLSearchParams({
        redirect: `/mcp-oidc/auth-complete?${new URLSearchParams(authParams).toString()}`
      })

      window.location.href = `${socialUrl}?${params.toString()}`

    } catch (err) {
      console.error(`${provider} registration error:`, err)
      setError(`${provider} registration failed`)
      setLoading(false)
    }
  }

  const completeOAuthFlow = async () => {
    try {
      // After user registration/authentication, complete the OAuth authorization flow
      const authorizeUrl = new URL('/mcp-auth/oauth/authorize', window.location.origin)

      // Add OAuth parameters
      Object.entries(authParams).forEach(([key, value]) => {
        if (value) {
          authorizeUrl.searchParams.set(key, String(value))
        }
      })

      console.log('Redirecting to authorize endpoint:', authorizeUrl.toString())
      window.location.href = authorizeUrl.toString()

    } catch (err) {
      console.error('OAuth flow completion error:', err)
      setError('Failed to complete registration flow')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
            <svg
              className="h-8 w-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            Create account for {server.name}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {server.description || 'Sign up to continue with your request'}
          </p>
        </div>

        <div className="bg-card rounded-lg shadow p-8 space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
              <div className="text-sm text-destructive">{error}</div>
            </div>
          )}

          {/* Social Registration Options */}
          {(server.enableGoogleAuth || server.enableGithubAuth) && (
            <div className="space-y-3">
              {server.enableGoogleAuth && (
                <button
                  type="button"
                  onClick={() => handleSocialRegister('google')}
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-3 border border-input rounded-lg text-sm font-medium text-foreground bg-background hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign up with Google
                </button>
              )}

              {server.enableGithubAuth && (
                <button
                  type="button"
                  onClick={() => handleSocialRegister('github')}
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-3 border border-input rounded-lg text-sm font-medium text-foreground bg-background hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-5 w-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  Sign up with GitHub
                </button>
              )}
            </div>
          )}

          {/* Divider */}
          {server.enablePasswordAuth && (server.enableGoogleAuth || server.enableGithubAuth) && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or sign up with email
                </span>
              </div>
            </div>
          )}

          {/* Email/Password Registration Form */}
          {server.enablePasswordAuth && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-foreground">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  className="mt-1 appearance-none relative block w-full px-3 py-3 border border-input placeholder-muted-foreground text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring focus:z-10 sm:text-sm bg-background"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  className="mt-1 appearance-none relative block w-full px-3 py-3 border border-input placeholder-muted-foreground text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring focus:z-10 sm:text-sm bg-background"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a password"
                  className="mt-1 appearance-none relative block w-full px-3 py-3 border border-input placeholder-muted-foreground text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring focus:z-10 sm:text-sm bg-background"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  className="mt-1 appearance-none relative block w-full px-3 py-3 border border-input placeholder-muted-foreground text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring focus:z-10 sm:text-sm bg-background"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                    Creating account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}

          {/* No auth methods enabled */}
          {!server.enablePasswordAuth && !server.enableGoogleAuth && !server.enableGithubAuth && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No registration methods are currently enabled for this server.
              </p>
            </div>
          )}
        </div>

        {/* Login Link - Preserves OAuth Context */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <a
              href={`/mcp-oidc/login?${new URLSearchParams(authParams).toString()}`}
              className="text-primary hover:text-primary/90 underline underline-offset-4"
            >
              Sign in
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          Powered by{' '}
          <a href="https://mcp-obs.com" className="text-primary hover:text-primary/90">
            mcp-obs
          </a>
        </div>
      </div>
    </div>
  )
}