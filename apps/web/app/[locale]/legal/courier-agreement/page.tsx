'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function CourierAgreementPage() {
  const t = useTranslations('legal.courierAgreement')
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

          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-8">
            <p className="text-primary-800 text-sm">
              <strong>{t('importantNote')}</strong> {t('importantContent')}
            </p>
          </div>

          <div className="prose prose-surface max-w-none space-y-6">
            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section1Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section1Content')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section1Item1')}</li>
                <li>{t('section1Item2')}</li>
                <li>{t('section1Item3')}</li>
                <li>{t('section1Item4')}</li>
              </ul>
              <p className="text-surface-600 leading-relaxed mt-3">
                {t('section1Disclaimer')}
              </p>
              <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 mt-4">
                <p className="text-surface-700 text-sm">
                  {t('section1NoGuarantee')}
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section2Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section2Content')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section2Item1')}</li>
                <li>{t('section2Item2')}</li>
                <li>{t('section2Item3')}</li>
                <li>{t('section2Item4')}</li>
              </ul>
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mt-4">
                <p className="text-warning-800">
                  {t('section2Warning')}
                </p>
              </div>
            </section>

            {/* Section 3 */}
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
              </ul>
            </section>

            {/* Section 4 */}
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
                <li>{t('section4Item5')}</li>
                <li>{t('section4Item6')}</li>
                <li>{t('section4Item7')}</li>
              </ul>
              <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 mt-4">
                <p className="text-surface-700 text-sm">
                  <strong>{t('section4ConfidentialityTitle')}:</strong> {t('section4Confidentiality')}
                </p>
              </div>
            </section>

            {/* Section 5 */}
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
              </ul>
              <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 mt-4">
                <p className="text-surface-700 text-sm">
                  <strong>{t('section5IndemnificationTitle')}:</strong> {t('section5Indemnification')}
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section6Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section6Content')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section6Item1')}</li>
                <li>{t('section6Item2')}</li>
                <li>{t('section6Item3')}</li>
                <li>{t('section6Item4')}</li>
              </ul>
              <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 mt-4">
                <p className="text-surface-700 text-sm">
                  {t('section6NoGuarantee')}
                </p>
              </div>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section7Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section7Content')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section7Item1')}</li>
                <li>{t('section7Item2')}</li>
                <li>{t('section7Item3')}</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section8Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section8Content')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section8Item1')}</li>
                <li>{t('section8Item2')}</li>
                <li>{t('section8Item3')}</li>
                <li>{t('section8Item4')}</li>
                <li>{t('section8Item5')}</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section9Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section9Content')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section9Item1')}</li>
                <li>{t('section9Item2')}</li>
                <li>{t('section9Item3')}</li>
                <li>{t('section9Item4')}</li>
              </ul>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section10Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section10Content')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section10Item1')}</li>
                <li>{t('section10Item2')}</li>
                <li>{t('section10Item3')}</li>
                <li>{t('section10Item4')}</li>
                <li>{t('section10Item5')}</li>
              </ul>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section11Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section11Content')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section11Item1')}</li>
                <li>{t('section11Item2')}</li>
                <li>{t('section11Item3')}</li>
                <li>{t('section11Item4')}</li>
                <li>{t('section11Item5')}</li>
              </ul>
            </section>

            {/* Section 12 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section12Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section12Content')}
              </p>
              <p className="text-surface-600 mt-2">
                {t('section12Email')}{' '}
                <a href="mailto:couriers@mychaski.com" className="text-primary-600 hover:text-primary-700">
                  couriers@mychaski.com
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
