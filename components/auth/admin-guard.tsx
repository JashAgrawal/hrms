'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface AdminGuardProps {
  children: React.ReactNode
  requiredRoles?: string[]
  fallbackPath?: string
}

export function AdminGuard({ 
  children, 
  requiredRoles = ['ADMIN', 'SUPER_ADMIN'],
  fallbackPath = '/dashboard'
}: AdminGuardProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    const userRole = (session.user as any).role
    if (!requiredRoles.includes(userRole)) {
      router.push(fallbackPath)
      return
    }
  }, [session, status, router, requiredRoles, fallbackPath])

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Show unauthorized message if no session
  if (!session?.user) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You must be logged in to access this page.
        </AlertDescription>
      </Alert>
    )
  }

  // Show forbidden message if insufficient permissions
  const userRole = (session.user as any).role
  if (!requiredRoles.includes(userRole)) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to access this page. Admin access required.
        </AlertDescription>
      </Alert>
    )
  }

  // Render children if all checks pass
  return <>{children}</>
}