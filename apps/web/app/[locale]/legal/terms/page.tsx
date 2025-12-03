'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function TermsOfServicePage() {
  const t = useTranslations('legal.terms')
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
            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section1Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section1Content')}
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section2Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-4">
                {t('section2Content')}
              </p>
              <p className="text-surface-600 leading-relaxed mb-2">
                {t('section2DoesNot')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section2Item1')}</li>
                <li>{t('section2Item2')}</li>
                <li>{t('section2Item3')}</li>
                <li>{t('section2Item4')}</li>
                <li>{t('section2Item5')}</li>
              </ul>
              <p className="text-surface-600 leading-relaxed mt-3 font-medium">
                {t('section2NotCarrier')}
              </p>
              <p className="text-surface-600 leading-relaxed mt-3">
                {t('section2NoGuarantee')}
              </p>
              <p className="text-surface-600 leading-relaxed mt-3">
                {t('section2NoCommercial')}
              </p>
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
              </ul>
              <p className="text-surface-600 leading-relaxed mt-3">
                {t('section4Suspension')}
              </p>
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
                <li>{t('section5Item5')}</li>
              </ul>
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mt-4">
                <p className="text-warning-800">
                  {t('section5Failure')}
                </p>
              </div>
              <p className="text-surface-600 leading-relaxed mt-3 font-medium">
                {t('section5Additional')}
              </p>
              <p className="text-surface-600 leading-relaxed mt-3">
                {t('section5NoGuarantee')}
              </p>
              <div className="bg-surface-100 border border-surface-300 rounded-lg p-4 mt-4">
                <p className="text-surface-700 leading-relaxed font-medium">{t('section5GPSConsentTitle')}</p>
                <p className="text-surface-600 leading-relaxed mt-2">
                  {t('section5GPSConsent')}
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section6Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section6Intro')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section6Item1')}</li>
                <li>{t('section6Item2')}</li>
                <li>{t('section6Item3')}</li>
                <li>{t('section6Item4')}</li>
              </ul>
              <p className="text-surface-600 leading-relaxed mt-4">
                {t('section6ResponsibilityIntro')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4 mt-2">
                <li>{t('section6ResponsibilityItem1')}</li>
                <li>{t('section6ResponsibilityItem2')}</li>
                <li>{t('section6ResponsibilityItem3')}</li>
                <li>{t('section6ResponsibilityItem4')}</li>
              </ul>
              <p className="text-surface-600 leading-relaxed mt-4 font-medium">
                {t('section6NoInsurance')}
              </p>
              <p className="text-surface-600 leading-relaxed mt-2">
                {t('section6NoEmployment')}
              </p>
              <p className="text-surface-600 leading-relaxed mt-3">
                {t('section6TaxResponsibility')}
              </p>
              <p className="text-surface-600 leading-relaxed mt-3">
                {t('section6LocalLaws')}
              </p>
            </section>

            {/* Section 7 */}
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
                <li>{t('section7Item6')}</li>
                <li>{t('section7Item7')}</li>
                <li>{t('section7Item8')}</li>
                <li>{t('section7Item9')}</li>
              </ul>
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mt-4">
                <p className="text-warning-800">
                  {t('section7MaxValue')}
                </p>
              </div>
              <p className="text-surface-600 leading-relaxed mt-3">
                {t('section7Disclosure')}
              </p>
              <p className="text-surface-600 leading-relaxed mt-2">
                {t('section7NoInspection')}
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section8Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section8Content')}
              </p>
              <p className="text-surface-600 leading-relaxed mb-2">
                {t('section8DoesNot')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section8Item1')}</li>
                <li>{t('section8Item2')}</li>
                <li>{t('section8Item3')}</li>
                <li>{t('section8Item4')}</li>
              </ul>
              <div className="bg-surface-100 border border-surface-300 rounded-lg p-4 mt-4">
                <p className="text-surface-700 leading-relaxed font-medium">{t('section8NoBailmentTitle')}</p>
                <p className="text-surface-600 leading-relaxed mt-2">
                  {t('section8NoBailmentContent')}
                </p>
              </div>
              <div className="bg-surface-100 border border-surface-300 rounded-lg p-4 mt-4">
                <p className="text-surface-700 leading-relaxed font-medium">{t('section8NoRetentionTitle')}</p>
                <p className="text-surface-600 leading-relaxed mt-2">
                  {t('section8NoRetention')}
                </p>
              </div>
              <div className="bg-surface-100 border border-surface-300 rounded-lg p-4 mt-4">
                <p className="text-surface-700 leading-relaxed font-medium">{t('section8PlatformAvailabilityTitle')}</p>
                <p className="text-surface-600 leading-relaxed mt-2">
                  {t('section8PlatformAvailability')}
                </p>
              </div>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section9Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section9Content1')}
              </p>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section9Content2')}
              </p>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section9FeesNonRefundable')}
              </p>
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mt-4">
                <p className="text-warning-800 font-medium">{t('section9ChargebackTitle')}</p>
                <p className="text-warning-700 leading-relaxed mt-2">
                  {t('section9ChargebackContent')}
                </p>
              </div>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section10Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section10Intro')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section10Item1')}</li>
                <li>{t('section10Item2')}</li>
                <li>{t('section10Item3')}</li>
                <li>{t('section10Item4')}</li>
                <li>{t('section10Item5')}</li>
                <li>{t('section10Item6')}</li>
              </ul>
              <p className="text-surface-600 leading-relaxed mt-3">
                {t('section10Violation')}
              </p>
              <div className="bg-surface-100 border border-surface-300 rounded-lg p-4 mt-4">
                <p className="text-surface-700 leading-relaxed font-medium">{t('section10NoResponsibilityTitle')}</p>
                <p className="text-surface-600 leading-relaxed mt-2">
                  {t('section10NoResponsibilityContent')}
                </p>
              </div>
              <div className="bg-surface-100 border border-surface-300 rounded-lg p-4 mt-4">
                <p className="text-surface-700 leading-relaxed font-medium">{t('section10CommunicationTitle')}</p>
                <p className="text-surface-600 leading-relaxed mt-2">
                  {t('section10Communication')}
                </p>
              </div>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section11Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section11Intro')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section11Item1')}</li>
                <li>{t('section11Item2')}</li>
                <li>{t('section11Item3')}</li>
              </ul>
              <p className="text-surface-600 leading-relaxed mt-3">
                {t('section11Removal')}
              </p>
            </section>

            {/* Section 12 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section12Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section12Intro')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section12Item1')}</li>
                <li>{t('section12Item2')}</li>
                <li>
                  {t('section12Item3')}
                  <ul className="list-disc list-inside text-surface-600 space-y-1 ml-6 mt-1">
                    <li>{t('section12Item3a')}</li>
                    <li>{t('section12Item3b')}</li>
                  </ul>
                </li>
              </ul>
            </section>

            {/* Section 13 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section13Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section13Intro')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section13Item1')}</li>
                <li>{t('section13Item2')}</li>
                <li>{t('section13Item3')}</li>
                <li>{t('section13Item4')}</li>
              </ul>
            </section>

            {/* Section 14 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section14Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section14Content')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section14Item1')}</li>
                <li>{t('section14Item2')}</li>
              </ul>
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mt-4">
                <p className="text-warning-800 leading-relaxed">
                  {t('section14ArbitrationFirst')}
                </p>
              </div>
            </section>

            {/* Section 15 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section15Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section15Content')}
              </p>
            </section>

            {/* Section 16 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section16Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section16Content')}
              </p>
            </section>

            {/* Section 17 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section17Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section17Content')}
              </p>
            </section>

            {/* Section 18 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section18Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section18Content')}
              </p>
              <div className="bg-surface-100 border border-surface-300 rounded-lg p-4 mt-4">
                <p className="text-surface-700 leading-relaxed font-medium">{t('section18UserContentTitle')}</p>
                <p className="text-surface-600 leading-relaxed mt-2">
                  {t('section18UserContent')}
                </p>
              </div>
            </section>

            {/* Section 19 */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section19Title')}</h2>
              <p className="text-surface-600 leading-relaxed">
                {t('section19Content')}
              </p>
              <p className="text-surface-600 mt-2">
                <a href="mailto:legal@mychaski.com" className="text-primary-600 hover:text-primary-700">
                  legal@mychaski.com
                </a>
              </p>
            </section>

            {/* Section 20 - Final Acknowledgement */}
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">{t('section20Title')}</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                {t('section20Intro')}
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>{t('section20Item1')}</li>
                <li>{t('section20Item2')}</li>
                <li>{t('section20Item3')}</li>
              </ul>
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mt-4">
                <p className="text-primary-800 leading-relaxed">
                  {t('privacyReference')}{' '}
                  <Link href="/legal/privacy" className="text-primary-600 hover:text-primary-700 underline">
                    Privacy Policy
                  </Link>.
                </p>
              </div>
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
