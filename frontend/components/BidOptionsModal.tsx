'use client'

import { useState } from 'react'
import { bidsAPI, BidCreate } from '@/lib/api'
import BidModal from './BidModal'

interface BidOptionsModalProps {
  isOpen: boolean
  onClose: () => void
  packageId: number
  packageDescription: string
  senderPrice: number | null
  routeId?: number
  onBidPlaced: () => void
}

export default function BidOptionsModal({
  isOpen,
  onClose,
  packageId,
  packageDescription,
  senderPrice,
  routeId,
  onBidPlaced,
}: BidOptionsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showBidModal, setShowBidModal] = useState(false)

  const handleAcceptSenderPrice = async () => {
    if (!senderPrice) {
      // No sender price, redirect to custom bid
      setShowBidModal(true)
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const bidData: BidCreate = {
        package_id: packageId,
        proposed_price: senderPrice,
        route_id: routeId,
      }

      await bidsAPI.create(bidData)
      onBidPlaced()
      handleClose()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to accept package')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCustomBid = () => {
    setShowBidModal(true)
  }

  const handleClose = () => {
    setError('')
    setShowBidModal(false)
    onClose()
  }

  const handleBidModalClose = () => {
    setShowBidModal(false)
  }

  const handleBidPlaced = () => {
    setShowBidModal(false)
    onBidPlaced()
    handleClose()
  }

  if (!isOpen) return null

  // If showing the custom bid modal, render it instead
  if (showBidModal) {
    return (
      <BidModal
        isOpen={true}
        onClose={handleBidModalClose}
        packageId={packageId}
        packageDescription={packageDescription}
        suggestedPrice={senderPrice}
        routeId={routeId}
        onBidPlaced={handleBidPlaced}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Bid on Package
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Package info */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-600">Package:</p>
            <p className="font-medium text-gray-900 truncate">
              {packageDescription}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <p className="text-sm text-gray-600 mb-4">
            Choose how you want to bid on this package:
          </p>

          <div className="space-y-3">
            {/* Option 1: Accept at sender's price */}
            <button
              onClick={handleAcceptSenderPrice}
              disabled={isSubmitting}
              className="w-full p-4 border-2 border-green-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="font-semibold text-gray-900">
                      {senderPrice ? 'Accept at Sender\'s Price' : 'Accept Package'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 ml-7">
                    {senderPrice
                      ? `Quick accept at $${senderPrice.toFixed(2)}`
                      : 'No price set - you\'ll need to place a bid'}
                  </p>
                </div>
                {senderPrice && (
                  <span className="text-lg font-bold text-green-600">
                    ${senderPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </button>

            {/* Option 2: Place custom bid */}
            <button
              onClick={handleCustomBid}
              disabled={isSubmitting}
              className="w-full p-4 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <span className="font-semibold text-gray-900">
                    Place Custom Bid
                  </span>
                  <p className="text-sm text-gray-500 mt-1">
                    Propose your own price and delivery details
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Cancel button */}
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
