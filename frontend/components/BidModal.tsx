'use client'

import { useState } from 'react'
import { bidsAPI, BidCreate } from '@/lib/api'

interface BidModalProps {
  isOpen: boolean
  onClose: () => void
  packageId: number
  packageDescription: string
  suggestedPrice: number | null
  routeId?: number
  onBidPlaced: () => void
}

export default function BidModal({
  isOpen,
  onClose,
  packageId,
  packageDescription,
  suggestedPrice,
  routeId,
  onBidPlaced,
}: BidModalProps) {
  const [proposedPrice, setProposedPrice] = useState(
    suggestedPrice?.toString() || ''
  )
  const [estimatedHours, setEstimatedHours] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!proposedPrice || parseFloat(proposedPrice) <= 0) {
      setError('Please enter a valid price')
      return
    }

    setIsSubmitting(true)

    try {
      const bidData: BidCreate = {
        package_id: packageId,
        proposed_price: parseFloat(proposedPrice),
        route_id: routeId,
      }

      if (estimatedHours) {
        bidData.estimated_delivery_hours = parseInt(estimatedHours)
      }

      if (pickupTime) {
        bidData.estimated_pickup_time = new Date(pickupTime).toISOString()
      }

      if (message.trim()) {
        bidData.message = message.trim()
      }

      await bidsAPI.create(bidData)
      onBidPlaced()
      handleClose()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to place bid')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setProposedPrice(suggestedPrice?.toString() || '')
    setEstimatedHours('')
    setPickupTime('')
    setMessage('')
    setError('')
    onClose()
  }

  if (!isOpen) return null

  // Get minimum datetime (now + 1 hour)
  const minPickupTime = new Date(Date.now() + 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)

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
            <h2 className="text-xl font-semibold text-gray-900">Place a Bid</h2>
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
            <p className="text-sm text-gray-600">Bidding on:</p>
            <p className="font-medium text-gray-900 truncate">
              {packageDescription}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Price */}
            <div>
              <label
                htmlFor="price"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Your Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  id="price"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(e.target.value)}
                  step="0.01"
                  min="0.01"
                  required
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              {suggestedPrice && (
                <p className="mt-1 text-xs text-gray-500">
                  Sender&apos;s budget: ${suggestedPrice.toFixed(2)}
                </p>
              )}
            </div>

            {/* Estimated delivery time */}
            <div>
              <label
                htmlFor="hours"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Estimated Delivery Time (hours)
              </label>
              <input
                type="number"
                id="hours"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 24"
              />
            </div>

            {/* Pickup time */}
            <div>
              <label
                htmlFor="pickup"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Estimated Pickup Time
              </label>
              <input
                type="datetime-local"
                id="pickup"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                min={minPickupTime}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Message to Sender
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Tell the sender why you're the right choice..."
              />
              <p className="mt-1 text-xs text-gray-400 text-right">
                {message.length}/500
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Placing Bid...' : 'Place Bid'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
