'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { authAPI, UserResponse } from '@/lib/api'

interface UnverifiedUserGuardProps {
  children: ReactNode
}

// Routes that unverified users CAN access
const ALLOWED_ROUTES_FOR_UNVERIFIED_USERS = [
  '/dashboard',
  '/login',
  '/register',
  '/register-success',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/resend-verification',
  '/auth/callback',
  '/id-verification', // Allow access to start ID verification (couriers)
]

// Routes that are public (no auth required)
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/register-success',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/resend-verification',
  '/auth/callback',
]

export default function UnverifiedCourierGuard({ children }: UnverifiedUserGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const checkVerification = async () => {
      // Extract path without locale prefix
      const pathWithoutLocale = pathname.replace(/^\/(en|fr|es)/, '') || '/'

      // Skip check for public routes
      if (PUBLIC_ROUTES.some(route => pathWithoutLocale === route || pathWithoutLocale.startsWith(route + '/'))) {
        setChecked(true)
        return
      }

      try {
        const response = await authAPI.getCurrentUser()
        const userData = response.data

        // Admins always have full access
        if (userData.role === 'admin') {
          setChecked(true)
          return
        }

        // Determine verification requirements based on role
        const isCourier = userData.role === 'courier' || userData.role === 'both'
        const isSender = userData.role === 'sender' || userData.role === 'both'

        // Base verification: email + phone (required for all users)
        const hasBaseVerification = userData.is_verified && userData.phone_verified

        // Couriers additionally need ID verification
        const isCourierFullyVerified = hasBaseVerification && userData.id_verified

        // Senders need email + phone verification
        const isSenderFullyVerified = hasBaseVerification

        // Check if user is fully verified based on their role
        let isFullyVerified = false
        if (userData.role === 'both') {
          // Users with 'both' role need courier-level verification (all three)
          isFullyVerified = isCourierFullyVerified
        } else if (isCourier) {
          isFullyVerified = isCourierFullyVerified
        } else if (isSender) {
          isFullyVerified = isSenderFullyVerified
        }

        if (isFullyVerified) {
          // Fully verified, allow access to everything
          setChecked(true)
          return
        }

        // Unverified user - check if current route is allowed
        const isAllowedRoute = ALLOWED_ROUTES_FOR_UNVERIFIED_USERS.some(
          route => pathWithoutLocale === route || pathWithoutLocale.startsWith(route + '/')
        )

        if (!isAllowedRoute) {
          // Redirect to dashboard
          router.replace('/dashboard')
          return
        }

        setChecked(true)
      } catch {
        // Not authenticated - let other auth guards handle this
        setChecked(true)
      }
    }

    checkVerification()
  }, [pathname, router])

  // Show nothing while checking (prevents flash of restricted content)
  if (!checked) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return <>{children}</>
}
