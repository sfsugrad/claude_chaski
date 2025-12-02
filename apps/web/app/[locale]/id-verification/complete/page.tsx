'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { idVerificationAPI, IDVerificationStatusResponse } from '@/lib/api'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function IDVerificationCompletePage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'processing' | 'failed' | 'error'>('loading')
  const [verificationStatus, setVerificationStatus] = useState<IDVerificationStatusResponse | null>(null)
  const [message, setMessage] = useState('')
  const hasChecked = useRef(false)

  useEffect(() => {
    const checkVerificationStatus = async () => {
      // Prevent double execution (React StrictMode in development)
      if (hasChecked.current) return
      hasChecked.current = true

      try {
        const response = await idVerificationAPI.getStatus()
        setVerificationStatus(response.data)

        if (response.data.is_verified) {
          setStatus('success')
          setMessage('Your ID has been successfully verified. You can now start accepting deliveries.')
          // Redirect to dashboard after 3 seconds
          setTimeout(() => {
            router.push('/dashboard')
          }, 3000)
        } else if (response.data.status === 'processing') {
          setStatus('processing')
          setMessage('Your verification is being processed. This usually takes a few minutes.')
        } else if (response.data.status === 'verified' || response.data.status === 'admin_approved') {
          setStatus('success')
          setMessage('Your ID has been successfully verified. You can now start accepting deliveries.')
          setTimeout(() => {
            router.push('/dashboard')
          }, 3000)
        } else if (response.data.status === 'failed' || response.data.status === 'admin_rejected') {
          setStatus('failed')
          setMessage(response.data.verification?.rejection_reason || response.data.verification?.failure_reason || 'Verification failed. Please try again.')
        } else if (response.data.status === 'requires_review') {
          setStatus('processing')
          setMessage('Your verification requires additional review. Our team will process it shortly.')
        } else if (response.data.status === 'pending') {
          setStatus('processing')
          setMessage('Your verification is pending. Please complete the verification process if you have not already.')
        } else {
          setStatus('error')
          setMessage('Unable to determine verification status.')
        }
      } catch (error: any) {
        setStatus('error')
        if (error.response?.data?.detail) {
          setMessage(error.response.data.detail)
        } else {
          setMessage('Failed to check verification status.')
        }
      }
    }

    checkVerificationStatus()
  }, [router])

  const handleRetryVerification = async () => {
    try {
      const returnUrl = `${window.location.origin}/id-verification/complete`
      const response = await idVerificationAPI.startVerification(returnUrl)
      window.location.href = response.data.url
    } catch (error: any) {
      console.error('Failed to start verification:', error)
      setMessage(error.response?.data?.detail || 'Failed to start verification')
    }
  }

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
          {status === 'loading' && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
              <p className="text-gray-600">Checking verification status...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Verification Successful
              </h3>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">
                Redirecting to dashboard...
              </p>
            </div>
          )}

          {status === 'processing' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <svg
                  className="h-6 w-6 text-blue-600 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Verification In Progress
              </h3>
              <p className="text-gray-600 mb-6">{message}</p>
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Go to Dashboard
              </Link>
            </div>
          )}

          {status === 'failed' && (
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
                Verification Failed
              </h3>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="space-y-3">
                {verificationStatus?.can_start_verification && (
                  <button
                    onClick={handleRetryVerification}
                    className="block w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    Try Again
                  </button>
                )}
                <Link
                  href="/dashboard"
                  className="block w-full px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-500"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                <svg
                  className="h-6 w-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Something Went Wrong
              </h3>
              <p className="text-gray-600 mb-6">{message}</p>
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Go to Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
