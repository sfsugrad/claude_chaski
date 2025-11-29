'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { authAPI } from '@/lib/api'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!email) {
      setError(tErrors('required'))
      return
    }

    setLoading(true)

    try {
      await authAPI.forgotPassword({ email })
      setSuccess(true)
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail)
      } else {
        setError(tErrors('somethingWentWrong'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Language Switcher */}
      <div className="absolute top-8 right-8 z-10">
        <LanguageSwitcher />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t('forgotPasswordTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('forgotPasswordSubtitle')}
          </p>
        </div>

        {success ? (
          <div className="bg-white p-8 rounded-lg shadow-md space-y-4">
            <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded">
              <p className="font-medium">{t('checkEmailTitle')}</p>
              <p className="text-sm mt-1">
                {t('checkEmailMessage')}
              </p>
            </div>
            <div className="text-center pt-4">
              <Link
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                {t('returnToLogin')}
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="bg-white p-8 rounded-lg shadow-md space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('emailAddress')}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('emailPlaceholder')}
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('sending') : t('sendResetLink')}
                </button>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                {t('rememberPassword')}{' '}
                <Link
                  href="/login"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  {t('signIn')}
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
