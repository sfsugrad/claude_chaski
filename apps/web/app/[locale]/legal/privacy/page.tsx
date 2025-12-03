import Link from 'next/link'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-gradient">
            Chaski
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-surface-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-surface-500 mb-8">Version 1.0 | Last Updated: December 2024</p>

          <div className="prose prose-surface max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">1. Introduction</h2>
              <p className="text-surface-600 leading-relaxed">
                At Chaski, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose,
                and safeguard your information when you use our platform. Please read this policy carefully to understand
                our practices regarding your personal data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">2. Information We Collect</h2>

              <h3 className="text-lg font-medium text-surface-800 mt-4 mb-2">2.1 Information You Provide</h3>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li><strong>Account Information:</strong> Name, email address, phone number, password</li>
                <li><strong>Profile Information:</strong> Preferred language, default addresses</li>
                <li><strong>Identity Verification:</strong> Government-issued ID for couriers (processed by Stripe Identity)</li>
                <li><strong>Payment Information:</strong> Payment method details (processed by Stripe)</li>
                <li><strong>Package Information:</strong> Pickup/delivery addresses, package descriptions</li>
              </ul>

              <h3 className="text-lg font-medium text-surface-800 mt-4 mb-2">2.2 Information Collected Automatically</h3>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li><strong>Device Information:</strong> Device type, operating system, browser type</li>
                <li><strong>Usage Data:</strong> Pages visited, features used, time spent on platform</li>
                <li><strong>Location Data:</strong> IP address, approximate location for matching</li>
                <li><strong>Cookies:</strong> Session cookies for authentication and preferences</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">3. How We Use Your Information</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                We use your information for the following purposes:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>Providing and improving our platform services</li>
                <li>Processing transactions and payments</li>
                <li>Matching senders with couriers based on routes</li>
                <li>Verifying courier identities for safety</li>
                <li>Communicating with you about your account and deliveries</li>
                <li>Detecting and preventing fraud or abuse</li>
                <li>Complying with legal obligations</li>
                <li>Analyzing usage to improve user experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">4. Information Sharing</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                We may share your information in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li><strong>With Other Users:</strong> Senders can see courier names; couriers can see sender names and addresses for deliveries</li>
                <li><strong>Service Providers:</strong> Third parties who help us operate our platform (Stripe, Twilio, AWS)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              </ul>
              <p className="text-surface-600 leading-relaxed mt-3">
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">5. Data Security</h2>
              <p className="text-surface-600 leading-relaxed">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4 mt-3">
                <li>Encryption of sensitive data in transit and at rest</li>
                <li>Secure password hashing with bcrypt</li>
                <li>HTTPS for all communications</li>
                <li>Regular security audits and monitoring</li>
                <li>Access controls and employee training</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">6. Data Retention</h2>
              <p className="text-surface-600 leading-relaxed">
                We retain your personal information for as long as your account is active or as needed to provide
                services. We may retain certain information for longer periods for legal, tax, or regulatory purposes.
                You may request deletion of your account, subject to our legal obligations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">7. Your Rights</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                Depending on your location, you may have the following rights:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your data</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                <li><strong>Opt-out:</strong> Opt out of marketing communications</li>
              </ul>
              <p className="text-surface-600 leading-relaxed mt-3">
                To exercise these rights, contact us at privacy@chaski.com.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">8. Cookies and Tracking</h2>
              <p className="text-surface-600 leading-relaxed">
                We use essential cookies to enable authentication and remember your preferences. We do not use
                third-party tracking cookies for advertising. You can control cookies through your browser settings,
                though disabling them may affect platform functionality.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">9. Children's Privacy</h2>
              <p className="text-surface-600 leading-relaxed">
                Our Service is not intended for individuals under 18 years of age. We do not knowingly collect
                personal information from children. If we learn we have collected data from a child, we will
                delete it promptly.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">10. Changes to This Policy</h2>
              <p className="text-surface-600 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of material changes by
                email or through the platform. Your continued use of the Service after changes constitutes
                acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">11. Contact Us</h2>
              <p className="text-surface-600 leading-relaxed">
                If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
              </p>
              <p className="text-surface-600 mt-2">
                Email: <a href="mailto:privacy@chaski.com" className="text-primary-600 hover:text-primary-700">privacy@chaski.com</a>
              </p>
            </section>
          </div>

          {/* Back to Registration */}
          <div className="mt-12 pt-8 border-t border-surface-200">
            <Link
              href="/register"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              &larr; Back to Registration
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
