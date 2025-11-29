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
import { Button, Input, Card, CardBody, Alert } from '@/components/ui'

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

export default function RegisterPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')

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
    full_name: '',
    role: 'sender' as 'sender' | 'courier' | 'both',
    phone_number: '',
    max_deviation_km: 5,
    default_address: '',
    default_address_lat: 0,
    default_address_lng: 0,
    preferred_language: 'en',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    if (!formData.email || !formData.password || !formData.full_name) {
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

    if (formData.password.length < 8) {
      setError(t('passwordMinLength'))
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

    if (formData.max_deviation_km < 1 || formData.max_deviation_km > 50) {
      setError(t('deviationRange'))
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
      if (err.response?.data?.detail) {
        setError(err.response.data.detail)
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
              {/* Full Name */}
              <Input
                label={t('fullName')}
                id="full_name"
                name="full_name"
                type="text"
                required
                value={formData.full_name}
                onChange={handleChange}
                placeholder={t('fullNamePlaceholder')}
                leftIcon={<UserIcon />}
                autoComplete="name"
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
              <Input
                label={t('password')}
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder={t('passwordPlaceholder')}
                leftIcon={<LockIcon />}
                helperText={t('passwordHelper')}
                autoComplete="new-password"
              />

              {/* Confirm Password */}
              <Input
                label={t('confirmPassword')}
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder={t('confirmPasswordPlaceholder')}
                leftIcon={<LockIcon />}
                autoComplete="new-password"
              />

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
                  defaultCountry={getDefaultCountry(locale) as any}
                  value={formData.phone_number}
                  onChange={(value) => setFormData(prev => ({ ...prev, phone_number: value || '' }))}
                  className="phone-input"
                  placeholder={t('phonePlaceholder')}
                />
                <p className="helper-text">
                  {t('phoneHelper')}
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
                    value={formData.max_deviation_km}
                    onChange={handleChange}
                    className="input"
                  />
                  <p className="helper-text">
                    {t('maxDeviationHelper')}
                  </p>
                </div>
              )}

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
    </div>
  )
}
