import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/auth/sign-in',
    '/auth/sign-up',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/pricing',
    '/docs',
    '/about'
  ]

  // API routes that should be handled by their own auth
  const apiRoutes = [
    '/api/auth/',
    '/api/rpc/'
  ]

  // Check if this is a public route
  if (publicRoutes.includes(pathname) || apiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Protected routes - require authentication
  try {
    const session = await auth.api.getSession({
      headers: request.headers
    })

    if (!session?.user) {
      const url = new URL('/auth/sign-in', request.url)
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }

    // Check for organization context in URL
    const orgSlug = request.nextUrl.searchParams.get('org')
    if (orgSlug) {
      // Verify user has access to this organization
      try {
        const membership = await auth.api.getUserOrganization({
          userId: session.user.id,
          organizationSlug: orgSlug,
        })

        if (!membership) {
          // User doesn't have access to this organization, redirect to dashboard
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      } catch (error) {
        console.error('Error checking organization membership:', error)
        // On error, redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware auth error:', error)
    const url = new URL('/auth/sign-in', request.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}