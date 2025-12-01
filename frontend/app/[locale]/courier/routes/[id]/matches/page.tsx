'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { matchingAPI, MatchedPackage, bidsAPI, BidResponse } from '@/lib/api'
import BidOptionsModal from '@/components/BidOptionsModal'
import CourierVerificationGuard from '@/components/CourierVerificationGuard'

function RouteMatchesContent() {
  const params = useParams()
  const routeId = parseInt(params.id as string)

  const [matches, setMatches] = useState<MatchedPackage[]>([])
  const [myBids, setMyBids] = useState<BidResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPackage, setSelectedPackage] = useState<MatchedPackage | null>(null)
  const [showBidModal, setShowBidModal] = useState(false)
  const [withdrawingBidId, setWithdrawingBidId] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [routeId])

  const loadData = async () => {
    try {
      const [matchesRes, bidsRes] = await Promise.all([
        matchingAPI.getPackagesAlongRoute(routeId),
        bidsAPI.getMyBids(),
      ])
      setMatches(matchesRes.data)
      setMyBids(bidsRes.data)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to load matching packages')
    } finally {
      setLoading(false)
    }
  }

  const handlePlaceBid = (pkg: MatchedPackage) => {
    setSelectedPackage(pkg)
    setShowBidModal(true)
  }

  const handleBidPlaced = () => {
    loadData()
  }

  const handleWithdrawBid = async (bidId: number) => {
    if (!confirm('Are you sure you want to withdraw this bid? This action cannot be undone.')) {
      return
    }

    setWithdrawingBidId(bidId)
    try {
      await bidsAPI.withdraw(bidId)
      await loadData()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      alert(error.response?.data?.detail || 'Failed to withdraw bid')
    } finally {
      setWithdrawingBidId(null)
    }
  }

  const getExistingBid = (packageId: number) => {
    return myBids.find((bid) => bid.package_id === packageId)
  }

  // Normalize bid status for comparison (backend returns uppercase)
  const getBidStatus = (bid: BidResponse | undefined) => {
    return bid?.status?.toLowerCase() || ''
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
          <p className="text-gray-600">Place bids on packages along your route</p>
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
              Check back later or try adjusting your route&apos;s maximum deviation.
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
                Found <strong>{matches.length}</strong> package{matches.length !== 1 ? 's' : ''} matching your route.
                Place bids to compete for deliveries!
              </p>
            </div>

            {matches.map((pkg) => {
              const existingBid = getExistingBid(pkg.package_id)

              return (
                <div
                  key={pkg.package_id}
                  className={`bg-white rounded-lg shadow p-6 ${
                    existingBid ? 'border-2 border-blue-300' : ''
                  }`}
                  data-testid="match-card"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold">{pkg.description}</h3>
                        {existingBid && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            getBidStatus(existingBid) === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : getBidStatus(existingBid) === 'selected'
                              ? 'bg-green-100 text-green-800'
                              : getBidStatus(existingBid) === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {getBidStatus(existingBid) === 'pending' && 'Bid Placed'}
                            {getBidStatus(existingBid) === 'selected' && 'Bid Won!'}
                            {getBidStatus(existingBid) === 'rejected' && 'Not Selected'}
                            {getBidStatus(existingBid) === 'withdrawn' && 'Withdrawn'}
                            {getBidStatus(existingBid) === 'expired' && 'Expired'}
                          </span>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-6 mb-4">
                        {/* Package Details */}
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Package Details</h4>
                          <div className="space-y-1 text-sm">
                            <p className="text-gray-600">Size: <span className="font-medium">{pkg.size}</span></p>
                            <p className="text-gray-600">Weight: <span className="font-medium">{pkg.weight_kg} kg</span></p>
                            <p className="text-gray-600">Distance from route: <span className="font-medium">{pkg.distance_from_route_km} km</span></p>
                            <p className="text-gray-600">Estimated detour: <span className="font-medium">{pkg.estimated_detour_km} km</span></p>
                          </div>
                        </div>

                        {/* Pickup & Dropoff */}
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Locations</h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <p className="font-medium text-green-600">Pickup:</p>
                              <p className="text-gray-600">{pkg.pickup_address}</p>
                              {pkg.pickup_contact_name && (
                                <p className="text-gray-500 text-xs">Contact: {pkg.pickup_contact_name}</p>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-blue-600">Dropoff:</p>
                              <p className="text-gray-600">{pkg.dropoff_address}</p>
                              {pkg.dropoff_contact_name && (
                                <p className="text-gray-500 text-xs">Contact: {pkg.dropoff_contact_name}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {pkg.price && (
                          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                            <p className="text-green-800 font-bold">
                              Budget: ${pkg.price.toFixed(2)}
                            </p>
                          </div>
                        )}
                        {existingBid && getBidStatus(existingBid) === 'pending' && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                            <p className="text-blue-800 font-medium">
                              Your bid: ${existingBid.proposed_price.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 flex flex-col gap-2">
                      {!existingBid || getBidStatus(existingBid) === 'rejected' || getBidStatus(existingBid) === 'expired' || getBidStatus(existingBid) === 'withdrawn' ? (
                        <button
                          onClick={() => handlePlaceBid(pkg)}
                          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium whitespace-nowrap"
                        >
                          Place Bid
                        </button>
                      ) : getBidStatus(existingBid) === 'pending' ? (
                        <button
                          onClick={() => handleWithdrawBid(existingBid!.id)}
                          disabled={withdrawingBidId === existingBid!.id}
                          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium whitespace-nowrap disabled:bg-red-400 disabled:cursor-not-allowed"
                        >
                          {withdrawingBidId === existingBid!.id ? 'Withdrawing...' : 'Withdraw Bid'}
                        </button>
                      ) : getBidStatus(existingBid) === 'selected' ? (
                        <Link
                          href={`/packages/${pkg.tracking_id}`}
                          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium whitespace-nowrap text-center"
                        >
                          View Package
                        </Link>
                      ) : null}
                      <Link
                        href={`/messages?package=${pkg.tracking_id}`}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap text-center flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Chat
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bid Options Modal */}
      {selectedPackage && (
        <BidOptionsModal
          isOpen={showBidModal}
          onClose={() => {
            setShowBidModal(false)
            setSelectedPackage(null)
          }}
          trackingId={selectedPackage.tracking_id}
          packageDescription={selectedPackage.description}
          senderPrice={selectedPackage.price}
          routeId={routeId}
          onBidPlaced={handleBidPlaced}
        />
      )}
    </div>
  )
}

export default function RouteMatchesPage() {
  return (
    <CourierVerificationGuard>
      <RouteMatchesContent />
    </CourierVerificationGuard>
  )
}
