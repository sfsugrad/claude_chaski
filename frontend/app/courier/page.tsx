'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { couriersAPI, authAPI, ratingsAPI, packagesAPI, RouteResponse, UserResponse, PendingRating, PackageResponse } from '@/lib/api'
import Navbar from '@/components/Navbar'
import RatingModal from '@/components/RatingModal'
import { CourierDashboardSkeleton } from '@/components/ui'

export default function CourierDashboard() {
  const [routes, setRoutes] = useState<RouteResponse[]>([])
  const [activeRoute, setActiveRoute] = useState<RouteResponse | null>(null)
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([])
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [currentRatingIndex, setCurrentRatingIndex] = useState(0)
  const [assignedPackages, setAssignedPackages] = useState<PackageResponse[]>([])
  const router = useRouter()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    try {
      // Verify user is courier or both
      const userResponse = await authAPI.getCurrentUser()
      const userData = userResponse.data
      setUser(userData)

      if (userData.role !== 'courier' && userData.role !== 'both') {
        router.push('/')
        return
      }

      await loadRoutes()
      await loadPendingRatings()
      await loadAssignedPackages()
    } catch (err) {
      setError('Failed to load data. Please log in.')
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const loadAssignedPackages = async () => {
    try {
      const response = await packagesAPI.getAll()
      // Filter to only show packages where user is the courier (not sender)
      // and exclude delivered/cancelled packages
      const courierPackages = response.data.filter(
        (pkg: PackageResponse) =>
          pkg.courier_id !== null &&
          !['delivered', 'cancelled'].includes(pkg.status)
      )
      setAssignedPackages(courierPackages)
    } catch (err) {
      console.error('Failed to load assigned packages:', err)
    }
  }

  const loadPendingRatings = async () => {
    try {
      const response = await ratingsAPI.getMyPendingRatings()
      setPendingRatings(response.data)
      if (response.data.length > 0) {
        setShowRatingModal(true)
      }
    } catch (err) {
      console.error('Failed to load pending ratings:', err)
    }
  }

  const handleRatingSubmitted = () => {
    if (currentRatingIndex < pendingRatings.length - 1) {
      setCurrentRatingIndex(currentRatingIndex + 1)
    } else {
      setShowRatingModal(false)
      setCurrentRatingIndex(0)
      loadPendingRatings()
    }
  }

  const handleRatingModalClose = () => {
    if (currentRatingIndex < pendingRatings.length - 1) {
      setCurrentRatingIndex(currentRatingIndex + 1)
    } else {
      setShowRatingModal(false)
    }
  }

  const loadRoutes = async () => {
    try {
      const response = await couriersAPI.getRoutes()
      const allRoutes = response.data
      setRoutes(allRoutes)

      const active = allRoutes.find((r: RouteResponse) => r.is_active)
      setActiveRoute(active || null)
    } catch (err) {
      console.error('Failed to load routes:', err)
      setError('Failed to load routes')
    }
  }

  const deleteRoute = async (routeId: number) => {
    if (!confirm('Are you sure you want to deactivate this route?')) return

    try {
      await couriersAPI.deleteRoute(routeId)
      await loadRoutes()
    } catch (err) {
      alert('Failed to delete route')
    }
  }

  const activateRoute = async (routeId: number) => {
    const hasActiveRoute = routes.some(r => r.is_active)
    const message = hasActiveRoute
      ? 'This will deactivate your current active route. Continue?'
      : 'Activate this route?'

    if (!confirm(message)) return

    try {
      await couriersAPI.activateRoute(routeId)
      await loadRoutes()
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to activate route'
      alert(errorMessage)
    }
  }

  if (loading) {
    return <CourierDashboardSkeleton />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      {/* Rating Modal */}
      {pendingRatings.length > 0 && (
        <RatingModal
          isOpen={showRatingModal}
          onClose={handleRatingModalClose}
          pendingRating={pendingRatings[currentRatingIndex]}
          onRatingSubmitted={handleRatingSubmitted}
        />
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Courier Dashboard</h1>
          <Link
            href="/courier/routes/create"
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Create New Route
          </Link>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Pending Ratings Banner */}
        {pendingRatings.length > 0 && !showRatingModal && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="font-medium text-yellow-800">
                  You have {pendingRatings.length} pending {pendingRatings.length === 1 ? 'review' : 'reviews'}
                </p>
                <p className="text-sm text-yellow-600">
                  Rate your experience with senders whose packages you delivered
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowRatingModal(true)}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors font-medium"
            >
              Rate Now
            </button>
          </div>
        )}

        {/* Active Route Section */}
        {activeRoute && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-green-800 mb-2">
                  Active Route
                </h2>
                <div className="space-y-2">
                  <p><strong>From:</strong> {activeRoute.start_address}</p>
                  <p><strong>To:</strong> {activeRoute.end_address}</p>
                  <p><strong>Max Deviation:</strong> {activeRoute.max_deviation_km} km</p>
                  {activeRoute.departure_time && (
                    <p><strong>Departure:</strong> {new Date(activeRoute.departure_time).toLocaleString()}</p>
                  )}
                  <p className="text-sm text-gray-600">Created: {new Date(activeRoute.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="space-x-2">
                <Link
                  href={`/courier/routes/${activeRoute.id}/matches`}
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  View Matches
                </Link>
                <button
                  onClick={() => deleteRoute(activeRoute.id)}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                >
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assigned Packages Section */}
        {assignedPackages.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">
              Assigned Packages ({assignedPackages.length})
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Packages you've accepted and need to deliver
            </p>
            <div className="space-y-4">
              {assignedPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="border rounded-lg p-4 hover:border-green-300 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{pkg.description}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          pkg.status === 'matched' ? 'bg-blue-100 text-blue-800' :
                          pkg.status === 'picked_up' ? 'bg-yellow-100 text-yellow-800' :
                          pkg.status === 'in_transit' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {pkg.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Pickup</p>
                          <p className="text-gray-700">{pkg.pickup_address}</p>
                          {pkg.pickup_contact_name && (
                            <p className="text-gray-500 text-xs">Contact: {pkg.pickup_contact_name}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-gray-500">Dropoff</p>
                          <p className="text-gray-700">{pkg.dropoff_address}</p>
                          {pkg.dropoff_contact_name && (
                            <p className="text-gray-500 text-xs">Contact: {pkg.dropoff_contact_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                        <span>📦 {pkg.size}</span>
                        <span>⚖️ {pkg.weight_kg} kg</span>
                        {pkg.price && <span className="text-green-600 font-medium">${pkg.price.toFixed(2)}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <Link
                        href={`/packages/${pkg.id}`}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors text-sm text-center"
                      >
                        View Details
                      </Link>
                      <Link
                        href={`/messages?package=${pkg.id}`}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm text-center"
                      >
                        Message Sender
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Active Route Message */}
        {!activeRoute && routes.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <p className="text-yellow-800">
              You don't have an active route. Create a new route to start finding package matches!
            </p>
          </div>
        )}

        {/* First Time User Message */}
        {routes.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-blue-800 mb-2">Welcome to Chaski!</h2>
            <p className="text-blue-700">
              Get started by creating your first route. We'll match you with packages along your way.
            </p>
          </div>
        )}

        {/* Route History */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Route History</h2>
          {routes.length === 0 ? (
            <p className="text-gray-600">No routes yet. Create your first route to start earning!</p>
          ) : (
            <div className="space-y-4">
              {routes.map((route) => (
                <div
                  key={route.id}
                  className={`border rounded-lg p-4 ${
                    route.is_active ? 'border-green-300 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{route.start_address} &rarr; {route.end_address}</p>
                      <p className="text-sm text-gray-600">
                        Created: {new Date(route.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Deviation: {route.max_deviation_km} km
                      </p>
                      <p className="text-sm text-gray-600">
                        Status: {route.is_active ? '🟢 Active' : '⚫ Inactive'}
                      </p>
                    </div>
                    <div className="space-x-2">
                      {route.is_active && (
                        <Link
                          href={`/courier/routes/${route.id}/matches`}
                          className="inline-block text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Matches
                        </Link>
                      )}
                      {!route.is_active && (
                        <>
                          <button
                            onClick={() => activateRoute(route.id)}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            Activate
                          </button>
                          <button
                            onClick={() => deleteRoute(route.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
