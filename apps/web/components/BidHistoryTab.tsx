'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { bidsAPI, BidWithPackageResponse, BidStatus } from '@/lib/api'
import {
  Card,
  CardBody,
  Badge,
  Button,
  Alert,
  FadeIn,
} from '@/components/ui'

const STATUS_OPTIONS: { value: BidStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Bids' },
  { value: 'pending', label: 'Pending' },
  { value: 'selected', label: 'Accepted' },
  { value: 'rejected', label: 'Not Selected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'expired', label: 'Expired' },
]

function BidStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase()

  switch (normalizedStatus) {
    case 'pending':
      return <Badge variant="warning" size="sm">Pending</Badge>
    case 'selected':
      return <Badge variant="success" size="sm">Accepted</Badge>
    case 'rejected':
      return <Badge variant="error" size="sm">Not Selected</Badge>
    case 'withdrawn':
      return <Badge variant="secondary" size="sm">Withdrawn</Badge>
    case 'expired':
      return <Badge variant="secondary" size="sm">Expired</Badge>
    default:
      return <Badge variant="secondary" size="sm">{status}</Badge>
  }
}

function PackageStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase()

  switch (normalizedStatus) {
    case 'delivered':
      return <Badge variant="success" size="sm">Delivered</Badge>
    case 'in_transit':
      return <Badge variant="primary" size="sm">In Transit</Badge>
    case 'bid_selected':
      return <Badge variant="info" size="sm">Bid Selected</Badge>
    case 'open_for_bids':
      return <Badge variant="warning" size="sm">Open for Bids</Badge>
    case 'canceled':
    case 'cancelled':
      return <Badge variant="error" size="sm">Canceled</Badge>
    case 'failed':
      return <Badge variant="error" size="sm">Failed</Badge>
    default:
      return <Badge variant="secondary" size="sm">{status.replace(/_/g, ' ')}</Badge>
  }
}

export default function BidHistoryTab() {
  const [bids, setBids] = useState<BidWithPackageResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<BidStatus | 'all'>('all')
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null)

  useEffect(() => {
    loadBids()
  }, [statusFilter])

  const loadBids = async () => {
    setLoading(true)
    setError('')
    try {
      const status = statusFilter === 'all' ? undefined : statusFilter
      const response = await bidsAPI.getMyBidsHistory(status)
      setBids(response.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load bid history')
    } finally {
      setLoading(false)
    }
  }

  const handleWithdraw = async (bidId: number) => {
    if (!confirm('Are you sure you want to withdraw this bid?')) return

    setWithdrawingId(bidId)
    try {
      await bidsAPI.withdraw(bidId)
      await loadBids()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to withdraw bid')
    } finally {
      setWithdrawingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Calculate summary stats
  const stats = {
    total: bids.length,
    pending: bids.filter(b => b.status.toLowerCase() === 'pending').length,
    accepted: bids.filter(b => b.status.toLowerCase() === 'selected').length,
    rejected: bids.filter(b => b.status.toLowerCase() === 'rejected').length,
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <CardBody className="py-4">
            <p className="text-2xl font-bold text-surface-900">{stats.total}</p>
            <p className="text-sm text-surface-500">Total Bids</p>
          </CardBody>
        </Card>
        <Card className="text-center">
          <CardBody className="py-4">
            <p className="text-2xl font-bold text-warning-600">{stats.pending}</p>
            <p className="text-sm text-surface-500">Pending</p>
          </CardBody>
        </Card>
        <Card className="text-center">
          <CardBody className="py-4">
            <p className="text-2xl font-bold text-success-600">{stats.accepted}</p>
            <p className="text-sm text-surface-500">Accepted</p>
          </CardBody>
        </Card>
        <Card className="text-center">
          <CardBody className="py-4">
            <p className="text-2xl font-bold text-error-600">{stats.rejected}</p>
            <p className="text-sm text-surface-500">Not Selected</p>
          </CardBody>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setStatusFilter(option.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === option.value
                ? 'bg-primary-600 text-white'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="error" dismissible onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && bids.length === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-surface-900 mb-2">No bids found</h3>
            <p className="text-surface-500">
              {statusFilter === 'all'
                ? "You haven't placed any bids yet. Find packages that match your routes and start bidding!"
                : `No ${statusFilter} bids found.`}
            </p>
            {statusFilter === 'all' && (
              <Link href="/courier" className="mt-4 inline-block">
                <Button variant="primary">Find Packages</Button>
              </Link>
            )}
          </CardBody>
        </Card>
      )}

      {/* Bids List */}
      {!loading && bids.length > 0 && (
        <FadeIn duration={300}>
          <Card>
            <CardBody className="p-0">
              <div className="divide-y divide-surface-100">
                {bids.map((bid) => (
                  <div
                    key={bid.id}
                    className={`p-4 hover:bg-surface-50 transition-colors ${
                      bid.status.toLowerCase() === 'selected'
                        ? 'bg-success-50/50'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      {/* Left: Package Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Link
                            href={`/packages/${bid.package_tracking_id}`}
                            className="font-semibold text-surface-900 hover:text-primary-600 truncate"
                          >
                            {bid.package_description}
                          </Link>
                          <BidStatusBadge status={bid.status} />
                          <PackageStatusBadge status={bid.package_status} />
                        </div>

                        <div className="text-sm text-surface-600 space-y-1">
                          <p className="truncate">
                            <span className="text-surface-400">From:</span> {bid.package_pickup_address}
                          </p>
                          <p className="truncate">
                            <span className="text-surface-400">To:</span> {bid.package_dropoff_address}
                          </p>
                          <p>
                            <span className="text-surface-400">Sender:</span> {bid.sender_name}
                          </p>
                        </div>

                        {bid.message && (
                          <p className="mt-2 text-sm text-surface-500 italic bg-surface-50 rounded p-2">
                            &quot;{bid.message}&quot;
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-4 text-xs text-surface-400">
                          <span>Submitted: {formatDate(bid.created_at)}</span>
                          {bid.selected_at && (
                            <span className="text-success-600">
                              Accepted: {formatDate(bid.selected_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Price & Actions */}
                      <div className="flex flex-row md:flex-col items-center md:items-end gap-3">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-surface-900">
                            ${bid.proposed_price.toFixed(2)}
                          </p>
                          {bid.estimated_delivery_hours && (
                            <p className="text-sm text-surface-500">
                              {bid.estimated_delivery_hours}h delivery
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Link href={`/packages/${bid.package_tracking_id}`}>
                            <Button variant="secondary" size="sm">
                              View Package
                            </Button>
                          </Link>

                          {bid.status.toLowerCase() === 'pending' && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleWithdraw(bid.id)}
                              disabled={withdrawingId === bid.id}
                            >
                              {withdrawingId === bid.id ? 'Withdrawing...' : 'Withdraw'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </FadeIn>
      )}
    </div>
  )
}
