'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { packagesAPI, authAPI, ratingsAPI, PackageResponse, UserResponse, PendingRating } from '@/lib/api'
import Navbar from '@/components/Navbar'
import RatingModal from '@/components/RatingModal'
import { SenderDashboardSkeleton } from '@/components/ui'

type StatusFilter = 'all' | 'pending' | 'matched' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-800', bgColor: 'bg-yellow-100', icon: '⏳' },
  matched: { label: 'Matched', color: 'text-blue-800', bgColor: 'bg-blue-100', icon: '🤝' },
  picked_up: { label: 'Picked Up', color: 'text-purple-800', bgColor: 'bg-purple-100', icon: '📦' },
  in_transit: { label: 'In Transit', color: 'text-indigo-800', bgColor: 'bg-indigo-100', icon: '🚚' },
  delivered: { label: 'Delivered', color: 'text-green-800', bgColor: 'bg-green-100', icon: '✅' },
  cancelled: { label: 'Cancelled', color: 'text-red-800', bgColor: 'bg-red-100', icon: '❌' },
}

const STATUS_ORDER = ['pending', 'matched', 'picked_up', 'in_transit', 'delivered']

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
    return packages.filter((pkg) => pkg.status === statusFilter)
  }

  const getStatusCounts = () => {
    const counts: Record<string, number> = { all: packages.length }
    packages.forEach((pkg) => {
      counts[pkg.status] = (counts[pkg.status] || 0) + 1
    })
    return counts
  }

  const canCancel = (status: string) => {
    return status === 'pending' || status === 'matched'
  }

  const getStatusStep = (status: string) => {
    const index = STATUS_ORDER.indexOf(status)
    return index === -1 ? -1 : index
  }

  if (loading) {
    return <SenderDashboardSkeleton />
  }

  const filteredPackages = getFilteredPackages()
  const statusCounts = getStatusCounts()

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

      {/* Page Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Packages</h1>
              <p className="text-gray-600 mt-1">Track and manage your deliveries</p>
            </div>
            <Link
              href="/packages/create"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Package
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
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
                  Rate your experience with couriers who delivered your packages
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

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {['all', 'pending', 'matched', 'in_transit', 'delivered', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as StatusFilter)}
              className={`p-4 rounded-lg border-2 transition-all ${
                statusFilter === status
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-2xl font-bold text-gray-900">
                {statusCounts[status] || 0}
              </div>
              <div className="text-sm text-gray-600 capitalize">
                {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
              </div>
            </button>
          ))}
        </div>

        {/* Package List */}
        {filteredPackages.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {statusFilter === 'all' ? 'No packages yet' : `No ${statusFilter} packages`}
            </h2>
            <p className="text-gray-600 mb-6">
              {statusFilter === 'all'
                ? 'Create your first package to get started with Chaski!'
                : 'Try selecting a different filter to see more packages.'}
            </p>
            {statusFilter === 'all' && (
              <Link
                href="/packages/create"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create Your First Package
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPackages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                onCancel={handleCancelPackage}
                cancelling={cancellingId === pkg.id}
                canCancel={canCancel(pkg.status)}
              />
            ))}
          </div>
        )}
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
  const statusConfig = STATUS_CONFIG[pkg.status] || {
    label: pkg.status,
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
    icon: '📦',
  }

  const currentStep = STATUS_ORDER.indexOf(pkg.status)
  const isCancelled = pkg.status === 'cancelled'

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Status Progress Bar */}
      {!isCancelled && currentStep >= 0 && (
        <div className="bg-gray-100 px-6 py-3">
          <div className="flex items-center justify-between">
            {STATUS_ORDER.map((status, index) => {
              const isCompleted = index <= currentStep
              const isCurrent = index === currentStep
              const config = STATUS_CONFIG[status]

              return (
                <div key={status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        isCompleted
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-300 text-gray-500'
                      } ${isCurrent ? 'ring-2 ring-blue-300 ring-offset-2' : ''}`}
                    >
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <span
                      className={`text-xs mt-1 ${
                        isCompleted ? 'text-blue-600 font-medium' : 'text-gray-500'
                      }`}
                    >
                      {config.label}
                    </span>
                  </div>
                  {index < STATUS_ORDER.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
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

            {/* Courier Info (when matched) */}
            {pkg.courier_id && pkg.status !== 'pending' && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Courier assigned</span> - Your package is being handled by {pkg.courier_name || `courier #${pkg.courier_id}`}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 ml-4">
            <Link
              href={`/packages/${pkg.id}`}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
            >
              View Details
            </Link>
            {canCancel && (
              <button
                onClick={() => onCancel(pkg.id)}
                disabled={cancelling}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
