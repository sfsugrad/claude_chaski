'use client';

import Link from 'next/link';
import { PackageWizard } from './components/PackageWizard';

export default function CreatePackagePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-surface-900">
            Create Package Delivery
          </h1>
          <p className="mt-2 text-surface-600">
            Enter the details of your package and we'll match you with available couriers
          </p>
        </div>

        {/* Wizard */}
        <PackageWizard />
      </div>
    </div>
  );
}
