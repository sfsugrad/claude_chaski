import Link from 'next/link'

export default function CourierPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">🚗</div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Earn Money as a Courier
            </h1>
            <p className="text-xl text-gray-600">
              Turn your travels into income by delivering packages along your route
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-3">💵</div>
              <h3 className="text-xl font-bold mb-2">Extra Income</h3>
              <p className="text-gray-600">
                Earn money on trips you're already making
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-3">📅</div>
              <h3 className="text-xl font-bold mb-2">Flexible Schedule</h3>
              <p className="text-gray-600">
                Choose which packages to deliver based on your route
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-3">✅</div>
              <h3 className="text-xl font-bold mb-2">Easy to Start</h3>
              <p className="text-gray-600">
                Simple registration and instant matching with packages
              </p>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-12">
            <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
            <div className="space-y-6">
              <div className="flex items-start">
                <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Create Your Profile</h3>
                  <p className="text-gray-600">
                    Sign up as a courier and set up your profile with vehicle details
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Share Your Route</h3>
                  <p className="text-gray-600">
                    Enter your travel plans and get matched with packages along your way
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Accept Deliveries</h3>
                  <p className="text-gray-600">
                    Review package details and accept deliveries that fit your schedule
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  4
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Deliver & Get Paid</h3>
                  <p className="text-gray-600">
                    Complete the delivery and receive payment directly to your account
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="bg-green-50 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-center mb-6">Why Become a Chaski Courier?</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start">
                <div className="text-2xl mr-3">✓</div>
                <div>
                  <h3 className="font-bold mb-1">No Extra Detours</h3>
                  <p className="text-gray-600">Only deliver packages that match your existing route</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="text-2xl mr-3">✓</div>
                <div>
                  <h3 className="font-bold mb-1">Be Your Own Boss</h3>
                  <p className="text-gray-600">Choose when and where you want to deliver</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="text-2xl mr-3">✓</div>
                <div>
                  <h3 className="font-bold mb-1">Safe & Secure</h3>
                  <p className="text-gray-600">All packages are insured and senders are verified</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="text-2xl mr-3">✓</div>
                <div>
                  <h3 className="font-bold mb-1">Quick Payments</h3>
                  <p className="text-gray-600">Get paid immediately after successful delivery</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="text-center space-y-4">
            <div>
              <Link
                href="/register"
                className="inline-block bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-700 transition shadow-lg"
              >
                Start Earning - Become a Courier
              </Link>
            </div>
            <div>
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="text-green-600 hover:underline font-semibold"
                >
                  Sign In
                </Link>
              </p>
            </div>
            <div className="pt-4">
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
