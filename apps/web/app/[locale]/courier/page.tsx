'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { couriersAPI, authAPI, ratingsAPI, packagesAPI, bidsAPI, RouteResponse, UserResponse, PendingRating, PackageResponse } from '@/lib/api'
import Navbar from '@/components/Navbar'
import RatingModal from '@/components/RatingModal'
import CourierVerificationGuard from '@/components/CourierVerificationGuard'
import BidHistoryTab from '@/components/BidHistoryTab'
import { kmToMiles } from '@/lib/distance'

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  new: { label: 'New', color: 'text-gray-800', bgColor: 'bg-gray-100', icon: '📝' },
  open_for_bids: { label: 'Open for Bids', color: 'text-yellow-800', bgColor: 'bg-yellow-100', icon: '⏳' },
  bid_selected: { label: 'Bid Selected', color: 'text-blue-800', bgColor: 'bg-blue-100', icon: '🤝' },
  pending_pickup: { label: 'Pending Pickup', color: 'text-purple-800', bgColor: 'bg-purple-100', icon: '📦' },
  in_transit: { label: 'In Transit', color: 'text-indigo-800', bgColor: 'bg-indigo-100', icon: '🚚' },
  delivered: { label: 'Delivered', color: 'text-green-800', bgColor: 'bg-green-100', icon: '✅' },
  canceled: { label: 'Canceled', color: 'text-red-800', bgColor: 'bg-red-100', icon: '❌' },
  failed: { label: 'Failed', color: 'text-orange-800', bgColor: 'bg-orange-100', icon: '⚠️' },
}

const STATUS_ORDER = ['new', 'open_for_bids', 'bid_selected', 'pending_pickup', 'in_transit', 'delivered']

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
  SlideIn,
  Tabs
} from '@/components/ui'

function CourierDashboardContent() {
  const [routes, setRoutes] = useState<RouteResponse[]>([])
  const [activeRoute, setActiveRoute] = useState<RouteResponse | null>(null)
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([])
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [currentRatingIndex, setCurrentRatingIndex] = useState(0)
  const [assignedPackages, setAssignedPackages] = useState<PackageResponse[]>([])
  const [confirmingPickupId, setConfirmingPickupId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bid-history'>('dashboard')
  const router = useRouter()
  const searchParams = useSearchParams()

  // Read tab from URL query parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'history') {
      setActiveTab('bid-history')
    }
  }, [searchParams])

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    try {
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
      const courierPackages = response.data.filter(
        (pkg: PackageResponse) =>
          pkg.courier_id !== null &&
          !['delivered', 'canceled', 'failed'].includes(pkg.status.toLowerCase())
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

  const handleConfirmPickup = async (trackingId: string, bidId: number | null) => {
    if (!bidId) {
      alert('No bid selected for this package')
      return
    }

    setConfirmingPickupId(trackingId)
    try {
      await bidsAPI.confirmPickup(bidId)
      await loadAssignedPackages()
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to confirm pickup'
      alert(errorMessage)
    } finally {
      setConfirmingPickupId(null)
    }
  }


  const deleteRoute = async (routeId: number) => {
    if (!confirm('Are you sure you want to deactivate this route?')) return

    try {
      await couriersAPI.deleteRoute(routeId)
      await loadRoutes()
    } catch (err: any) {
      console.error('Delete route error:', err)
      let errorMessage = 'Failed to deactivate route'

      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.message === 'Network Error') {
        errorMessage = 'Unable to connect to the server. Please check your connection and try again.'
      } else if (err.message) {
        errorMessage = err.message
      }

      setError(errorMessage)
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
      console.error('Activate route error:', err)
      let errorMessage = 'Failed to activate route'

      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail
      } else if (err.message === 'Network Error') {
        errorMessage = 'Unable to connect to the server. Please check your connection and try again.'
      } else if (err.message) {
        errorMessage = err.message
      }

      setError(errorMessage)
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
            <div className="flex gap-3">
              <Link href="/courier/analytics">
                <Button
                  variant="ghost"
                  leftIcon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                >
                  Analytics
                </Button>
              </Link>
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
          </div>
        </FadeIn>

        {error && (
          <Alert variant="error" className="mb-4" dismissible onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'dashboard' | 'bid-history')}>
          <Tabs.List className="mb-6">
            <Tabs.Trigger value="dashboard">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </span>
            </Tabs.Trigger>
            <Tabs.Trigger value="bid-history">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Bid History
              </span>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="bid-history">
            <BidHistoryTab />
          </Tabs.Content>

          <Tabs.Content value="dashboard">
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
                          {activeRoute.trip_date && (
                            <p><strong className="text-surface-900">Trip Date:</strong> {new Date(activeRoute.trip_date).toLocaleDateString()}</p>
                          )}
                          <p><strong className="text-surface-900">Max Deviation:</strong> {kmToMiles(activeRoute.max_deviation_km).toFixed(1)} mi</p>
                          {activeRoute.departure_time && (
                            <p><strong className="text-surface-900">Departure Time:</strong> {activeRoute.departure_time}</p>
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
                      {assignedPackages.map((pkg) => {
                        const normalizedStatus = pkg.status.toLowerCase()
                        const currentStep = STATUS_ORDER.indexOf(normalizedStatus)
                        const isCanceled = normalizedStatus === 'canceled' || normalizedStatus === 'failed'
                        const statusConfig = STATUS_CONFIG[normalizedStatus] || {
                          label: pkg.status,
                          color: 'text-gray-800',
                          bgColor: 'bg-gray-100',
                          icon: '📦',
                        }

                        return (
                          <div
                            key={pkg.id}
                            className="hover:bg-surface-50 transition-colors"
                          >
                            {/* Status Progress Bar */}
                            <div className={`px-4 py-3 ${isCanceled ? 'bg-surface-50' : 'bg-surface-100'}`}>
                              <div className="flex items-center justify-between">
                                {STATUS_ORDER.map((status, index) => {
                                  const isCompleted = index <= currentStep
                                  const isCurrent = index === currentStep
                                  const config = STATUS_CONFIG[status]

                                  return (
                                    <div key={status} className="flex items-center flex-1">
                                      <div className="flex flex-col items-center">
                                        <div
                                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${
                                            isCompleted
                                              ? 'bg-primary-600 text-white'
                                              : 'bg-surface-300 text-surface-500'
                                          } ${isCurrent ? 'ring-2 ring-primary-300 ring-offset-2' : ''}`}
                                        >
                                          {isCompleted ? '✓' : index + 1}
                                        </div>
                                        <span
                                          className={`text-xs mt-1 ${
                                            isCompleted ? 'text-primary-600 font-medium' : 'text-surface-500'
                                          }`}
                                        >
                                          {config.label}
                                        </span>
                                      </div>
                                      {index < STATUS_ORDER.length - 1 && (
                                        <div
                                          className={`flex-1 h-1 mx-2 transition-all duration-300 ${
                                            isCompleted && index < currentStep
                                              ? 'bg-primary-600'
                                              : 'bg-surface-300'
                                          }`}
                                        />
                                      )}
                                    </div>
                                  )
                                })}

                                {/* Canceled/Failed indicator at the end of progress bar */}
                                {isCanceled && (
                                  <>
                                    <div className={`flex-1 h-1 mx-2 ${
                                      normalizedStatus === 'canceled' ? 'bg-red-300' : 'bg-orange-300'
                                    }`} />
                                    <div className="flex flex-col items-center">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                                        normalizedStatus === 'canceled'
                                          ? 'bg-red-500 text-white ring-2 ring-red-300 ring-offset-1'
                                          : 'bg-orange-500 text-white ring-2 ring-orange-300 ring-offset-1'
                                      }`}>
                                        {normalizedStatus === 'canceled' ? '✕' : '!'}
                                      </div>
                                      <span className={`text-xs mt-1 font-medium ${
                                        normalizedStatus === 'canceled' ? 'text-red-600' : 'text-orange-600'
                                      }`}>
                                        {statusConfig.label}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Package Content */}
                            <div className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-semibold text-surface-900">{pkg.description}</h3>
                                    <span
                                      className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                                    >
                                      {statusConfig.icon} {statusConfig.label}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Package {pkg.tracking_id}
                                    </span>
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
                                  {pkg.status.toLowerCase() === 'bid_selected' && pkg.selected_bid_id && (
                                    <Button
                                      variant="success"
                                      size="sm"
                                      onClick={() => handleConfirmPickup(pkg.tracking_id, pkg.selected_bid_id)}
                                      disabled={confirmingPickupId === pkg.tracking_id}
                                    >
                                      {confirmingPickupId === pkg.tracking_id ? 'Confirming...' : 'Confirm Pickup'}
                                    </Button>
                                  )}
                                  {pkg.status.toLowerCase() === 'in_transit' && (
                                    <Link href={`/courier/capture-proof/${pkg.tracking_id}`}>
                                      <Button
                                        variant="success"
                                        size="sm"
                                      >
                                        Complete Delivery
                                      </Button>
                                    </Link>
                                  )}
                                  <Link href={`/packages/${pkg.tracking_id}`}>
                                    <Button variant="secondary" size="sm">
                                      View Details
                                    </Button>
                                  </Link>
                                  <Link href={`/messages?package=${pkg.tracking_id}`}>
                                    <Button variant="primary" size="sm">
                                      Message Sender
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardBody>
                </Card>
              </SlideIn>
            )}

            {/* No Active Route Message */}
            {!activeRoute && routes.length > 0 && (
              <Alert variant="warning" className="mb-8">
                <p>
                  You don&apos;t have an active route. Activate an existing route or create a new one to start finding package matches!
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
                                {route.trip_date && (
                                  <p className="text-sm text-primary-600 font-medium">
                                    Trip Date: {new Date(route.trip_date).toLocaleDateString()}
                                  </p>
                                )}
                                <p className="text-sm text-surface-500">
                                  Created: {new Date(route.created_at).toLocaleDateString()}
                                </p>
                                <p className="text-sm text-surface-500">
                                  Deviation: {kmToMiles(route.max_deviation_km).toFixed(1)} mi
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
          </Tabs.Content>
        </Tabs>
      </div>
    </div>
  )
}

export default function CourierDashboard() {
  return (
    <CourierVerificationGuard>
      <CourierDashboardContent />
    </CourierVerificationGuard>
  )
}
