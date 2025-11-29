'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardBody, Button } from '@/components/ui'
import LanguageSwitcher from '@/components/LanguageSwitcher'

// Icons
const PackageIcon = () => (
  <svg className="w-12 h-12 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)

const CarIcon = () => (
  <svg className="w-12 h-12 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
)

const ShieldIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
)

const ClockIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const MoneyIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export default function Home() {
  const t = useTranslations('home')
  const tAuth = useTranslations('auth')

  return (
    <main className="min-h-screen bg-surface-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-100 rounded-full opacity-50 blur-3xl" />
          <div className="absolute top-20 -left-40 w-96 h-96 bg-secondary-100 rounded-full opacity-50 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-primary-50 rounded-full opacity-50 blur-3xl" />
        </div>

        {/* Language Switcher */}
        <div className="absolute top-8 right-8 z-10">
          <LanguageSwitcher />
        </div>

        <div className="relative page-container py-20 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-surface-900 tracking-tight mb-6">
              {t('heroTitle')}
            </h1>
            <p className="text-lg sm:text-xl text-surface-500 mb-10 max-w-2xl mx-auto">
              {t('heroSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button variant="primary" size="lg" className="w-full sm:w-auto">
                  {t('heroCtaPrimary')}
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  {tAuth('signIn')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="page-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-surface-900 mb-4">{t('chooseRoleTitle')}</h2>
            <p className="text-surface-500 max-w-xl mx-auto">
              {t('chooseRoleDescription')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Sender Card */}
            <Card hoverable className="text-center">
              <CardBody className="py-10">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-50 rounded-2xl mb-6">
                  <PackageIcon />
                </div>
                <h3 className="text-2xl font-bold text-surface-900 mb-3">{t('senderCardTitle')}</h3>
                <p className="text-surface-500 mb-8">
                  {t('senderCardDescription')}
                </p>
                <Link href="/sender">
                  <Button variant="primary" size="lg">
                    {t('senderButtonText')}
                  </Button>
                </Link>
              </CardBody>
            </Card>

            {/* Courier Card */}
            <Card hoverable className="text-center">
              <CardBody className="py-10">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-secondary-50 rounded-2xl mb-6">
                  <CarIcon />
                </div>
                <h3 className="text-2xl font-bold text-surface-900 mb-3">{t('courierCardTitle')}</h3>
                <p className="text-surface-500 mb-8">
                  {t('courierCardDescription')}
                </p>
                <Link href="/courier">
                  <Button variant="secondary" size="lg">
                    {t('courierButtonText')}
                  </Button>
                </Link>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-surface-50">
        <div className="page-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-surface-900 mb-4">{t('featuresTitle')}</h2>
            <p className="text-surface-500 max-w-xl mx-auto">
              {t('featuresDescription')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card>
              <CardBody className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-success-50 text-success-600 rounded-xl mb-4">
                  <ShieldIcon />
                </div>
                <h3 className="text-lg font-semibold text-surface-900 mb-2">{t('featureVerifiedTitle')}</h3>
                <p className="text-surface-500 text-sm">
                  {t('featureVerifiedDescription')}
                </p>
              </CardBody>
            </Card>

            {/* Feature 2 */}
            <Card>
              <CardBody className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-50 text-primary-600 rounded-xl mb-4">
                  <ClockIcon />
                </div>
                <h3 className="text-lg font-semibold text-surface-900 mb-2">{t('featureFastTitle')}</h3>
                <p className="text-surface-500 text-sm">
                  {t('featureFastDescription')}
                </p>
              </CardBody>
            </Card>

            {/* Feature 3 */}
            <Card>
              <CardBody className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-secondary-50 text-secondary-600 rounded-xl mb-4">
                  <MoneyIcon />
                </div>
                <h3 className="text-lg font-semibold text-surface-900 mb-2">{t('featureSaveMoneyTitle')}</h3>
                <p className="text-surface-500 text-sm">
                  {t('featureSaveMoneyDescription')}
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="page-container">
          <Card className="bg-gradient-to-r from-primary-600 to-primary-700 border-0">
            <CardBody className="py-12 px-8 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                {t('ctaTitle')}
              </h2>
              <p className="text-primary-100 mb-8 max-w-xl mx-auto">
                {t('ctaDescription')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button
                    variant="outline"
                    size="lg"
                    className="bg-white text-primary-700 border-white hover:bg-primary-50"
                  >
                    {t('ctaButton')}
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    variant="ghost"
                    size="lg"
                    className="text-white hover:bg-primary-500"
                  >
                    {tAuth('signIn')}
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-surface-200">
        <div className="page-container">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-gradient font-bold text-xl">Chaski</div>
            <p className="text-sm text-surface-400">
              &copy; {new Date().getFullYear()} Chaski. {t('footerRights')}
            </p>
            <div className="flex gap-6">
              <Link href="/login" className="text-sm text-surface-500 hover:text-primary-600 transition-colors">
                {tAuth('login')}
              </Link>
              <Link href="/register" className="text-sm text-surface-500 hover:text-primary-600 transition-colors">
                {tAuth('register')}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
