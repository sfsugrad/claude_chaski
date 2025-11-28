'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { packagesAPI, authAPI, ratingsAPI, PackageResponse, UserResponse, PendingRating } from '@/lib/api'
import Navbar from '@/components/Navbar'
import RatingModal from '@/components/RatingModal'
import {
  SenderDashboardSkeleton,
  Card,
  CardBody,
  Button,
  Badge,
  Alert,
  EmptyPackages,
  FadeIn,
  SlideIn
} from '@/components/ui'

type StatusFilter = 'all' | 'new' | 'open_for_bids' | 'bid_selected' | 'pending_pickup' | 'in_transit' | 'delivered' | 'canceled' | 'failed'

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

export default function SenderDashboard() {
  const [packages, setPackages] = useState<PackageResponse[]>([])
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([])
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [currentRatingIndex, setCurrentRatingIndex] = useState(0)
  const router = useRouter()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    try {
      const userResponse = await authAPI.getCurrentUser()
      const userData = userResponse.data
      setUser(userData)

      if (userData.role !== 'sender' && userData.role !== 'both' && userData.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      await loadPackages()
      await loadPendingRatings()
    } catch (err) {
      setError('Please log in to view your packages.')
      router.push('/login')
    } finally {
      setLoading(false)
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

  const loadPackages = async () => {
    try {
      const response = await packagesAPI.getAll()
      // Filter to only show packages where user is the sender
      const senderPackages = response.data.filter(
        (pkg) => user?.id === pkg.sender_id || user?.role === 'admin'
      )
      setPackages(response.data)
    } catch (err) {
      console.error('Failed to load packages:', err)
      setError('Failed to load packages')
    }
  }

  const handleCancelPackage = async (packageId: number) => {
    if (!confirm('Are you sure you want to cancel this package? This action cannot be undone.')) {
      return
    }

    setCancellingId(packageId)
    try {
      await packagesAPI.cancel(packageId)
      await loadPackages()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel package')
    } finally {
      setCancellingId(null)
    }
  }

  const getFilteredPackages = () => {
    if (statusFilter === 'all') return packages
    // Normalize status to lowercase for comparison (backend returns uppercase)
    return packages.filter((pkg) => pkg.status.toLowerCase() === statusFilter)
  }

  const getStatusCounts = () => {
    const counts: Record<string, number> = { all: packages.length }
    packages.forEach((pkg) => {
      // Normalize status to lowercase for counting
      const normalizedStatus = pkg.status.toLowerCase()
      counts[normalizedStatus] = (counts[normalizedStatus] || 0) + 1
    })
    return counts
  }

  const canCancel = (status: string) => {
    // Normalize status to lowercase
    return ['new', 'open_for_bids', 'bid_selected', 'pending_pickup'].includes(status.toLowerCase())
  }

  const getStatusStep = (status: string) => {
    // Normalize status to lowercase
    const index = STATUS_ORDER.indexOf(status.toLowerCase())
    return index === -1 ? -1 : index
  }

  if (loading) {
    return <SenderDashboardSkeleton />
  }

  const filteredPackages = getFilteredPackages()
  const statusCounts = getStatusCounts()

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

      {/* Page Header */}
      <div className="bg-white shadow-sm border-b border-surface-200">
        <div className="page-container py-6">
          <FadeIn duration={400}>
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-surface-900">My Packages</h1>
                <p className="text-surface-500 mt-1">Track and manage your deliveries</p>
              </div>
              <Link href="/packages/create">
                <Button
                  variant="primary"
                  leftIcon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  }
                >
                  New Package
                </Button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="page-container py-8">
        {error && (
          <Alert variant="error" className="mb-6">
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
                      Rate your experience with couriers who delivered your packages
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

        {/* Status Filter */}
        <SlideIn direction="up" delay={100} duration={400}>
          <Card className="mb-6">
            <CardBody>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {['all', 'open_for_bids', 'bid_selected', 'pending_pickup', 'in_transit', 'delivered', 'canceled', 'failed'].map((status) => {
                    const count = statusCounts[status] || 0
                    const isActive = statusFilter === status
                    const config = STATUS_CONFIG[status]

                    return (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status as StatusFilter)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                          isActive
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                        }`}
                      >
                        {status !== 'all' && config && (
                          <span className={isActive ? '' : ''}>{config.icon}</span>
                        )}
                        <span>{status === 'all' ? 'All' : config?.label || status}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-surface-200 text-surface-600'
                        }`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
              </div>
            </CardBody>
          </Card>
        </SlideIn>

        {/* Package List */}
        <FadeIn delay={200} duration={500}>
          {filteredPackages.length === 0 ? (
            <EmptyPackages
              title={statusFilter === 'all' ? 'No packages yet' : `No ${statusFilter} packages`}
              description={statusFilter === 'all'
                ? 'Create your first package to get started with Chaski!'
                : 'Try selecting a different filter to see more packages.'}
              action={statusFilter === 'all' ? (
                <Link href="/packages/create">
                  <Button variant="primary">
                    Create Your First Package
                  </Button>
                </Link>
              ) : undefined}
            />
          ) : (
            <div className="space-y-4">
              {filteredPackages.map((pkg, index) => (
                <SlideIn key={pkg.id} direction="up" delay={index * 50} duration={300}>
                  <PackageCard
                    pkg={pkg}
                    onCancel={handleCancelPackage}
                    cancelling={cancellingId === pkg.id}
                    canCancel={canCancel(pkg.status)}
                  />
                </SlideIn>
              ))}
            </div>
          )}
        </FadeIn>
      </div>
    </div>
  )
}

interface PackageCardProps {
  pkg: PackageResponse
  onCancel: (id: number) => void
  cancelling: boolean
  canCancel: boolean
}

function PackageCard({ pkg, onCancel, cancelling, canCancel }: PackageCardProps) {
  // Normalize status to lowercase (backend returns uppercase)
  const normalizedStatus = pkg.status.toLowerCase()
  const statusConfig = STATUS_CONFIG[normalizedStatus] || {
    label: pkg.status,
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
    icon: '📦',
  }

  const currentStep = STATUS_ORDER.indexOf(normalizedStatus)
  const isCanceled = normalizedStatus === 'canceled' || normalizedStatus === 'failed'

  return (
    <Card className="overflow-hidden">
      {/* Status Progress Bar */}
      {!isCanceled && currentStep >= 0 && (
        <div className="bg-surface-100 px-6 py-3">
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
                        index < currentStep ? 'bg-primary-600' : 'bg-surface-300'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Package Content */}
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
              >
                {statusConfig.icon} {statusConfig.label}
              </span>
              {/* Bid count indicator for open_for_bids status */}
              {normalizedStatus === 'open_for_bids' && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                  pkg.bid_count > 0
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {pkg.bid_count} {pkg.bid_count === 1 ? 'bid' : 'bids'}
                </span>
              )}
              <span className="text-sm text-gray-500">
                Package #{pkg.id}
              </span>
              {pkg.price && (
                <span className="text-sm font-semibold text-green-600">
                  ${pkg.price.toFixed(2)}
                </span>
              )}
            </div>

            {/* Description */}
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {pkg.description}
            </h3>

            {/* Route Info */}
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs">A</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Pickup</p>
                  <p className="text-sm text-gray-900">{pkg.pickup_address}</p>
                  {pkg.pickup_contact_name && (
                    <p className="text-xs text-gray-500">{pkg.pickup_contact_name}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-600 text-xs">B</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Dropoff</p>
                  <p className="text-sm text-gray-900">{pkg.dropoff_address}</p>
                  {pkg.dropoff_contact_name && (
                    <p className="text-xs text-gray-500">{pkg.dropoff_contact_name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Package Details */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                {pkg.size.replace('_', ' ')}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                {pkg.weight_kg} kg
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(pkg.created_at).toLocaleDateString()}
              </span>
            </div>

            {/* Courier Info (when assigned) */}
            {pkg.courier_id && !['new', 'open_for_bids'].includes(normalizedStatus) && (
              <div className="mt-4 p-3 bg-primary-50 rounded-lg">
                <p className="text-sm text-primary-800">
                  <span className="font-medium">Courier assigned</span> - Your package is being handled by {pkg.courier_name || `courier #${pkg.courier_id}`}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 ml-4">
            <Link href={`/packages/${pkg.id}`}>
              <Button variant="ghost" size="sm">
                View Details
              </Button>
            </Link>
            {canCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCancel(pkg.id)}
                disabled={cancelling}
                className="text-error-600 hover:text-error-700 hover:bg-error-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
