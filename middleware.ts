import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Get the pathname of the request (e.g. /, /dashboard, /auth/signin)
  const { pathname } = request.nextUrl

  // Define public paths that don't require authentication
  const publicPaths = [
    '/auth/signin',
    '/auth/signup',
    '/auth/error',
    '/api/auth',
  ]

  // Check if the path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

  // If it's a public path, allow the request
  if (isPublicPath) {
    return NextResponse.next()
  }

  // For protected paths, check authentication
  const session = await auth()

  // If not authenticated and trying to access protected route, redirect to signin
  if (!session?.user && pathname.startsWith('/dashboard')) {
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // If authenticated and trying to access auth pages, redirect to dashboard
  if (session?.user && pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // If accessing root and authenticated, redirect to dashboard
  if (session?.user && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // If accessing root and not authenticated, redirect to signin
  if (!session?.user && pathname === '/') {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}