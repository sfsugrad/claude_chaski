import Link from 'next/link'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function TermsOfServicePage() {
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
          <h1 className="text-3xl font-bold text-surface-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-surface-500 mb-8">Version 1.0 | Last Updated: December 2024</p>

          <div className="prose prose-surface max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">1. Acceptance of Terms</h2>
              <p className="text-surface-600 leading-relaxed">
                By accessing or using the Chaski platform ("Service"), you agree to be bound by these Terms of Service ("Terms").
                If you do not agree to these Terms, please do not use the Service. We reserve the right to update these Terms at any time,
                and your continued use of the Service constitutes acceptance of any changes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">2. Description of Service</h2>
              <p className="text-surface-600 leading-relaxed">
                Chaski is a peer-to-peer logistics platform that connects individuals who need packages delivered ("Senders")
                with individuals traveling along similar routes who can carry those packages ("Couriers"). Chaski acts as an
                intermediary and does not itself provide delivery services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">3. User Accounts</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                To use certain features of the Service, you must register for an account. You agree to:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain the security of your password and account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Accept responsibility for all activities that occur under your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">4. User Responsibilities</h2>
              <h3 className="text-lg font-medium text-surface-800 mt-4 mb-2">4.1 All Users</h3>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>Comply with all applicable laws and regulations</li>
                <li>Use the Service only for lawful purposes</li>
                <li>Not engage in any fraudulent or deceptive practices</li>
                <li>Treat other users with respect</li>
              </ul>

              <h3 className="text-lg font-medium text-surface-800 mt-4 mb-2">4.2 Senders</h3>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>Provide accurate descriptions of packages</li>
                <li>Not ship prohibited items (illegal goods, hazardous materials, etc.)</li>
                <li>Properly package items to prevent damage</li>
                <li>Pay all agreed-upon fees in a timely manner</li>
              </ul>

              <h3 className="text-lg font-medium text-surface-800 mt-4 mb-2">4.3 Couriers</h3>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>Complete ID verification before accepting deliveries</li>
                <li>Handle packages with reasonable care</li>
                <li>Deliver packages within agreed timeframes</li>
                <li>Maintain appropriate insurance coverage as required by law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">5. Prohibited Items</h2>
              <p className="text-surface-600 leading-relaxed mb-3">
                The following items may not be shipped using our Service:
              </p>
              <ul className="list-disc list-inside text-surface-600 space-y-2 ml-4">
                <li>Illegal drugs or controlled substances</li>
                <li>Weapons, ammunition, or explosives</li>
                <li>Hazardous or flammable materials</li>
                <li>Stolen property</li>
                <li>Perishable items without proper packaging</li>
                <li>Live animals</li>
                <li>Items prohibited by law in the origin or destination jurisdiction</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">6. Fees and Payments</h2>
              <p className="text-surface-600 leading-relaxed">
                Chaski charges a service fee for facilitating transactions between Senders and Couriers.
                Payment terms, fee structures, and refund policies are displayed at the time of transaction.
                Couriers are paid through our secure payment system after successful delivery confirmation.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">7. Limitation of Liability</h2>
              <p className="text-surface-600 leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, CHASKI SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED
                DIRECTLY OR INDIRECTLY. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR YOUR USE OF
                THE SERVICE IS LIMITED TO THE AMOUNT YOU PAID TO CHASKI IN THE PAST 12 MONTHS.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">8. Dispute Resolution</h2>
              <p className="text-surface-600 leading-relaxed">
                Any disputes arising from these Terms or your use of the Service shall be resolved through binding
                arbitration in accordance with the rules of the American Arbitration Association. You agree to waive
                your right to a jury trial and to participate in any class action lawsuit.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">9. Termination</h2>
              <p className="text-surface-600 leading-relaxed">
                We reserve the right to suspend or terminate your account at any time for any reason, including
                violation of these Terms. Upon termination, your right to use the Service will immediately cease.
                You may also terminate your account at any time by contacting our support team.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-surface-900 mt-8 mb-4">10. Contact Information</h2>
              <p className="text-surface-600 leading-relaxed">
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="text-surface-600 mt-2">
                Email: <a href="mailto:legal@chaski.com" className="text-primary-600 hover:text-primary-700">legal@chaski.com</a>
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
