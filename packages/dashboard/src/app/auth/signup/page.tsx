import { Suspense } from 'react'
import { SignUpForm } from '@/components/auth/sign-up-form'

export const metadata = {
  title: 'Sign Up | mcp-obs',
  description: 'Create your mcp-obs account',
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">mcp-obs</h1>
          <p className="text-muted-foreground">Authentication and observability for MCP servers</p>
        </div>

        <Suspense fallback={<div>Loading...</div>}>
          <SignUpForm />
        </Suspense>
      </div>
    </div>
  )
}