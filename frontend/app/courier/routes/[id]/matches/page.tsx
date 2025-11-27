'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { matchingAPI, MatchedPackage } from '@/lib/api'

export default function RouteMatchesPage() {
  const params = useParams()
  const router = useRouter()
  const routeId = parseInt(params.id as string)

  const [matches, setMatches] = useState<MatchedPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMatches()
  }, [routeId])

  const loadMatches = async () => {
    try {
      const response = await matchingAPI.getPackagesAlongRoute(routeId)
      setMatches(response.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load matching packages')
    } finally {
      setLoading(false)
    }
  }

  const acceptPackage = async (packageId: number) => {
    try {
      await matchingAPI.acceptPackage(packageId)
      alert('Package accepted! The sender will be notified.')
      await loadMatches()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to accept package')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading matches...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <Link
            href="/courier"
            className="text-green-600 hover:text-green-700 flex items-center gap-2 mb-4"
          >
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">Matching Packages</h1>
          <p className="text-gray-600">Packages along your route, sorted by shortest detour</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {matches.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold mb-2">No Matches Yet</h2>
            <p className="text-gray-600">
              No packages match your route at the moment.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Check back later or try adjusting your route's maximum deviation.
            </p>
            <Link
              href="/courier"
              className="inline-block mt-6 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-800">
                Found <strong>{matches.length}</strong> package{matches.length !== 1 ? 's' : ''} matching your route
              </p>
            </div>

            {matches.map((pkg) => (
              <div key={pkg.package_id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-3">{pkg.description}</h3>

                    <div className="grid md:grid-cols-2 gap-6 mb-4">
                      {/* Package Details */}
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Package Details</h4>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-600">📦 Size: <span className="font-medium">{pkg.size}</span></p>
                          <p className="text-gray-600">⚖️ Weight: <span className="font-medium">{pkg.weight_kg} kg</span></p>
                          <p className="text-gray-600">📍 Distance from route: <span className="font-medium">{pkg.distance_from_route_km} km</span></p>
                          <p className="text-gray-600">🛣️ Estimated detour: <span className="font-medium">{pkg.estimated_detour_km} km</span></p>
                        </div>
                      </div>

                      {/* Pickup & Dropoff */}
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Locations</h4>
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="font-medium text-green-600">📍 Pickup:</p>
                            <p className="text-gray-600">{pkg.pickup_address}</p>
                            {pkg.pickup_contact_name && (
                              <p className="text-gray-500 text-xs">Contact: {pkg.pickup_contact_name}</p>
                            )}
                            {pkg.pickup_contact_phone && (
                              <p className="text-gray-500 text-xs">Phone: {pkg.pickup_contact_phone}</p>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-blue-600">📍 Dropoff:</p>
                            <p className="text-gray-600">{pkg.dropoff_address}</p>
                            {pkg.dropoff_contact_name && (
                              <p className="text-gray-500 text-xs">Contact: {pkg.dropoff_contact_name}</p>
                            )}
                            {pkg.dropoff_contact_phone && (
                              <p className="text-gray-500 text-xs">Phone: {pkg.dropoff_contact_phone}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {pkg.price && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 inline-block">
                        <p className="text-green-800 font-bold text-lg">
                          Offered Price: ${pkg.price.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => acceptPackage(pkg.package_id)}
                    className="ml-4 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium whitespace-nowrap"
                  >
                    Accept Package
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
