import { Suspense } from 'react'
import { SignInForm } from '@/components/auth/sign-in-form'

export const metadata = {
  title: 'Sign In | MCPlatform',
  description: 'Sign in to your MCPlatform account',
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">MCPlatform</h1>
          <p className="text-gray-600">Authentication and observability for MCP servers</p>
        </div>

        <Suspense fallback={<div>Loading...</div>}>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  )
}