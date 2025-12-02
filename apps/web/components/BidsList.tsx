'use client'

import { useState, useEffect } from 'react'
import { bidsAPI, BidResponse, PackageBidsResponse } from '@/lib/api'
import BidCard from './BidCard'
import CountdownTimer from './CountdownTimer'

interface BidsListProps {
  trackingId: string
  isSender: boolean
  onBidSelected?: () => void
}

export default function BidsList({
  trackingId,
  isSender,
  onBidSelected,
}: BidsListProps) {
  const [bidsData, setBidsData] = useState<PackageBidsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectingBidId, setSelectingBidId] = useState<number | null>(null)
  const [withdrawingBidId, setWithdrawingBidId] = useState<number | null>(null)

  const fetchBids = async () => {
    try {
      const response = await bidsAPI.getPackageBids(trackingId)
      setBidsData(response.data)
      setError('')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to load bids')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBids()
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchBids, 30000)
    return () => clearInterval(interval)
  }, [trackingId])

  const handleSelectBid = async (bidId: number) => {
    if (!confirm('Are you sure you want to select this bid? Other bids will be rejected.')) {
      return
    }

    setSelectingBidId(bidId)
    try {
      await bidsAPI.select(bidId)
      await fetchBids()
      onBidSelected?.()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      alert(error.response?.data?.detail || 'Failed to select bid')
    } finally {
      setSelectingBidId(null)
    }
  }

  const handleWithdrawBid = async (bidId: number) => {
    if (!confirm('Are you sure you want to withdraw your bid?')) {
      return
    }

    setWithdrawingBidId(bidId)
    try {
      await bidsAPI.withdraw(bidId)
      await fetchBids()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      alert(error.response?.data?.detail || 'Failed to withdraw bid')
    } finally {
      setWithdrawingBidId(null)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-200 rounded-lg" />
        <div className="h-32 bg-gray-200 rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        {error}
        <button
          onClick={fetchBids}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!bidsData || bidsData.bids.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-gray-500">No bids yet</p>
        {!isSender && (
          <p className="text-sm text-gray-400 mt-1">
            Be the first to place a bid!
          </p>
        )}
      </div>
    )
  }

  // Helper to normalize status for comparison (backend returns uppercase)
  const getStatus = (bid: BidResponse) => bid.status?.toLowerCase() || ''

  // Sort bids: pending first (by price), then others
  const sortedBids = [...bidsData.bids].sort((a, b) => {
    if (getStatus(a) === 'selected') return -1
    if (getStatus(b) === 'selected') return 1
    if (getStatus(a) === 'pending' && getStatus(b) !== 'pending') return -1
    if (getStatus(b) === 'pending' && getStatus(a) !== 'pending') return 1
    return a.proposed_price - b.proposed_price
  })

  const pendingBids = sortedBids.filter((b) => getStatus(b) === 'pending')
  const selectedBid = sortedBids.find((b) => getStatus(b) === 'selected')

  return (
    <div className="space-y-4">
      {/* Header with deadline */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-gray-900">
            Bids ({bidsData.bids.length})
          </h3>
          {pendingBids.length > 0 && (
            <p className="text-sm text-gray-500">
              {pendingBids.length} pending bid{pendingBids.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {bidsData.bid_deadline && !selectedBid && (
          <CountdownTimer
            deadline={bidsData.bid_deadline}
            onExpire={fetchBids}
          />
        )}
      </div>

      {/* Selected bid highlight */}
      {selectedBid && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-5 h-5 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium text-green-800">
              Courier Selected
            </span>
          </div>
          <BidCard
            bid={selectedBid}
            isSender={isSender}
          />
        </div>
      )}

      {/* Pending bids */}
      {pendingBids.length > 0 && !selectedBid && (
        <div className="space-y-3">
          {pendingBids.map((bid) => (
            <BidCard
              key={bid.id}
              bid={bid}
              isSender={isSender}
              onSelect={isSender ? handleSelectBid : undefined}
              onWithdraw={!isSender ? handleWithdrawBid : undefined}
              isSelecting={selectingBidId === bid.id}
              isWithdrawing={withdrawingBidId === bid.id}
            />
          ))}
        </div>
      )}

      {/* Other bids (rejected, withdrawn, expired) */}
      {sortedBids.filter(
        (b) => !['pending', 'selected'].includes(getStatus(b))
      ).length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
            Show other bids ({sortedBids.filter((b) => !['pending', 'selected'].includes(getStatus(b))).length})
          </summary>
          <div className="mt-3 space-y-3">
            {sortedBids
              .filter((b) => !['pending', 'selected'].includes(getStatus(b)))
              .map((bid) => (
                <BidCard key={bid.id} bid={bid} isSender={isSender} />
              ))}
          </div>
        </details>
      )}
    </div>
  )
}
