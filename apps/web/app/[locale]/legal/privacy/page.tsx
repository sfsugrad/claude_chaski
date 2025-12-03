'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function PrivacyPolicyPage() {
  const t = useTranslations('legal.privacy')
  const tLegal = useTranslations('legal')

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-gradient">
            MyChaski
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-surface-900 mb-2">{t('title')}</h1>
          <p className="text-sm text-surface-500 mb-8">{t('version')}</p>

          <div className="prose prose-surface max-w-none space-y-6">
            {/* Section 1 - Introduction */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section1Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section1Content')}
              </p>
            </section>

            {/* Section 2 - Information We Collect */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section2Title')}</h2>

              <h3 className="text-lg font-medium text-surface-800 mt-6 mb-3">{t('section2_1Title')}</h3>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section2_1Item1')}</li>
                <li>{t('section2_1Item2')}</li>
                <li>{t('section2_1Item3')}</li>
                <li>{t('section2_1Item4')}</li>
                <li>{t('section2_1Item5')}</li>
              </ul>

              <h3 className="text-lg font-medium text-surface-800 mt-6 mb-3">{t('section2_2Title')}</h3>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section2_2Item1')}</li>
                <li>{t('section2_2Item2')}</li>
                <li>{t('section2_2Item3')}</li>
                <li>{t('section2_2Item4')}</li>
              </ul>

              <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 mt-4">
                <p className="text-surface-700 text-sm">
                  <strong>{t('section2_2GPSTitle')}:</strong> {t('section2_2GPSContent')}
                </p>
              </div>
            </section>

            {/* Section 3 - How We Use Your Information */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section3Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section3Intro')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section3Item1')}</li>
                <li>{t('section3Item2')}</li>
                <li>{t('section3Item3')}</li>
                <li>{t('section3Item4')}</li>
                <li>{t('section3Item5')}</li>
                <li>{t('section3Item6')}</li>
                <li>{t('section3Item7')}</li>
                <li>{t('section3Item8')}</li>
              </ul>

              <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 mt-4 space-y-3">
                <p className="text-surface-700 text-sm">
                  <strong>{t('section3MessagingTitle')}:</strong> {t('section3Messaging')}
                </p>
                <p className="text-surface-700 text-sm">
                  <strong>{t('section3AnonymizedTitle')}:</strong> {t('section3Anonymized')}
                </p>
              </div>
            </section>

            {/* Section 4 - Information Sharing */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section4Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section4Intro')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section4Item1')}</li>
                <li>{t('section4Item2')}</li>
                <li>{t('section4Item3')}</li>
                <li>{t('section4Item4')}</li>
              </ul>
              <p className="text-surface-600 leading-relaxed mt-3 font-medium">
                {t('section4NoSell')}
              </p>
            </section>

            {/* Section 5 - Data Security */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section5Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section5Intro')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section5Item1')}</li>
                <li>{t('section5Item2')}</li>
                <li>{t('section5Item3')}</li>
                <li>{t('section5Item4')}</li>
                <li>{t('section5Item5')}</li>
              </ul>

              <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 mt-4">
                <p className="text-surface-700 text-sm">
                  <strong>{t('section5StorageTitle')}:</strong> {t('section5Storage')}
                </p>
              </div>
            </section>

            {/* Section 6 - Data Retention */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section6Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section6Content')}
              </p>
            </section>

            {/* Section 7 - Your Rights */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section7Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section7Intro')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section7Item1')}</li>
                <li>{t('section7Item2')}</li>
                <li>{t('section7Item3')}</li>
                <li>{t('section7Item4')}</li>
                <li>{t('section7Item5')}</li>
              </ul>
              <p className="text-surface-600 leading-relaxed mt-3">
                {t('section7Contact')}
              </p>
            </section>

            {/* Section 8 - Cookies and Tracking */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section8Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section8Content')}
              </p>
            </section>

            {/* Section 9 - Children's Privacy */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section9Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section9Content')}
              </p>
            </section>

            {/* Section 10 - Changes to This Policy */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section10Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section10Content')}
              </p>
            </section>

            {/* Section 11 - Contact Us */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section11Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section11Intro')}
              </p>
              <p className="text-surface-600 mt-2">
                {t('section11Email')}{' '}
                <a href="mailto:privacy@mychaski.com" className="text-primary-600 hover:text-primary-700">
                  privacy@mychaski.com
                </a>
              </p>
            </section>
          </div>

          {/* Back to Registration */}
          <div className="mt-12 pt-8 border-t border-surface-200">
            <Link
              href="/register"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              &larr; {tLegal('backToRegistration')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
