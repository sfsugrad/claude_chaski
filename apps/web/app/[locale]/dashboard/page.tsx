'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI, ratingsAPI, UserResponse, PendingRating } from '@/lib/api'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import RatingModal from '@/components/RatingModal'
import { Card, CardBody, CardHeader, Button, Badge, Alert, DashboardSkeleton, FadeIn, SlideIn } from '@/components/ui'
import { kmToMiles } from '@/lib/distance'

// Icons
const PackageIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)

const SendIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
)

const CarIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
)

const MailIcon = () => (
  <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const UserIcon = () => (
  <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const PhoneIcon = () => (
  <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
)

const MapIcon = () => (
  <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
)

const StarIcon = () => (
  <svg className="w-5 h-5 text-warning-500" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([])
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [currentRatingIndex, setCurrentRatingIndex] = useState(0)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await authAPI.getCurrentUser()
        setUser(response.data)

        // Load pending ratings
        await loadPendingRatings()
      } catch (error) {
        // Not authenticated, redirect to login
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [router])

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

  if (loading) {
    return <DashboardSkeleton />
  }

  if (!user) {
    return null
  }

  const isSender = user.role === 'sender' || user.role === 'both'
  const isCourier = user.role === 'courier' || user.role === 'both'
  const isPureSender = user.role === 'sender'
  const isBothRole = user.role === 'both'
  // Senders need email and phone verified
  const isSenderVerified = user.is_verified && user.phone_verified
  // Couriers need email, phone, AND ID verified
  const isCourierFullyVerified = user.is_verified && user.phone_verified && user.id_verified
  // For 'both' role users, require courier-level verification for ALL features
  // Pure senders only need email + phone
  const canAccessSenderFeatures = (user.role === 'sender' && isSenderVerified) ||
    (user.role === 'both' && isCourierFullyVerified)
  // Courier features require full courier verification (including ID)
  const canAccessCourierFeatures = isCourier && isCourierFullyVerified
  // Show verification banner for unverified users (pure senders or 'both' role)
  const showSenderVerificationBanner = isPureSender && !isSenderVerified
  const showBothRoleVerificationBanner = isBothRole && !isCourierFullyVerified

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
        {/* Sender Verification Banner */}
        {showSenderVerificationBanner && (
          <Alert variant="warning" className="mb-6">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <p className="font-medium">
                    Complete your verification to access all features
                  </p>
                  <p className="text-sm opacity-80">
                    {!user.is_verified && 'Verify your email address. '}
                    {!user.phone_verified && 'Verify your phone number.'}
                  </p>
                </div>
              </div>
              {!user.is_verified && (
                <Link href="/resend-verification">
                  <Button variant="primary" size="sm">
                    Verify Email
                  </Button>
                </Link>
              )}
            </div>
          </Alert>
        )}

        {/* Both Role Verification Banner */}
        {showBothRoleVerificationBanner && (
          <Alert variant="warning" className="mb-6">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <p className="font-medium">
                    Complete your verification to access all features
                  </p>
                  <p className="text-sm opacity-80">
                    {!user.is_verified && 'Verify your email address. '}
                    {!user.phone_verified && 'Verify your phone number. '}
                    {!user.id_verified && 'Verify your ID.'}
                  </p>
                </div>
              </div>
              {!user.is_verified ? (
                <Link href="/resend-verification">
                  <Button variant="primary" size="sm">
                    Verify Email
                  </Button>
                </Link>
              ) : !user.id_verified && user.phone_verified ? (
                <Link href="/id-verification">
                  <Button variant="primary" size="sm">
                    Verify ID
                  </Button>
                </Link>
              ) : null}
            </div>
          </Alert>
        )}

        {/* Pending Ratings Banner */}
        {pendingRatings.length > 0 && !showRatingModal && (
          <Alert variant="warning" className="mb-6">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <StarIcon />
                <div>
                  <p className="font-medium">
                    You have {pendingRatings.length} pending {pendingRatings.length === 1 ? 'review' : 'reviews'}
                  </p>
                  <p className="text-sm opacity-80">
                    Rate your experience with users from your completed deliveries
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
        )}

        {/* Welcome Header */}
        <FadeIn duration={400}>
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-900">
              Welcome back, {user.full_name}!
            </h1>
            <p className="mt-1 text-surface-500">
              Here&apos;s an overview of your account and quick actions
            </p>
          </div>
        </FadeIn>

        {/* User Info Card */}
        <SlideIn direction="up" delay={100} duration={400}>
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-surface-900">Account Details</h2>
                <Badge variant="primary" className="capitalize">{user.role}</Badge>
              </div>
            </CardHeader>
          <CardBody className="p-0">
            <dl className="divide-y divide-surface-100">
              <div className="flex items-center gap-4 px-6 py-4">
                <MailIcon />
                <div className="flex-1">
                  <dt className="text-sm font-medium text-surface-500">Email</dt>
                  <dd className="text-sm text-surface-900">{user.email}</dd>
                </div>
                <Badge variant={user.is_verified ? 'success' : 'warning'} size="sm">
                  {user.is_verified ? 'Verified' : 'Not Verified'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 px-6 py-4">
                <PhoneIcon />
                <div className="flex-1">
                  <dt className="text-sm font-medium text-surface-500">Phone</dt>
                  <dd className="text-sm text-surface-900">
                    {user.phone_number || <span className="text-surface-400">Not provided</span>}
                  </dd>
                </div>
                {user.phone_number && (
                  <Badge variant={user.phone_verified ? 'success' : 'warning'} size="sm">
                    {user.phone_verified ? 'Verified' : 'Not Verified'}
                  </Badge>
                )}
              </div>
              {isCourier && (
                <>
                  <div className="flex items-center gap-4 px-6 py-4">
                    <MapIcon />
                    <div className="flex-1">
                      <dt className="text-sm font-medium text-surface-500">Max Route Deviation</dt>
                      <dd className="text-sm text-surface-900">{kmToMiles(user.max_deviation_km).toFixed(1)} mi</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 px-6 py-4">
                    <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                    <div className="flex-1">
                      <dt className="text-sm font-medium text-surface-500">ID Verification</dt>
                      <dd className="text-sm text-surface-900">
                        {user.id_verified ? 'Identity verified' : 'Required for courier features'}
                      </dd>
                    </div>
                    <Badge variant={user.id_verified ? 'success' : 'warning'} size="sm">
                      {user.id_verified ? 'Verified' : 'Not Verified'}
                    </Badge>
                  </div>
                </>
              )}
              <div className="flex items-center gap-4 px-6 py-4">
                <UserIcon />
                <div className="flex-1">
                  <dt className="text-sm font-medium text-surface-500">Account Status</dt>
                  <dd className="text-sm text-surface-900">
                    <Badge variant={user.is_active ? 'success' : 'error'} size="sm">
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </dd>
                </div>
              </div>
            </dl>
          </CardBody>
          </Card>
        </SlideIn>

        {/* Quick Actions - Show for verified senders or fully verified couriers */}
        {(canAccessSenderFeatures || canAccessCourierFeatures) && (
          <>
            <SlideIn direction="up" delay={200} duration={400}>
              <h2 className="text-lg font-semibold text-surface-900 mb-4">Quick Actions</h2>
            </SlideIn>
            <FadeIn delay={300} duration={500}>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {canAccessSenderFeatures && (
                  <>
                    <Card hoverable className="group">
                    <CardBody>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-14 h-14 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                          <PackageIcon />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-surface-900 mb-1">My Packages</h3>
                          <p className="text-sm text-surface-500 mb-4">
                            Track and manage your deliveries
                          </p>
                          <Link href="/sender">
                            <Button variant="primary" size="sm">
                              View Packages
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <Card hoverable className="group">
                    <CardBody>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-14 h-14 bg-secondary-50 text-secondary-600 rounded-xl flex items-center justify-center group-hover:bg-secondary-100 transition-colors">
                          <SendIcon />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-surface-900 mb-1">Send a Package</h3>
                          <p className="text-sm text-surface-500 mb-4">
                            Create a new delivery request
                          </p>
                          <Link href="/packages/create">
                            <Button variant="secondary" size="sm">
                              Create Package
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </>
              )}

              {canAccessCourierFeatures && (
                <Card hoverable className="group">
                  <CardBody>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-14 h-14 bg-success-50 text-success-600 rounded-xl flex items-center justify-center group-hover:bg-success-100 transition-colors">
                        <CarIcon />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-surface-900 mb-1">Find Packages</h3>
                        <p className="text-sm text-surface-500 mb-4">
                          Browse packages along your route
                        </p>
                        <Link href="/courier">
                          <Button variant="outline" size="sm" className="border-success-600 text-success-600 hover:bg-success-50">
                            Browse Packages
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardBody>
                </Card>
                )}
              </div>
            </FadeIn>
          </>
        )}
      </div>
    </div>
  )
}
