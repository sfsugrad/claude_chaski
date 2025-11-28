'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { couriersAPI, authAPI, ratingsAPI, packagesAPI, RouteResponse, UserResponse, PendingRating, PackageResponse } from '@/lib/api'
import Navbar from '@/components/Navbar'
import RatingModal from '@/components/RatingModal'
import {
  CourierDashboardSkeleton,
  Card,
  CardBody,
  CardHeader,
  Button,
  Badge,
  Alert,
  EmptyRoutes,
  FadeIn,
  SlideIn
} from '@/components/ui'

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
    <div className="min-h-screen bg-surface-50">
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

      <div className="page-container py-8">
        <FadeIn duration={400}>
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-900">Courier Dashboard</h1>
            <Link href="/courier/routes/create">
              <Button
                variant="success"
                leftIcon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                Create New Route
              </Button>
            </Link>
          </div>
        </FadeIn>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* Pending Ratings Banner */}
        {pendingRatings.length > 0 && !showRatingModal && (
          <SlideIn direction="down" duration={400}>
            <Alert variant="warning" className="mb-6">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⭐</span>
                  <div>
                    <p className="font-medium">
                      You have {pendingRatings.length} pending {pendingRatings.length === 1 ? 'review' : 'reviews'}
                    </p>
                    <p className="text-sm opacity-80">
                      Rate your experience with senders whose packages you delivered
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowRatingModal(true)}
                >
                  Rate Now
                </Button>
              </div>
            </Alert>
          </SlideIn>
        )}

        {/* Active Route Section */}
        {activeRoute && (
          <SlideIn direction="up" delay={100} duration={400}>
            <Card className="border-2 border-success-200 bg-success-50 mb-8">
              <CardBody>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="success">Active Route</Badge>
                    </div>
                    <div className="space-y-2 text-surface-700">
                      <p><strong className="text-surface-900">From:</strong> {activeRoute.start_address}</p>
                      <p><strong className="text-surface-900">To:</strong> {activeRoute.end_address}</p>
                      <p><strong className="text-surface-900">Max Deviation:</strong> {activeRoute.max_deviation_km} km</p>
                      {activeRoute.departure_time && (
                        <p><strong className="text-surface-900">Departure:</strong> {new Date(activeRoute.departure_time).toLocaleString()}</p>
                      )}
                      <p className="text-sm text-surface-500">Created: {new Date(activeRoute.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/courier/routes/${activeRoute.id}/matches`}>
                      <Button variant="primary" size="sm">
                        View Matches
                      </Button>
                    </Link>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteRoute(activeRoute.id)}
                    >
                      Deactivate
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </SlideIn>
        )}

        {/* Assigned Packages Section */}
        {assignedPackages.length > 0 && (
          <SlideIn direction="up" delay={150} duration={400}>
            <Card className="mb-8">
              <CardHeader
                title={`Assigned Packages (${assignedPackages.length})`}
                subtitle="Packages you've accepted and need to deliver"
              />
              <CardBody className="p-0">
                <div className="divide-y divide-surface-100">
                  {assignedPackages.map((pkg, index) => (
                    <div
                      key={pkg.id}
                      className="p-4 hover:bg-surface-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-surface-900">{pkg.description}</h3>
                            <Badge
                              variant={
                                pkg.status === 'matched' ? 'info' :
                                pkg.status === 'picked_up' ? 'warning' :
                                pkg.status === 'in_transit' ? 'primary' :
                                'secondary'
                              }
                              size="sm"
                            >
                              {pkg.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-surface-500">Pickup</p>
                              <p className="text-surface-700">{pkg.pickup_address}</p>
                              {pkg.pickup_contact_name && (
                                <p className="text-surface-500 text-xs">Contact: {pkg.pickup_contact_name}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-surface-500">Dropoff</p>
                              <p className="text-surface-700">{pkg.dropoff_address}</p>
                              {pkg.dropoff_contact_name && (
                                <p className="text-surface-500 text-xs">Contact: {pkg.dropoff_contact_name}</p>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-sm text-surface-600">
                            <span>📦 {pkg.size}</span>
                            <span>⚖️ {pkg.weight_kg} kg</span>
                            {pkg.price && <span className="text-success-600 font-medium">${pkg.price.toFixed(2)}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          <Link href={`/packages/${pkg.id}`}>
                            <Button variant="success" size="sm">
                              View Details
                            </Button>
                          </Link>
                          <Link href={`/messages?package=${pkg.id}`}>
                            <Button variant="primary" size="sm">
                              Message Sender
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </SlideIn>
        )}

        {/* No Active Route Message */}
        {!activeRoute && routes.length > 0 && (
          <Alert variant="warning" className="mb-8">
            <p>
              You don't have an active route. Activate an existing route or create a new one to start finding package matches!
            </p>
          </Alert>
        )}

        {/* First Time User Message */}
        {routes.length === 0 && (
          <FadeIn delay={200} duration={500}>
            <EmptyRoutes
              title="Welcome to Chaski!"
              description="Get started by creating your first route. We'll match you with packages along your way."
              action={
                <Link href="/courier/routes/create">
                  <Button variant="success">Create Your First Route</Button>
                </Link>
              }
            />
          </FadeIn>
        )}

        {/* Route History */}
        {routes.length > 0 && (
          <FadeIn delay={200} duration={500}>
            <Card>
              <CardHeader title="Route History" />
              <CardBody className="p-0">
                <div className="divide-y divide-surface-100">
                  {routes.map((route) => (
                    <div
                      key={route.id}
                      className={`p-4 transition-colors ${
                        route.is_active ? 'bg-success-50' : 'hover:bg-surface-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-surface-900">{route.start_address} → {route.end_address}</p>
                          <div className="mt-1 space-y-0.5">
                            <p className="text-sm text-surface-500">
                              Created: {new Date(route.created_at).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-surface-500">
                              Deviation: {route.max_deviation_km} km
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={route.is_active ? 'success' : 'secondary'}
                                size="sm"
                              >
                                {route.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {route.is_active && (
                            <Link href={`/courier/routes/${route.id}/matches`}>
                              <Button variant="ghost" size="sm">
                                View Matches
                              </Button>
                            </Link>
                          )}
                          {!route.is_active && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => activateRoute(route.id)}
                                className="text-success-600 hover:text-success-700"
                              >
                                Activate
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteRoute(route.id)}
                                className="text-error-600 hover:text-error-700"
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </FadeIn>
        )}
      </div>
    </div>
  )
}
