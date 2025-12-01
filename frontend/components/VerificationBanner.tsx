'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { authAPI, verificationAPI, idVerificationAPI, UserResponse, IDVerificationStatusResponse } from '@/lib/api'

export default function VerificationBanner() {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [dismissed, setDismissed] = useState<{ email: boolean; phone: boolean; id: boolean }>({ email: false, phone: false, id: false })
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneCode, setPhoneCode] = useState('')
  const [showPhoneVerify, setShowPhoneVerify] = useState(false)
  const [phoneVerifying, setPhoneVerifying] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [idVerificationStatus, setIdVerificationStatus] = useState<IDVerificationStatusResponse | null>(null)
  const [idVerificationLoading, setIdVerificationLoading] = useState(false)
  const pathname = usePathname()

  // Don't show on auth pages
  const isAuthPage = pathname?.includes('/login') || pathname?.includes('/register') || pathname?.includes('/verify')

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await authAPI.getCurrentUser()
        setUser(response.data)

        // Fetch ID verification status for couriers
        if (response.data.role === 'courier' || response.data.role === 'both') {
          try {
            const idStatus = await idVerificationAPI.getStatus()
            setIdVerificationStatus(idStatus.data)
          } catch {
            // ID verification endpoint not available
          }
        }
      } catch {
        // Not logged in, that's fine
        setUser(null)
      }
    }
    fetchUser()
  }, [pathname])

  const handleResendEmail = async () => {
    if (!user?.email || emailSending) return
    setEmailSending(true)
    try {
      await verificationAPI.resendVerification(user.email)
      setEmailSent(true)
    } catch {
      // Silent fail - user can try again
    } finally {
      setEmailSending(false)
    }
  }

  const handleSendPhoneCode = async () => {
    if (phoneSending) return
    setPhoneSending(true)
    setPhoneError('')
    try {
      await authAPI.sendPhoneCode()
      setShowPhoneVerify(true)
    } catch (err: any) {
      setPhoneError(err.response?.data?.detail || 'Failed to send code')
    } finally {
      setPhoneSending(false)
    }
  }

  const handleVerifyPhone = async () => {
    if (!phoneCode || phoneVerifying) return
    setPhoneVerifying(true)
    setPhoneError('')
    try {
      await authAPI.verifyPhoneCode(phoneCode)
      // Refresh user data
      const response = await authAPI.getCurrentUser()
      setUser(response.data)
      setShowPhoneVerify(false)
      setPhoneCode('')
    } catch (err: any) {
      setPhoneError(err.response?.data?.detail || 'Invalid code')
    } finally {
      setPhoneVerifying(false)
    }
  }

  const handleStartIdVerification = async () => {
    if (idVerificationLoading) return
    setIdVerificationLoading(true)
    try {
      // Get current URL as return URL (verification complete page)
      const returnUrl = `${window.location.origin}/id-verification/complete`
      const response = await idVerificationAPI.startVerification(returnUrl)
      // Redirect to Stripe Identity verification
      window.location.href = response.data.url
    } catch (err: any) {
      console.error('Failed to start ID verification:', err)
      setIdVerificationLoading(false)
    }
  }

  // Don't render anything if on auth pages or no user
  if (isAuthPage || !user) {
    return null
  }

  const needsEmailVerification = !user.is_verified
  const needsPhoneVerification = !user.phone_verified

  // ID verification is only for couriers
  const isCourier = user.role === 'courier' || user.role === 'both'
  const needsIdVerification = isCourier && !user.id_verified && idVerificationStatus?.can_start_verification
  const idVerificationPending = isCourier && idVerificationStatus?.status === 'pending'
  const idVerificationProcessing = isCourier && idVerificationStatus?.status === 'processing'
  const idVerificationFailed = isCourier && (idVerificationStatus?.status === 'failed' || idVerificationStatus?.status === 'admin_rejected')
  const idVerificationRequiresReview = isCourier && idVerificationStatus?.status === 'requires_review'

  // Don't show if fully verified or all dismissed
  if ((!needsEmailVerification || dismissed.email) &&
      (!needsPhoneVerification || dismissed.phone) &&
      (!needsIdVerification && !idVerificationPending && !idVerificationProcessing && !idVerificationFailed && !idVerificationRequiresReview || dismissed.id)) {
    return null
  }

  return (
    <div className="verification-banners">
      {needsEmailVerification && !dismissed.email && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <span className="font-medium">Email not verified.</span>
                  {' '}Please check your inbox and verify your email address.
                  {emailSent ? (
                    <span className="ml-2 text-green-600 font-medium">Verification email sent!</span>
                  ) : (
                    <button
                      onClick={handleResendEmail}
                      disabled={emailSending}
                      className="ml-2 font-medium underline text-yellow-700 hover:text-yellow-600 disabled:opacity-50"
                    >
                      {emailSending ? 'Sending...' : 'Resend verification email'}
                    </button>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissed(prev => ({ ...prev, email: true }))}
              className="ml-4 text-yellow-400 hover:text-yellow-500"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {needsPhoneVerification && !dismissed.phone && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                {!showPhoneVerify ? (
                  <p className="text-sm text-orange-700">
                    <span className="font-medium">Phone not verified.</span>
                    {' '}Please verify your phone number.
                    <button
                      onClick={handleSendPhoneCode}
                      disabled={phoneSending}
                      className="ml-2 font-medium underline text-orange-700 hover:text-orange-600 disabled:opacity-50"
                    >
                      {phoneSending ? 'Sending code...' : 'Send verification code'}
                    </button>
                    {phoneError && <span className="ml-2 text-red-600">{phoneError}</span>}
                  </p>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-orange-700 font-medium">Enter code:</span>
                    <input
                      type="text"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="w-24 px-2 py-1 text-sm border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                      maxLength={6}
                    />
                    <button
                      onClick={handleVerifyPhone}
                      disabled={phoneVerifying || phoneCode.length !== 6}
                      className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                    >
                      {phoneVerifying ? 'Verifying...' : 'Verify'}
                    </button>
                    <button
                      onClick={handleSendPhoneCode}
                      disabled={phoneSending}
                      className="text-sm text-orange-600 hover:text-orange-700 underline disabled:opacity-50"
                    >
                      Resend
                    </button>
                    {phoneError && <span className="text-sm text-red-600">{phoneError}</span>}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setDismissed(prev => ({ ...prev, phone: true }))}
              className="ml-4 text-orange-400 hover:text-orange-500"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ID Verification Banner for Couriers */}
      {isCourier && !user.id_verified && !dismissed.id && (
        <div className={`border-l-4 p-4 ${
          idVerificationFailed ? 'bg-red-50 border-red-400' :
          idVerificationRequiresReview ? 'bg-blue-50 border-blue-400' :
          idVerificationProcessing ? 'bg-blue-50 border-blue-400' :
          'bg-purple-50 border-purple-400'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className={`h-5 w-5 ${
                  idVerificationFailed ? 'text-red-400' :
                  idVerificationRequiresReview || idVerificationProcessing ? 'text-blue-400' :
                  'text-purple-400'
                }`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9a1 1 0 100 2h3a1 1 0 100-2h-3zm-1 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className={`text-sm ${
                  idVerificationFailed ? 'text-red-700' :
                  idVerificationRequiresReview || idVerificationProcessing ? 'text-blue-700' :
                  'text-purple-700'
                }`}>
                  {idVerificationFailed && (
                    <>
                      <span className="font-medium">ID verification failed.</span>
                      {' '}{idVerificationStatus?.verification?.rejection_reason || idVerificationStatus?.verification?.failure_reason || 'Please try again.'}
                      <button
                        onClick={handleStartIdVerification}
                        disabled={idVerificationLoading}
                        className="ml-2 font-medium underline text-red-700 hover:text-red-600 disabled:opacity-50"
                      >
                        {idVerificationLoading ? 'Starting...' : 'Try again'}
                      </button>
                    </>
                  )}
                  {idVerificationRequiresReview && (
                    <>
                      <span className="font-medium">ID verification under review.</span>
                      {' '}Our team is reviewing your verification. You will be notified once complete.
                    </>
                  )}
                  {idVerificationProcessing && (
                    <>
                      <span className="font-medium">ID verification processing.</span>
                      {' '}Your verification is being processed. This usually takes a few minutes.
                    </>
                  )}
                  {needsIdVerification && !idVerificationFailed && !idVerificationProcessing && !idVerificationRequiresReview && (
                    <>
                      <span className="font-medium">ID verification required.</span>
                      {' '}Verify your identity to start accepting deliveries.
                      <button
                        onClick={handleStartIdVerification}
                        disabled={idVerificationLoading}
                        className="ml-2 font-medium underline text-purple-700 hover:text-purple-600 disabled:opacity-50"
                      >
                        {idVerificationLoading ? 'Starting...' : 'Verify now'}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
            {!idVerificationProcessing && !idVerificationRequiresReview && (
              <button
                onClick={() => setDismissed(prev => ({ ...prev, id: true }))}
                className={`ml-4 ${
                  idVerificationFailed ? 'text-red-400 hover:text-red-500' :
                  'text-purple-400 hover:text-purple-500'
                }`}
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
