import Link from 'next/link'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function CourierAgreementPage() {
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
          <h1 className="text-3xl font-bold text-surface-900 mb-2">Courier Agreement</h1>
          <p className="text-sm text-surface-500 mb-8">Version 1.0 | Last Updated: December 2024</p>

          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-8">
            <p className="text-primary-800 text-sm">
              <strong>Important:</strong> This agreement is required for all users who wish to act as couriers on the Chaski platform.
              Please read it carefully before accepting delivery requests.
            </p>
          </div>

          <div className="prose prose-surface max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">1. Independent Contractor Status</h2>
              <p className="text-surface-600 leading-relaxed">
                You acknowledge and agree that you are an independent contractor and not an employee, agent, or partner of Chaski.
                You are solely responsible for:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4 mt-3">
                <li>Payment of all applicable taxes</li>
                <li>Obtaining necessary licenses or permits</li>
                <li>Compliance with all applicable laws</li>
                <li>Your own business expenses</li>
              </ul>
              <p className="text-surface-600 leading-relaxed mt-3">
                Chaski does not control the manner or method of your work and does not provide employment benefits.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">2. ID Verification Requirement</h2>
              <p className="text-surface-600 leading-relaxed">
                Before you can accept delivery requests, you must complete identity verification through our secure
                third-party provider (Stripe Identity). This verification:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4 mt-3">
                <li>Requires a valid government-issued ID</li>
                <li>May include a selfie for identity confirmation</li>
                <li>Must be successfully completed before accepting deliveries</li>
                <li>May need to be repeated periodically</li>
              </ul>
              <p className="text-surface-600 leading-relaxed mt-3">
                Providing false or fraudulent identification is grounds for immediate account termination.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">3. Delivery Responsibilities</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                As a Courier, you agree to:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>Handle all packages with reasonable care</li>
                <li>Complete deliveries within agreed timeframes</li>
                <li>Verify recipient identity when required</li>
                <li>Provide proof of delivery (photo, signature)</li>
                <li>Report any issues or delays promptly</li>
                <li>Not open, inspect, or tamper with packages</li>
                <li>Keep package contents confidential</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">4. Prohibited Actions</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                You agree NOT to:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>Accept packages containing prohibited items</li>
                <li>Transport items you suspect may be illegal</li>
                <li>Share sender or recipient personal information</li>
                <li>Arrange deliveries outside the Chaski platform</li>
                <li>Accept cash payments from senders or recipients</li>
                <li>Misrepresent your identity or qualifications</li>
                <li>Engage in any unsafe driving practices</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">5. Insurance and Liability</h2>
              <p className="text-surface-600 leading-relaxed">
                You acknowledge and agree that:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4 mt-3">
                <li>You are responsible for maintaining appropriate vehicle insurance</li>
                <li>Chaski is not responsible for damage to packages in your care</li>
                <li>You may be held liable for lost, stolen, or damaged packages due to negligence</li>
                <li>You should consider obtaining additional liability insurance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">6. Compensation and Payments</h2>
              <p className="text-surface-600 leading-relaxed">
                Compensation for deliveries is determined by the bidding process on our platform. You agree that:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4 mt-3">
                <li>Payment is processed through Stripe after delivery confirmation</li>
                <li>Chaski deducts a service fee from each transaction</li>
                <li>You are responsible for setting up and maintaining your payout account</li>
                <li>Payment disputes will be resolved according to our dispute resolution process</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">7. Ratings and Performance</h2>
              <p className="text-surface-600 leading-relaxed">
                Your performance on the platform is tracked through ratings and reviews. Consistently low ratings
                or policy violations may result in:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4 mt-3">
                <li>Reduced visibility in the matching algorithm</li>
                <li>Temporary suspension of courier privileges</li>
                <li>Permanent account termination for severe violations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">8. Safety and Conduct</h2>
              <p className="text-surface-600 leading-relaxed">
                You agree to conduct yourself professionally and safely at all times:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4 mt-3">
                <li>Follow all traffic laws and safety regulations</li>
                <li>Never operate a vehicle under the influence</li>
                <li>Treat all users with respect and professionalism</li>
                <li>Report any safety concerns immediately</li>
                <li>Comply with requests from law enforcement</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">9. Dispute Resolution</h2>
              <p className="text-surface-600 leading-relaxed">
                In case of disputes regarding deliveries or payments:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4 mt-3">
                <li>First attempt to resolve through our in-app support system</li>
                <li>Provide all relevant documentation and evidence</li>
                <li>Cooperate fully with Chaski's investigation</li>
                <li>Accept final decisions made by our dispute resolution team</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">10. Termination</h2>
              <p className="text-surface-600 leading-relaxed">
                Either party may terminate this agreement at any time. Chaski may terminate your courier
                status immediately for:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4 mt-3">
                <li>Violation of this agreement or our Terms of Service</li>
                <li>Fraudulent activity</li>
                <li>Consistent poor performance</li>
                <li>Safety concerns</li>
                <li>Legal or regulatory reasons</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">11. Acknowledgment</h2>
              <p className="text-surface-600 leading-relaxed">
                By accepting this Courier Agreement, you confirm that you:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4 mt-3">
                <li>Are at least 18 years of age</li>
                <li>Have a valid driver's license (if applicable)</li>
                <li>Have read and understood this entire agreement</li>
                <li>Agree to all terms and conditions stated herein</li>
                <li>Will comply with all applicable laws and regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">12. Contact Information</h2>
              <p className="text-surface-600 leading-relaxed">
                For questions about this Courier Agreement, please contact us:
              </p>
              <p className="text-surface-600 mt-2">
                Email: <a href="mailto:couriers@chaski.com" className="text-primary-600 hover:text-primary-700">couriers@chaski.com</a>
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
