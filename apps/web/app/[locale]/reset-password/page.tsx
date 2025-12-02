'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { authAPI } from '@/lib/api'
import LanguageSwitcher from '@/components/LanguageSwitcher'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.password || !formData.confirmPassword) {
      setError(t('fillAllFields'))
      return
    }

    if (formData.password.length < 8) {
      setError(t('passwordMin8'))
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordsDoNotMatch'))
      return
    }

    if (!token) {
      setError(t('invalidResetTokenError'))
      return
    }

    setLoading(true)

    try {
      await authAPI.resetPassword({
        token,
        new_password: formData.password,
      })
      setSuccess(true)
      setTimeout(() => {
        router.push('/login?reset=true')
      }, 2000)
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

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        {/* Language Switcher */}
        <div className="absolute top-8 right-8 z-10">
          <LanguageSwitcher />
        </div>

        <div className="max-w-md w-full space-y-8">
          <div className="bg-white p-8 rounded-lg shadow-md space-y-4">
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p className="font-medium">{t('invalidResetLink')}</p>
              <p className="text-sm mt-1">
                {t('invalidResetMessage')}
              </p>
            </div>
            <div className="text-center pt-4">
              <Link
                href="/forgot-password"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                {t('requestNewLink')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
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
            {t('resetPasswordTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('resetPasswordSubtitle')}
          </p>
        </div>

        {success ? (
          <div className="bg-white p-8 rounded-lg shadow-md space-y-4">
            <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded">
              <p className="font-medium">{t('newPasswordSuccess')}</p>
              <p className="text-sm mt-1">
                {t('passwordResetMessage')}
              </p>
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
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('newPassword')}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('enterNewPassword')}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('mustBe8Chars')}
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t('confirmPassword')}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('confirmNewPassword')}
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('resetting') : t('resetPassword')}
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

export default function ResetPasswordPage() {
  const tCommon = useTranslations('common')

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">{tCommon('loading')}</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
