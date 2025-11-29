'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { verificationAPI } from '@/lib/api'
import LanguageSwitcher from '@/components/LanguageSwitcher'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('auth')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const hasVerified = useRef(false)

  useEffect(() => {
    const verifyEmail = async () => {
      // Prevent double execution (React StrictMode in development)
      if (hasVerified.current) return
      hasVerified.current = true

      const token = searchParams.get('token')

      if (!token) {
        setStatus('error')
        setMessage(t('invalidVerificationLink'))
        return
      }

      try {
        const response = await verificationAPI.verifyEmail(token)

        if (response.data) {
          setStatus('success')
          setMessage(t('emailVerifiedSuccess'))

          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push('/login?verified=true')
          }, 3000)
        }
      } catch (error: any) {
        setStatus('error')
        if (error.response?.data?.detail) {
          setMessage(error.response.data.detail)
        } else {
          setMessage(t('verificationError'))
        }
      }
    }

    verifyEmail()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Language Switcher */}
      <div className="absolute top-8 right-8 z-10">
        <LanguageSwitcher />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {t('emailVerified')}
          </h2>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          {status === 'loading' && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">{t('verifyingEmail')}</p>
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
                {t('success')}
              </h3>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">
                {t('redirectingToLogin')}
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
                {t('verificationFailed')}
              </h3>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="space-y-2">
                <Link
                  href="/login"
                  className="block w-full px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  {t('goToLogin')}
                </Link>
                <Link
                  href="/register"
                  className="block w-full px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  {t('registerAgain')}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  const tCommon = useTranslations('common')

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">{tCommon('loading')}</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
