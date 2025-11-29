'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authAPI } from '@/lib/api'
import GoogleSignInButton from '@/components/GoogleSignInButton'
import { Button, Input, Card, CardBody, Alert } from '@/components/ui'

// Icons
const MailIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccessMessage('Registration successful! Please log in.')
    }
    if (searchParams.get('verified') === 'true') {
      setSuccessMessage('Email verified successfully! You can now log in.')
    }
    if (searchParams.get('reset') === 'true') {
      setSuccessMessage('Password reset successful! Please log in with your new password.')
    }
  }, [searchParams])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!formData.email || !formData.password) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)

    try {
      await authAPI.login({
        email: formData.email,
        password: formData.password,
        remember_me: formData.rememberMe,
      })

      // Cookie is set by the server, now get user info to check role
      try {
        const userResponse = await authAPI.getCurrentUser()
        const userRole = userResponse.data?.role

        // Redirect based on role
        if (userRole === 'ADMIN' || userRole === 'admin') {
          router.push('/admin')
        } else {
          router.push('/dashboard')
        }
      } catch {
        // If we can't get user info, default to dashboard
        router.push('/dashboard')
      }
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail)
      } else {
        setError('Login failed. Please check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-100 rounded-full opacity-50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-100 rounded-full opacity-50 blur-3xl" />
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block mb-6">
            <span className="text-3xl font-bold text-gradient">Chaski</span>
          </Link>
          <h1 className="text-2xl font-bold text-surface-900">
            Sign in to your account
          </h1>
          <p className="mt-2 text-surface-500">
            Welcome back! Enter your details to continue.
          </p>
        </div>

        <Card className="animate-fade-in-up">
          <CardBody className="space-y-6">
            {/* Alerts */}
            {error && (
              <Alert variant="error" dismissible onDismiss={() => setError('')}>
                {error}
              </Alert>
            )}

            {successMessage && (
              <Alert variant="success" dismissible onDismiss={() => setSuccessMessage('')}>
                {successMessage}
              </Alert>
            )}

            {/* Google Sign In */}
            <div>
              <GoogleSignInButton />
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-surface-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-surface-400">Or continue with email</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <Input
                label="Email Address"
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                leftIcon={<MailIcon />}
                autoComplete="email"
              />

              {/* Password */}
              <div className="form-group">
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-surface-700">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="input-group">
                  <span className="input-group-icon">
                    <LockIcon />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="input pl-10"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center">
                <input
                  id="rememberMe"
                  name="rememberMe"
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-surface-300 rounded transition-colors"
                />
                <label
                  htmlFor="rememberMe"
                  className="ml-2 block text-sm text-surface-600"
                >
                  Remember me for 7 days
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={loading}
              >
                Sign In
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* Register Link */}
        <div className="text-center">
          <p className="text-sm text-surface-500">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-semibold text-primary-600 hover:text-primary-700 transition-colors"
            >
              Create one now
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-surface-200 border-t-primary-600 mb-4"></div>
          <p className="text-surface-500 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
