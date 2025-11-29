'use client'

import Link from 'next/link'

export default function RegisterSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Registration Successful!
          </h2>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg
                className="h-10 w-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Check Your Email
            </h3>

            <p className="text-gray-600 mb-6">
              We've sent a verification link to your email address. Please click
              the link to verify your account and complete the registration
              process.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Important:</strong> The verification link will expire in 24
                hours. If you don't see the email, please check your spam folder.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Didn't receive the email?
              </p>
              <Link
                href="/resend-verification"
                className="inline-block text-blue-600 hover:text-blue-500 font-medium"
              >
                Resend verification email
              </Link>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-500 font-medium"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
