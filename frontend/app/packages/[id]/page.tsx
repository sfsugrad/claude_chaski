'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { authAPI, adminAPI, packagesAPI, ratingsAPI, RatingResponse, messagesAPI, MessageResponse, matchingAPI, bidsAPI } from '@/lib/api'
import StarRating from '@/components/StarRating'
import RatingModal from '@/components/RatingModal'
import ChatWindow from '@/components/ChatWindow'
import BidsList from '@/components/BidsList'
import { useWebSocket } from '@/hooks/useWebSocket'
import { RouteMap } from '@/components/map'
import { Card, Button, Badge, Alert, FadeIn, SlideIn, PackageDetailSkeleton } from '@/components/ui'

interface Package {
  id: number
  sender_id: number
  courier_id: number | null
  sender_name: string | null
  courier_name: string | null
  description: string
  size: string
  weight_kg: number
  status: string
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  pickup_contact_name: string | null
  pickup_contact_phone: string | null
  dropoff_contact_name: string | null
  dropoff_contact_phone: string | null
  price: number | null
  created_at: string
  // Bidding fields
  bid_deadline: string | null
  bid_count: number
  selected_bid_id: number | null
  deadline_extensions: number
}

interface User {
  id: number
  email: string
  full_name: string
  role: string
  average_rating?: number | null
  total_ratings?: number
}

interface PendingRatingInfo {
  package_id: number
  package_description: string
  delivery_time: string | null
  user_to_rate_id: number
  user_to_rate_name: string
  user_to_rate_role: 'sender' | 'courier'
}

export default function PackageDetailPage() {
  const router = useRouter()
  const params = useParams()
  const packageId = params.id as string

  const [pkg, setPkg] = useState<Package | null>(null)
  const [sender, setSender] = useState<User | null>(null)
  const [courier, setCourier] = useState<User | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editedPackage, setEditedPackage] = useState<Partial<Package>>({})
  const [packageRatings, setPackageRatings] = useState<RatingResponse[]>([])
  const [pendingRating, setPendingRating] = useState<PendingRatingInfo | null>(null)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [otherUserName, setOtherUserName] = useState<string>('')
  const [acceptingPackage, setAcceptingPackage] = useState(false)

  // Handle incoming WebSocket messages
  const handleMessageReceived = useCallback((message: MessageResponse) => {
    if (message.package_id === parseInt(packageId)) {
      if (!showChat) {
        setUnreadMessageCount(prev => prev + 1)
      }
    }
  }, [packageId, showChat])

  // Initialize WebSocket
  useWebSocket({
    onMessageReceived: handleMessageReceived,
  })

  useEffect(() => {
    loadPackageData()
  }, [packageId])

  const loadPackageData = async () => {
    try {
      // Get current user
      const userResponse = await authAPI.getCurrentUser()
      setCurrentUser(userResponse.data)

      // Get package details
      const packageResponse = await packagesAPI.getById(parseInt(packageId))
      const packageData = packageResponse.data
      setPkg(packageData)

      // Get sender information
      if (userResponse.data.role === 'admin' || userResponse.data.role === 'ADMIN') {
        try {
          const senderResponse = await adminAPI.getUser(packageData.sender_id)
          setSender(senderResponse.data)
        } catch (err) {
          console.error('Error loading sender:', err)
        }

        // Get courier information if assigned
        if (packageData.courier_id) {
          try {
            const courierResponse = await adminAPI.getUser(packageData.courier_id)
            setCourier(courierResponse.data)
          } catch (err) {
            console.error('Error loading courier:', err)
          }
        }
      }

      // Load unread message count for this package
      try {
        const messagesResponse = await messagesAPI.getPackageMessages(parseInt(packageId), 0, 1)
        // Get unread count from conversations API
        const conversationsResponse = await messagesAPI.getConversations()
        const thisConversation = conversationsResponse.data.conversations.find(
          c => c.package_id === parseInt(packageId)
        )
        if (thisConversation) {
          setUnreadMessageCount(thisConversation.unread_count)
          setOtherUserName(thisConversation.other_user_name)
        }
      } catch (err) {
        // Not critical, messages might not be accessible
        console.error('Error loading messages:', err)
      }

      // Load package ratings if delivered
      if (packageData.status.toLowerCase() === 'delivered') {
        try {
          const ratingsResponse = await ratingsAPI.getPackageRatings(parseInt(packageId))
          setPackageRatings(ratingsResponse.data)

          // Check if current user can rate
          const userHasRated = ratingsResponse.data.some(
            (r: RatingResponse) => r.rater_id === userResponse.data.id
          )

          if (!userHasRated) {
            // Determine who to rate
            const isSender = userResponse.data.id === packageData.sender_id
            const isCourier = userResponse.data.id === packageData.courier_id

            if (isSender && packageData.courier_id) {
              setPendingRating({
                package_id: packageData.id,
                package_description: packageData.description,
                delivery_time: null,
                user_to_rate_id: packageData.courier_id,
                user_to_rate_name: 'the courier',
                user_to_rate_role: 'courier'
              })
            } else if (isCourier) {
              setPendingRating({
                package_id: packageData.id,
                package_description: packageData.description,
                delivery_time: null,
                user_to_rate_id: packageData.sender_id,
                user_to_rate_name: 'the sender',
                user_to_rate_role: 'sender'
              })
            }
          }
        } catch (err) {
          console.error('Error loading ratings:', err)
        }
      }
    } catch (err: any) {
      console.error('Error loading package:', err)
      if (err.response?.status === 404) {
        setError('Package not found')
      } else if (err.response?.status === 403) {
        setError('You do not have access to this package')
      } else {
        setError('Failed to load package details')
      }
    } finally {
      setLoading(false)
    }
  }

  const getStatusVariant = (status: string): 'warning' | 'info' | 'primary' | 'success' | 'error' | 'secondary' => {
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case 'pending':
        return 'warning'
      case 'bidding':
        return 'info'
      case 'bid_selected':
        return 'primary'
      case 'pending_pickup':
        return 'info'
      case 'accepted':
        return 'info'
      case 'picked_up':
        return 'primary'
      case 'in_transit':
        return 'info'
      case 'delivered':
        return 'success'
      case 'cancelled':
        return 'error'
      default:
        return 'secondary'
    }
  }

  const getSizeLabel = (size: string) => {
    const sizeMap: { [key: string]: string } = {
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      extra_large: 'Extra Large'
    }
    return sizeMap[size] || size
  }

  const canEdit = () => {
    if (!currentUser || !pkg) return false
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'ADMIN'
    const isSender = pkg.sender_id === currentUser.id
    const isPending = pkg.status.toLowerCase() === 'pending'
    return (isAdmin || isSender) && isPending
  }

  const canAcceptPackage = () => {
    if (!currentUser || !pkg) return false
    const isCourier = currentUser.role === 'courier' || currentUser.role === 'COURIER' ||
                      currentUser.role === 'both' || currentUser.role === 'BOTH'
    const isPending = pkg.status.toLowerCase() === 'pending'
    const isNotSender = pkg.sender_id !== currentUser.id
    return isCourier && isPending && isNotSender
  }

  const handleAcceptPackage = async () => {
    if (!pkg) return
    setAcceptingPackage(true)
    try {
      await matchingAPI.acceptPackage(pkg.id)
      alert('Package accepted successfully!')
      await loadPackageData()
    } catch (err: any) {
      console.error('Error accepting package:', err)
      const errorMessage = err.response?.data?.detail || 'Failed to accept package'
      alert(errorMessage)
    } finally {
      setAcceptingPackage(false)
    }
  }

  const handleEdit = () => {
    if (pkg) {
      setEditedPackage({
        description: pkg.description,
        size: pkg.size,
        weight_kg: pkg.weight_kg,
        price: pkg.price,
        pickup_contact_name: pkg.pickup_contact_name,
        pickup_contact_phone: pkg.pickup_contact_phone,
        dropoff_contact_name: pkg.dropoff_contact_name,
        dropoff_contact_phone: pkg.dropoff_contact_phone
      })
      setIsEditing(true)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedPackage({})
  }

  const handleSave = async () => {
    try {
      await packagesAPI.update(parseInt(packageId), editedPackage)
      alert('Package updated successfully')
      setIsEditing(false)
      await loadPackageData()
    } catch (err: any) {
      console.error('Error updating package:', err)
      const errorMessage = err.response?.data?.detail || 'Failed to update package'
      alert(errorMessage)
    }
  }

  const handleRatingSubmitted = async () => {
    setShowRatingModal(false)
    setPendingRating(null)
    // Reload ratings
    try {
      const ratingsResponse = await ratingsAPI.getPackageRatings(parseInt(packageId))
      setPackageRatings(ratingsResponse.data)
    } catch (err) {
      console.error('Error reloading ratings:', err)
    }
  }

  if (loading) {
    return <PackageDetailSkeleton />
  }

  if (error || !pkg) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <Card className="text-center p-8 max-w-md">
          <Alert variant="error" className="mb-4">{error || 'Package not found'}</Alert>
          <Link
            href="/dashboard"
            className="text-primary-600 hover:text-primary-700 underline"
          >
            Return to Dashboard
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <FadeIn duration={300}>
        <div className="bg-white shadow">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href={currentUser?.role === 'admin' || currentUser?.role === 'ADMIN' ? '/admin' : '/dashboard'}
                  className="text-primary-600 hover:text-primary-700"
                >
                  ← Back
                </Link>
                <h1 className="text-2xl font-bold text-surface-900">
                  Package #{pkg.id}
                </h1>
                <Badge variant={getStatusVariant(pkg.status)}>
                  {pkg.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <div className="flex gap-2">
                {canAcceptPackage() && (
                  <Button
                    variant="success"
                    onClick={handleAcceptPackage}
                    disabled={acceptingPackage}
                    loading={acceptingPackage}
                  >
                    {acceptingPackage ? 'Accepting...' : 'Accept Package'}
                  </Button>
                )}
                {canEdit() && !isEditing && (
                  <Button variant="primary" onClick={handleEdit}>
                    Edit Package
                  </Button>
                )}
                {isEditing && (
                  <>
                    <Button variant="secondary" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button variant="success" onClick={handleSave}>
                      Save Changes
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Package Details */}
          <SlideIn direction="up" delay={100}>
            <Card className="p-6">
              <h2 className="text-xl font-bold text-surface-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Package Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-surface-500">Description</label>
                  {isEditing ? (
                    <textarea
                      value={editedPackage.description || ''}
                      onChange={(e) => setEditedPackage({ ...editedPackage, description: e.target.value })}
                      className="mt-1 w-full border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                    />
                  ) : (
                    <p className="text-surface-900 mt-1">{pkg.description}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-surface-500">Size</label>
                    {isEditing ? (
                      <select
                        value={editedPackage.size || pkg.size}
                        onChange={(e) => setEditedPackage({ ...editedPackage, size: e.target.value })}
                        className="mt-1 w-full border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                        <option value="extra_large">Extra Large</option>
                      </select>
                    ) : (
                      <p className="text-surface-900 mt-1">{getSizeLabel(pkg.size)}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-surface-500">Weight (kg)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={editedPackage.weight_kg || ''}
                        onChange={(e) => setEditedPackage({ ...editedPackage, weight_kg: parseFloat(e.target.value) })}
                        className="mt-1 w-full border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <p className="text-surface-900 mt-1">{pkg.weight_kg} kg</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-surface-500">Price ($)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editedPackage.price ?? ''}
                        onChange={(e) => setEditedPackage({ ...editedPackage, price: e.target.value ? parseFloat(e.target.value) : null })}
                        className="mt-1 w-full border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <p className="text-surface-900 mt-1 text-lg font-semibold">
                        ${pkg.price?.toFixed(2) || 'N/A'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-surface-500">Created</label>
                    <p className="text-surface-900 mt-1">
                      {new Date(pkg.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </SlideIn>

          {/* User Information */}
          <SlideIn direction="up" delay={150}>
            <Card className="p-6">
              <h2 className="text-xl font-bold text-surface-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                People Involved
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-surface-500">Sender</label>
                  {sender ? (
                    <div className="mt-1">
                      {currentUser?.role === 'admin' || currentUser?.role === 'ADMIN' ? (
                        <Link
                          href={`/users/${sender.id}`}
                          className="text-primary-600 hover:text-primary-800 font-medium underline"
                        >
                          {sender.full_name}
                        </Link>
                      ) : (
                        <p className="text-surface-900 font-medium">{sender.full_name}</p>
                      )}
                      <p className="text-surface-600 text-sm">{sender.email}</p>
                    </div>
                  ) : pkg.sender_name ? (
                    <p className="text-surface-900 mt-1 font-medium">{pkg.sender_name}</p>
                  ) : (
                    <p className="text-surface-900 mt-1">User ID: {pkg.sender_id}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-500">Courier</label>
                  {courier ? (
                    <div className="mt-1">
                      {currentUser?.role === 'admin' || currentUser?.role === 'ADMIN' ? (
                        <Link
                          href={`/users/${courier.id}`}
                          className="text-primary-600 hover:text-primary-800 font-medium underline"
                        >
                          {courier.full_name}
                        </Link>
                      ) : (
                        <p className="text-surface-900 font-medium">{courier.full_name}</p>
                      )}
                      <p className="text-surface-600 text-sm">{courier.email}</p>
                    </div>
                  ) : pkg.courier_id ? (
                    <p className="text-surface-900 mt-1 font-medium">{pkg.courier_name || `User ID: ${pkg.courier_id}`}</p>
                  ) : (
                    <p className="text-surface-500 italic mt-1">Not assigned yet</p>
                  )}
                </div>
              </div>
            </Card>
          </SlideIn>

          {/* Pickup Information */}
          <SlideIn direction="up" delay={200}>
            <Card className="p-6">
              <h2 className="text-xl font-bold text-surface-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Pickup Location
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-surface-500">Address</label>
                  <p className="text-surface-900 mt-1">{pkg.pickup_address}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-surface-500">Latitude</label>
                    <p className="text-surface-900 mt-1 font-mono text-sm">{pkg.pickup_lat}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-surface-500">Longitude</label>
                    <p className="text-surface-900 mt-1 font-mono text-sm">{pkg.pickup_lng}</p>
                  </div>
                </div>
                {(pkg.pickup_contact_name || pkg.pickup_contact_phone || isEditing) && (
                  <div className="border-t border-surface-200 pt-4">
                    <label className="text-sm font-medium text-surface-500">Contact Information</label>
                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          placeholder="Contact Name"
                          value={editedPackage.pickup_contact_name || ''}
                          onChange={(e) => setEditedPackage({ ...editedPackage, pickup_contact_name: e.target.value })}
                          className="w-full border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <input
                          type="tel"
                          placeholder="Contact Phone"
                          value={editedPackage.pickup_contact_phone || ''}
                          onChange={(e) => setEditedPackage({ ...editedPackage, pickup_contact_phone: e.target.value })}
                          className="w-full border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {pkg.pickup_contact_name && (
                          <p className="text-surface-900">{pkg.pickup_contact_name}</p>
                        )}
                        {pkg.pickup_contact_phone && (
                          <p className="text-surface-600">{pkg.pickup_contact_phone}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </SlideIn>

          {/* Dropoff Information */}
          <SlideIn direction="up" delay={250}>
            <Card className="p-6">
              <h2 className="text-xl font-bold text-surface-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Dropoff Location
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-surface-500">Address</label>
                  <p className="text-surface-900 mt-1">{pkg.dropoff_address}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-surface-500">Latitude</label>
                    <p className="text-surface-900 mt-1 font-mono text-sm">{pkg.dropoff_lat}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-surface-500">Longitude</label>
                    <p className="text-surface-900 mt-1 font-mono text-sm">{pkg.dropoff_lng}</p>
                  </div>
                </div>
                {(pkg.dropoff_contact_name || pkg.dropoff_contact_phone || isEditing) && (
                  <div className="border-t border-surface-200 pt-4">
                    <label className="text-sm font-medium text-surface-500">Contact Information</label>
                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          placeholder="Contact Name"
                          value={editedPackage.dropoff_contact_name || ''}
                          onChange={(e) => setEditedPackage({ ...editedPackage, dropoff_contact_name: e.target.value })}
                          className="w-full border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <input
                          type="tel"
                          placeholder="Contact Phone"
                          value={editedPackage.dropoff_contact_phone || ''}
                          onChange={(e) => setEditedPackage({ ...editedPackage, dropoff_contact_phone: e.target.value })}
                          className="w-full border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {pkg.dropoff_contact_name && (
                          <p className="text-surface-900">{pkg.dropoff_contact_name}</p>
                        )}
                        {pkg.dropoff_contact_phone && (
                          <p className="text-surface-600">{pkg.dropoff_contact_phone}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </SlideIn>
        </div>

        {/* Bids Section - Show for packages in bidding phase */}
        {currentUser && pkg && ['bidding', 'bid_selected'].includes(pkg.status.toLowerCase()) && (
          <SlideIn direction="up" delay={275}>
            <Card className="mt-6 p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h2 className="text-xl font-bold text-surface-900">
                  Courier Bids
                </h2>
                {pkg.bid_count > 0 && (
                  <Badge variant="info" size="sm">{pkg.bid_count}</Badge>
                )}
              </div>

              {pkg.status.toLowerCase() === 'bidding' && currentUser.id === pkg.sender_id ? (
                <>
                  <p className="text-surface-600 mb-4">
                    Review bids from couriers and select your preferred one.
                  </p>
                  <BidsList
                    packageId={pkg.id}
                    isSender={true}
                    onBidSelected={loadPackageData}
                  />
                </>
              ) : pkg.status.toLowerCase() === 'bid_selected' ? (
                <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium text-success-800">
                      Courier Selected
                    </span>
                  </div>
                  <p className="text-success-700">
                    A courier has been selected for this package. Waiting for pickup confirmation.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-surface-500">
                    Bids are being collected for this package.
                  </p>
                </div>
              )}
            </Card>
          </SlideIn>
        )}

        {/* Map View */}
        <SlideIn direction="up" delay={300}>
          <Card className="mt-6 p-6">
            <h2 className="text-xl font-bold text-surface-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Route
            </h2>
            <RouteMap
              pickup={{
                address: pkg.pickup_address,
                lat: pkg.pickup_lat,
                lng: pkg.pickup_lng,
                label: 'Pickup',
              }}
              dropoff={{
                address: pkg.dropoff_address,
                lat: pkg.dropoff_lat,
                lng: pkg.dropoff_lng,
                label: 'Dropoff',
              }}
              height={350}
              showRoute={true}
            />
            <div className="mt-3 flex items-center justify-between text-sm text-surface-600">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-success-500"></span>
                <span>{pkg.pickup_address}</span>
              </div>
              <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary-500"></span>
                <span>{pkg.dropoff_address}</span>
              </div>
            </div>
          </Card>
        </SlideIn>

        {/* Chat Section - Show for sender/courier (not admin) */}
        {currentUser && pkg && (currentUser.id === pkg.sender_id || currentUser.id === pkg.courier_id) && (
          <SlideIn direction="up" delay={350}>
            <Card className="mt-6 overflow-hidden">
              <button
                onClick={() => {
                  setShowChat(!showChat)
                  if (!showChat) {
                    setUnreadMessageCount(0)
                  }
                }}
                className="w-full p-4 flex items-center justify-between hover:bg-surface-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-info-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-lg font-bold text-surface-900">
                    Messages {otherUserName && `with ${otherUserName}`}
                  </span>
                  {unreadMessageCount > 0 && (
                    <Badge variant="primary" size="sm">
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </Badge>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-surface-400 transition-transform ${showChat ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showChat && (
                <div className="border-t border-surface-200">
                  <ChatWindow
                    packageId={pkg.id}
                    currentUserId={currentUser.id}
                    otherUserName={otherUserName || (currentUser.id === pkg.sender_id ? 'Courier' : 'Sender')}
                    className="rounded-none border-0"
                  />
                </div>
              )}
            </Card>
          </SlideIn>
        )}

        {/* Ratings Section - Only show for delivered packages */}
        {pkg.status.toLowerCase() === 'delivered' && (
          <SlideIn direction="up" delay={400}>
            <Card className="mt-6 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-surface-900 flex items-center gap-2">
                  <svg className="w-6 h-6 text-warning-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  Ratings & Reviews
                </h2>
                {pendingRating && (
                  <Button
                    variant="warning"
                    onClick={() => setShowRatingModal(true)}
                  >
                    Rate {pendingRating.user_to_rate_role === 'courier' ? 'Courier' : 'Sender'}
                  </Button>
                )}
              </div>

              {packageRatings.length === 0 ? (
                <p className="text-surface-500">No ratings yet for this delivery.</p>
              ) : (
                <div className="space-y-4">
                  {packageRatings.map((rating) => (
                    <div key={rating.id} className="border-b border-surface-200 pb-4 last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-surface-900">
                            {rating.rater_name || `User #${rating.rater_id}`}
                          </span>
                          <span className="text-surface-400">→</span>
                          <span className="text-surface-600">
                            {rating.rated_user_id === pkg.sender_id ? 'Sender' : 'Courier'}
                          </span>
                        </div>
                        <span className="text-sm text-surface-400">
                          {new Date(rating.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <StarRating rating={rating.score} size="sm" />
                      {rating.comment && (
                        <p className="mt-2 text-surface-600">{rating.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </SlideIn>
        )}
      </div>

      {/* Rating Modal */}
      {pendingRating && (
        <RatingModal
          isOpen={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          pendingRating={pendingRating}
          onRatingSubmitted={handleRatingSubmitted}
        />
      )}
    </div>
  )
}
