'use client'

import { BidResponse } from '@/lib/api'
import StarRating from './StarRating'

interface BidCardProps {
  bid: BidResponse
  isSender: boolean
  onSelect?: (bidId: number) => void
  onWithdraw?: (bidId: number) => void
  isSelecting?: boolean
  isWithdrawing?: boolean
}

export default function BidCard({
  bid,
  isSender,
  onSelect,
  onWithdraw,
  isSelecting = false,
  isWithdrawing = false,
}: BidCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  // Normalize status for comparison (backend returns uppercase)
  const status = bid.status?.toLowerCase() || ''

  const getStatusBadge = () => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending
          </span>
        )
      case 'selected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Selected
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Not Selected
          </span>
        )
      case 'withdrawn':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Withdrawn
          </span>
        )
      case 'expired':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            Expired
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div
      className={`bg-white rounded-lg border p-4 ${
        status === 'selected'
          ? 'border-green-500 ring-2 ring-green-200'
          : status === 'pending'
          ? 'border-gray-200 hover:border-gray-300'
          : 'border-gray-200 opacity-75'
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">{bid.courier_name}</h4>
            {getStatusBadge()}
          </div>
          {bid.courier_rating !== null && (
            <div className="flex items-center gap-1 mt-1">
              <StarRating rating={bid.courier_rating} size="sm" />
              <span className="text-sm text-gray-500">
                ({bid.courier_total_ratings} reviews)
              </span>
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">
            ${bid.proposed_price.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        {bid.estimated_delivery_hours && (
          <div>
            <span className="text-gray-500">Delivery estimate:</span>
            <p className="font-medium">
              {bid.estimated_delivery_hours} hour
              {bid.estimated_delivery_hours !== 1 ? 's' : ''}
            </p>
          </div>
        )}
        {bid.estimated_pickup_time && (
          <div>
            <span className="text-gray-500">Pickup time:</span>
            <p className="font-medium">
              {new Date(bid.estimated_pickup_time).toLocaleString([], {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          </div>
        )}
      </div>

      {/* Message */}
      {bid.message && (
        <div className="bg-gray-50 rounded p-3 mb-3">
          <p className="text-sm text-gray-600 italic">&quot;{bid.message}&quot;</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center text-xs text-gray-400 pt-2 border-t">
        <span>Submitted {formatDate(bid.created_at)}</span>
        {bid.selected_at && (
          <span className="text-green-600">
            Selected {formatDate(bid.selected_at)}
          </span>
        )}
      </div>

      {/* Actions */}
      {status === 'pending' && (
        <div className="mt-3 pt-3 border-t flex gap-2">
          {isSender && onSelect && (
            <button
              onClick={() => onSelect(bid.id)}
              disabled={isSelecting}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSelecting ? 'Selecting...' : 'Select This Bid'}
            </button>
          )}
          {!isSender && onWithdraw && (
            <button
              onClick={() => onWithdraw(bid.id)}
              disabled={isWithdrawing}
              className="flex-1 border border-red-300 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isWithdrawing ? 'Withdrawing...' : 'Withdraw Bid'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
