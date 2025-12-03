'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { idVerificationAPI, IDVerificationStatusResponse } from '@/lib/api'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function IDVerificationPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'starting' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const hasStarted = useRef(false)

  useEffect(() => {
    const startVerification = async () => {
      // Prevent double execution (React StrictMode in development)
      if (hasStarted.current) return
      hasStarted.current = true

      try {
        // First check if user already has a verification in progress
        const statusResponse = await idVerificationAPI.getStatus()
        const data: IDVerificationStatusResponse = statusResponse.data

        if (data.is_verified) {
          // Already verified, redirect to dashboard
          router.push('/dashboard')
          return
        }

        if (data.status === 'processing' || data.status === 'requires_review') {
          // Verification in progress, redirect to complete page
          const pathParts = window.location.pathname.split('/').filter(Boolean)
          const locale = pathParts[0] || 'en'
          router.push(`/${locale}/id-verification/complete`)
          return
        }

        // Start new verification
        setStatus('starting')
        const pathParts = window.location.pathname.split('/').filter(Boolean)
        const locale = pathParts[0] || 'en'
        const returnUrl = `${window.location.origin}/${locale}/id-verification/complete`
        const response = await idVerificationAPI.startVerification(returnUrl)

        if (response.data.url) {
          // Redirect to Stripe Identity
          window.location.href = response.data.url
        } else {
          setStatus('error')
          setMessage('No verification URL returned. Please try again.')
        }
      } catch (error: any) {
        console.error('Failed to start verification:', error)
        setStatus('error')
        setMessage(error.response?.data?.detail || 'Failed to start verification. Please try again.')
      }
    }

    startVerification()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Language Switcher */}
      <div className="absolute top-8 right-8 z-10">
        <LanguageSwitcher />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            ID Verification
          </h2>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          {(status === 'loading' || status === 'starting') && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
              <p className="text-gray-600">
                {status === 'loading' ? 'Checking verification status...' : 'Starting verification...'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                You will be redirected to complete your ID verification.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Something Went Wrong
              </h3>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    hasStarted.current = false
                    setStatus('loading')
                    window.location.reload()
                  }}
                  className="block w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  Try Again
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="block w-full px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-500"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
