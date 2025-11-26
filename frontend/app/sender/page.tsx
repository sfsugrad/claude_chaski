import Link from 'next/link'

export default function SenderPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">📦</div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Send Packages with Chaski
            </h1>
            <p className="text-xl text-gray-600">
              Connect with trusted couriers traveling along your route
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="text-xl font-bold mb-2">Affordable Rates</h3>
              <p className="text-gray-600">
                Save money compared to traditional courier services
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-3">🚀</div>
              <h3 className="text-xl font-bold mb-2">Fast Delivery</h3>
              <p className="text-gray-600">
                Get matched with couriers already traveling your route
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="text-xl font-bold mb-2">Secure & Tracked</h3>
              <p className="text-gray-600">
                Real-time tracking and verified courier profiles
              </p>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-12">
            <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
            <div className="space-y-6">
              <div className="flex items-start">
                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Create Your Package Request</h3>
                  <p className="text-gray-600">
                    Describe your package, set pickup and dropoff locations, and offer a price
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Get Matched with Couriers</h3>
                  <p className="text-gray-600">
                    Our platform automatically finds couriers traveling along your route
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Review and Confirm</h3>
                  <p className="text-gray-600">
                    Choose your courier, confirm details, and schedule pickup
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  4
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Track & Receive</h3>
                  <p className="text-gray-600">
                    Monitor your package in real-time and confirm delivery
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="text-center space-y-4">
            <div>
              <Link
                href="/register"
                className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition shadow-lg"
              >
                Get Started - Create Account
              </Link>
            </div>
            <div>
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="text-blue-600 hover:underline font-semibold"
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
