import { McpOidcLoginWrapper } from '@/components/mcp-oauth/mcp-oidc-login-wrapper'

interface LoginPageProps {
  searchParams: Promise<{
    client_id?: string
    redirect_uri?: string
    response_type?: string
    scope?: string
    state?: string
    code_challenge?: string
    code_challenge_method?: string
    error?: string
    error_description?: string
    [key: string]: string | string[] | undefined
  }>
}

export default async function McpOidcLoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams

  // Handle OAuth errors
  if (resolvedSearchParams.error) {
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
              Authentication Error
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {resolvedSearchParams.error_description || resolvedSearchParams.error}
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

  return <McpOidcLoginWrapper searchParams={resolvedSearchParams} />
}