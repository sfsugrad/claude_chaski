'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { authAPI } from '@/lib/api'
import GoogleSignInButton from '@/components/GoogleSignInButton'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { Button, Input, PasswordInput, Card, CardBody, Alert } from '@/components/ui'
import { kmToMiles, milesToKm } from '@/lib/distance'

// Icons
const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

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

const PhoneIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

// Password validation helpers
const validatePasswordRequirements = (password: string) => {
  return {
    minLength: password.length >= 12,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;`~]/.test(password),
  }
}

// Password Requirements Component
const PasswordRequirements = ({ password }: { password: string }) => {
  const requirements = validatePasswordRequirements(password)
  const hasStartedTyping = password.length > 0

  const items = [
    { key: 'minLength', label: 'At least 12 characters', met: requirements.minLength },
    { key: 'hasUppercase', label: 'One uppercase letter (A-Z)', met: requirements.hasUppercase },
    { key: 'hasLowercase', label: 'One lowercase letter (a-z)', met: requirements.hasLowercase },
    { key: 'hasDigit', label: 'One digit (0-9)', met: requirements.hasDigit },
    { key: 'hasSpecial', label: 'One special character (!@#$...)', met: requirements.hasSpecial },
  ]

  if (!hasStartedTyping) {
    return (
      <div className="mt-2 p-3 bg-surface-50 rounded-lg border border-surface-200">
        <p className="text-xs font-medium text-surface-600 mb-2">Password must contain:</p>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-xs text-surface-500">
              <span className="w-4 h-4 rounded-full border border-surface-300 flex-shrink-0" />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const allMet = Object.values(requirements).every(Boolean)

  return (
    <div className={`mt-2 p-3 rounded-lg border ${allMet ? 'bg-success-50 border-success-200' : 'bg-surface-50 border-surface-200'}`}>
      <p className="text-xs font-medium text-surface-600 mb-2">
        {allMet ? 'Password meets all requirements!' : 'Password requirements:'}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.key}
            className={`flex items-center gap-2 text-xs ${
              item.met ? 'text-success-600' : 'text-error-600'
            }`}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
              item.met ? 'bg-success-100 text-success-600' : 'bg-error-100 text-error-600'
            }`}>
              {item.met ? <CheckIcon /> : <XIcon />}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tPrivacy = useTranslations('legal.privacy')

  // Map locale to country code for phone input
  const getDefaultCountry = (locale: string) => {
    const countryMap: { [key: string]: string } = {
      'en': 'US',
      'fr': 'FR',
      'es': 'ES'
    }
    return countryMap[locale] || 'US'
  }

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    role: 'sender' as 'sender' | 'courier' | 'both',
    phone_number: '',
    max_deviation_km: 5,
    default_address: '',
    default_address_lat: 0,
    default_address_lng: 0,
    preferred_language: 'en',
    terms_accepted: false,
    privacy_accepted: false,
    courier_agreement_accepted: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showGeoBlockedModal, setShowGeoBlockedModal] = useState(false)
  const [geoBlockInfo, setGeoBlockInfo] = useState<{ message: string; country: string | null }>({ message: '', country: null })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'max_deviation_km' ? parseInt(value) || 5 : value,
    }))
  }

  const handleAddressChange = (address: string, lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      default_address: address,
      default_address_lat: lat,
      default_address_lng: lng,
    }))
  }

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
      setError(t('allFieldsRequired'))
      return false
    }

    if (!formData.phone_number) {
      setError(t('phoneRequired'))
      return false
    }

    // Validate phone number format (E.164 format: + followed by 1-15 digits)
    const phoneRegex = /^\+[1-9]\d{1,14}$/
    if (!phoneRegex.test(formData.phone_number)) {
      setError(t('invalidPhoneNumber'))
      return false
    }

    // Validate password requirements
    const passwordReqs = validatePasswordRequirements(formData.password)
    if (!Object.values(passwordReqs).every(Boolean)) {
      setError('Password does not meet all requirements')
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordsNoMatch'))
      return false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError(t('invalidEmail'))
      return false
    }

    // Validate first name - must be at least 2 characters and contain only letters, spaces, hyphens, and apostrophes
    const trimmedFirstName = formData.first_name.trim()
    if (trimmedFirstName.length < 2) {
      setError(t('nameTooShort'))
      return false
    }
    // Allow letters (including accented), spaces, hyphens, and apostrophes
    const nameRegex = /^[\p{L}\s\-']+$/u
    if (!nameRegex.test(trimmedFirstName)) {
      setError(t('invalidName'))
      return false
    }

    // Validate last name - must be at least 2 characters
    const trimmedLastName = formData.last_name.trim()
    if (trimmedLastName.length < 2) {
      setError(t('nameTooShort'))
      return false
    }
    if (!nameRegex.test(trimmedLastName)) {
      setError(t('invalidName'))
      return false
    }

    // Validate middle name if provided (optional)
    if (formData.middle_name.trim()) {
      if (!nameRegex.test(formData.middle_name.trim())) {
        setError(t('invalidName'))
        return false
      }
    }

    if (formData.max_deviation_km < 1 || formData.max_deviation_km > 80) {
      setError(t('deviationRange'))
      return false
    }

    // Validate legal agreement acceptance
    if (!formData.terms_accepted) {
      setError('You must accept the Terms of Service to register')
      return false
    }
    if (!formData.privacy_accepted) {
      setError('You must accept the Privacy Policy to register')
      return false
    }
    // Couriers must accept the Courier Agreement
    if ((formData.role === 'courier' || formData.role === 'both') && !formData.courier_agreement_accepted) {
      setError('Couriers must accept the Courier Agreement to register')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const { confirmPassword, default_address, default_address_lat, default_address_lng, ...baseData } = formData
      // Only include address fields if address is provided
      const registerData = {
        ...baseData,
        ...(default_address ? {
          default_address,
          default_address_lat,
          default_address_lng,
        } : {}),
      }
      const response = await authAPI.register(registerData)

      if (response.data) {
        router.push('/register-success')
      }
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail

      // Check for geo-restriction error
      if (errorDetail?.error_code === 'COUNTRY_NOT_ALLOWED') {
        setGeoBlockInfo({
          message: errorDetail.message || 'Registration is not available in your region.',
          country: errorDetail.country_detected
        })
        setShowGeoBlockedModal(true)
      } else if (errorDetail) {
        // Handle other structured errors
        if (typeof errorDetail === 'string') {
          setError(errorDetail)
        } else if (errorDetail.message) {
          setError(errorDetail.message)
        } else {
          setError(JSON.stringify(errorDetail))
        }
      } else {
        setError(t('registrationFailed'))
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

      {/* Language Switcher */}
      <div className="absolute top-8 right-8 z-10">
        <LanguageSwitcher />
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block mb-6">
            <span className="text-3xl font-bold text-gradient">Chaski</span>
          </Link>
          <h1 className="text-2xl font-bold text-surface-900">
            {t('registerTitle')}
          </h1>
          <p className="mt-2 text-surface-500">
            {t('registerSubtitle')}
          </p>
        </div>

        <Card className="animate-fade-in-up">
          <CardBody className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="error" dismissible onDismiss={() => setError('')}>
                {error}
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
                  <span className="px-3 bg-white text-surface-400">{t('orRegisterWithEmail')}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* First Name */}
                <Input
                  label={t('firstName')}
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder={t('firstNamePlaceholder')}
                  leftIcon={<UserIcon />}
                  autoComplete="given-name"
                />

                {/* Last Name */}
                <Input
                  label={t('lastName')}
                  id="last_name"
                  name="last_name"
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder={t('lastNamePlaceholder')}
                  autoComplete="family-name"
                />
              </div>

              {/* Middle Name (Optional) */}
              <Input
                label={t('middleName')}
                id="middle_name"
                name="middle_name"
                type="text"
                value={formData.middle_name}
                onChange={handleChange}
                placeholder={t('middleNamePlaceholder')}
                autoComplete="additional-name"
              />

              {/* Email */}
              <Input
                label={t('email')}
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder={t('emailPlaceholder')}
                leftIcon={<MailIcon />}
                autoComplete="email"
              />

              {/* Password */}
              <div>
                <PasswordInput
                  label={t('password')}
                  id="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={t('passwordPlaceholder')}
                  leftIcon={<LockIcon />}
                  autoComplete="new-password"
                />
                <PasswordRequirements password={formData.password} />
              </div>

              {/* Confirm Password */}
              <div>
                <PasswordInput
                  label={t('confirmPassword')}
                  id="confirmPassword"
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder={t('confirmPasswordPlaceholder')}
                  leftIcon={<LockIcon />}
                  autoComplete="new-password"
                />
                {formData.confirmPassword.length > 0 && (
                  <div className={`mt-2 flex items-center gap-2 text-xs ${
                    formData.password === formData.confirmPassword
                      ? 'text-success-600'
                      : 'text-error-600'
                  }`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                      formData.password === formData.confirmPassword
                        ? 'bg-success-100 text-success-600'
                        : 'bg-error-100 text-error-600'
                    }`}>
                      {formData.password === formData.confirmPassword ? <CheckIcon /> : <XIcon />}
                    </span>
                    {formData.password === formData.confirmPassword
                      ? 'Passwords match'
                      : 'Passwords do not match'}
                  </div>
                )}
              </div>

              {/* Role */}
              <div className="form-group">
                <label htmlFor="role" className="label">
                  {t('roleLabel')}
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="select"
                >
                  <option value="sender">{t('roleSender')}</option>
                  <option value="courier">{t('roleCourier')}</option>
                  <option value="both">{t('roleBoth')}</option>
                </select>
              </div>

              {/* Phone Number */}
              <div className="form-group">
                <label htmlFor="phone_number" className="label">
                  {t('phoneNumber')}
                </label>
                <PhoneInput
                  international
                  defaultCountry="US"
                  countries={['US']}
                  value={formData.phone_number}
                  onChange={(value) => setFormData(prev => ({ ...prev, phone_number: value || '' }))}
                  className="phone-input"
                  placeholder={t('phonePlaceholder')}
                />
                <p className="helper-text">
                  US phone numbers only (+1)
                </p>
              </div>

              {/* Preferred Language */}
              <div className="form-group">
                <label htmlFor="preferred_language" className="label">
                  {t('preferredLanguage')}
                </label>
                <select
                  id="preferred_language"
                  name="preferred_language"
                  value={formData.preferred_language}
                  onChange={handleChange}
                  className="select"
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                </select>
                <p className="helper-text">
                  {t('preferredLanguageHelper')}
                </p>
              </div>

              {/* Default Address (for senders) */}
              {(formData.role === 'sender' || formData.role === 'both') && (
                <div className="form-group">
                  <label htmlFor="default_address" className="label">
                    {t('defaultAddress')}
                  </label>
                  <AddressAutocomplete
                    id="default_address"
                    name="default_address"
                    value={formData.default_address}
                    onChange={handleAddressChange}
                    placeholder={t('addressPlaceholder')}
                    className="input"
                  />
                  <p className="helper-text">
                    {t('addressHelper')}
                  </p>
                </div>
              )}

              {/* Max Deviation (only for couriers) */}
              {(formData.role === 'courier' || formData.role === 'both') && (
                <div className="form-group">
                  <label htmlFor="max_deviation_km" className="label">
                    {t('maxDeviation')}
                  </label>
                  <input
                    id="max_deviation_km"
                    name="max_deviation_km"
                    type="number"
                    min="1"
                    max="50"
                    step="1"
                    value={Math.round(kmToMiles(formData.max_deviation_km))}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      max_deviation_km: Math.round(milesToKm(parseFloat(e.target.value) || 3)),
                    }))}
                    className="input"
                  />
                  <p className="helper-text">
                    {t('maxDeviationHelper')}
                  </p>
                </div>
              )}

              {/* Legal Agreements Section */}
              <div className="space-y-4 border-t border-surface-200 pt-5 mt-5">
                <h3 className="text-sm font-medium text-surface-700">Legal Agreements</h3>

                {/* Privacy-friendly summary */}
                <p className="text-xs text-surface-500 italic">
                  {tPrivacy('friendlySummary')}
                </p>

                {/* Terms of Service */}
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="terms_accepted"
                      name="terms_accepted"
                      type="checkbox"
                      checked={formData.terms_accepted}
                      onChange={(e) => setFormData(prev => ({ ...prev, terms_accepted: e.target.checked }))}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-surface-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="terms_accepted" className="text-surface-700">
                      I have read and agree to the{' '}
                      <Link
                        href="/legal/terms"
                        target="_blank"
                        className="text-primary-600 hover:text-primary-700 underline"
                      >
                        Terms of Service
                      </Link>
                      <span className="text-error-500">*</span>
                    </label>
                  </div>
                </div>

                {/* Privacy Policy */}
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="privacy_accepted"
                      name="privacy_accepted"
                      type="checkbox"
                      checked={formData.privacy_accepted}
                      onChange={(e) => setFormData(prev => ({ ...prev, privacy_accepted: e.target.checked }))}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-surface-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="privacy_accepted" className="text-surface-700">
                      I have read and agree to the{' '}
                      <Link
                        href="/legal/privacy"
                        target="_blank"
                        className="text-primary-600 hover:text-primary-700 underline"
                      >
                        Privacy Policy
                      </Link>
                      <span className="text-error-500">*</span>
                    </label>
                  </div>
                </div>

                {/* Courier Agreement (only for couriers) */}
                {(formData.role === 'courier' || formData.role === 'both') && (
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="courier_agreement_accepted"
                        name="courier_agreement_accepted"
                        type="checkbox"
                        checked={formData.courier_agreement_accepted}
                        onChange={(e) => setFormData(prev => ({ ...prev, courier_agreement_accepted: e.target.checked }))}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-surface-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="courier_agreement_accepted" className="text-surface-700">
                        I have read and agree to the{' '}
                        <Link
                          href="/legal/courier-agreement"
                          target="_blank"
                          className="text-primary-600 hover:text-primary-700 underline"
                        >
                          Courier Agreement
                        </Link>
                        <span className="text-error-500">*</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={loading}
              >
                {t('createAccount')}
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* Login Link */}
        <div className="text-center">
          <p className="text-sm text-surface-500">
            {t('haveAccount')}{' '}
            <Link
              href="/login"
              className="font-semibold text-primary-600 hover:text-primary-700 transition-colors"
            >
              {t('signIn')}
            </Link>
          </p>
        </div>
      </div>

      {/* Geo-Blocked Modal */}
      {showGeoBlockedModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowGeoBlockedModal(false)}
            />

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Registration Unavailable
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {geoBlockInfo.message}
                      </p>
                      {geoBlockInfo.country && (
                        <p className="mt-2 text-xs text-gray-400">
                          Detected location: {geoBlockInfo.country}
                        </p>
                      )}
                      <p className="mt-3 text-sm text-gray-600">
                        For assistance, please contact us at{' '}
                        <a href="mailto:support@chaski.com" className="text-primary-600 hover:text-primary-700">
                          support@chaski.com
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowGeoBlockedModal(false)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
