'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { authAPI, UserResponse } from '@/lib/api'
import Navbar from '@/components/Navbar'
import { Card, CardBody, Button, Alert } from '@/components/ui'
import Link from 'next/link'

interface CourierVerificationGuardProps {
  children: ReactNode
}

export default function CourierVerificationGuard({ children }: CourierVerificationGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await authAPI.getCurrentUser()
        setUser(response.data)
      } catch {
        // Not authenticated, redirect to login
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Check if user is a courier
  const isCourier = user.role === 'courier' || user.role === 'both'
  if (!isCourier) {
    router.push('/dashboard')
    return null
  }

  // Check all verification requirements for couriers
  const isEmailVerified = user.is_verified
  const isPhoneVerified = user.phone_verified
  const isIdVerified = user.id_verified
  const isFullyVerified = isEmailVerified && isPhoneVerified && isIdVerified

  // If fully verified, render children
  if (isFullyVerified) {
    return <>{children}</>
  }

  // Otherwise, show verification required page
  return (
    <div className="min-h-screen bg-surface-50">
      <Navbar user={user} />
      <div className="page-container py-8">
        <Card className="max-w-2xl mx-auto">
          <CardBody className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-warning-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-surface-900 mb-2">Verification Required</h1>
              <p className="text-surface-600">
                To access courier features, you need to complete all verification steps.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {/* Email Verification */}
              <div className={`flex items-center gap-4 p-4 rounded-lg border ${
                isEmailVerified ? 'bg-success-50 border-success-200' : 'bg-warning-50 border-warning-200'
              }`}>
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  isEmailVerified ? 'bg-success-100' : 'bg-warning-100'
                }`}>
                  {isEmailVerified ? (
                    <svg className="w-5 h-5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`font-medium ${isEmailVerified ? 'text-success-800' : 'text-warning-800'}`}>
                    Email Verification
                  </h3>
                  <p className={`text-sm ${isEmailVerified ? 'text-success-600' : 'text-warning-600'}`}>
                    {isEmailVerified ? 'Your email is verified' : 'Check your inbox for the verification link'}
                  </p>
                </div>
                {isEmailVerified ? (
                  <span className="text-success-600 font-medium">Completed</span>
                ) : (
                  <span className="text-warning-600 font-medium">Pending</span>
                )}
              </div>

              {/* Phone Verification */}
              <div className={`flex items-center gap-4 p-4 rounded-lg border ${
                isPhoneVerified ? 'bg-success-50 border-success-200' : 'bg-warning-50 border-warning-200'
              }`}>
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  isPhoneVerified ? 'bg-success-100' : 'bg-warning-100'
                }`}>
                  {isPhoneVerified ? (
                    <svg className="w-5 h-5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`font-medium ${isPhoneVerified ? 'text-success-800' : 'text-warning-800'}`}>
                    Phone Verification
                  </h3>
                  <p className={`text-sm ${isPhoneVerified ? 'text-success-600' : 'text-warning-600'}`}>
                    {isPhoneVerified ? 'Your phone is verified' : 'Verify your phone number via SMS'}
                  </p>
                </div>
                {isPhoneVerified ? (
                  <span className="text-success-600 font-medium">Completed</span>
                ) : (
                  <span className="text-warning-600 font-medium">Pending</span>
                )}
              </div>

              {/* ID Verification */}
              <div className={`flex items-center gap-4 p-4 rounded-lg border ${
                isIdVerified ? 'bg-success-50 border-success-200' : 'bg-warning-50 border-warning-200'
              }`}>
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  isIdVerified ? 'bg-success-100' : 'bg-warning-100'
                }`}>
                  {isIdVerified ? (
                    <svg className="w-5 h-5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`font-medium ${isIdVerified ? 'text-success-800' : 'text-warning-800'}`}>
                    ID Verification
                  </h3>
                  <p className={`text-sm ${isIdVerified ? 'text-success-600' : 'text-warning-600'}`}>
                    {isIdVerified ? 'Your identity is verified' : 'Submit government-issued ID for verification'}
                  </p>
                </div>
                {isIdVerified ? (
                  <span className="text-success-600 font-medium">Completed</span>
                ) : (
                  <span className="text-warning-600 font-medium">Pending</span>
                )}
              </div>
            </div>

            <Alert variant="info" className="mb-6">
              <p className="text-sm">
                Complete all verification steps on your dashboard. The verification banners will guide you through each step.
              </p>
            </Alert>

            <div className="text-center">
              <Link href="/dashboard">
                <Button variant="primary" size="lg">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
