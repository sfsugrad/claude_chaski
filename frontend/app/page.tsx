import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Welcome to Chaski
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Smart courier matching platform connecting senders with travelers
            going the same way
          </p>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-16">
            {/* Sender Card */}
            <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition">
              <div className="text-4xl mb-4">📦</div>
              <h2 className="text-2xl font-bold mb-4">I'm a Sender</h2>
              <p className="text-gray-600 mb-6">
                Need to send a package? Find couriers traveling along your route
              </p>
              <Link
                href="/sender"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
              >
                Send Package
              </Link>
            </div>

            {/* Courier Card */}
            <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition">
              <div className="text-4xl mb-4">🚗</div>
              <h2 className="text-2xl font-bold mb-4">I'm a Courier</h2>
              <p className="text-gray-600 mb-6">
                Earn money by delivering packages along your route
              </p>
              <Link
                href="/courier"
                className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
              >
                Find Packages
              </Link>
            </div>
          </div>

          <div className="mt-16">
            <Link
              href="/login"
              className="text-blue-600 hover:underline mr-6"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="text-blue-600 hover:underline"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
