'use client'

import { Transaction } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'

interface TransactionListProps {
  transactions: Transaction[]
  currentUserId: number
  onViewDetails?: (transactionId: number) => void
}

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'error' | 'secondary'> = {
  succeeded: 'success',
  processing: 'warning',
  pending: 'secondary',
  requires_payment: 'warning',
  failed: 'error',
  refunded: 'secondary',
}

const STATUS_LABELS: Record<string, string> = {
  succeeded: 'Completed',
  processing: 'Processing',
  pending: 'Pending',
  requires_payment: 'Awaiting Payment',
  failed: 'Failed',
  refunded: 'Refunded',
}

export function TransactionList({
  transactions,
  currentUserId,
  onViewDetails,
}: TransactionListProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-surface-500">
        <svg
          className="w-12 h-12 mx-auto text-surface-300 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p>No transactions yet</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-surface-200">
      {transactions.map((tx) => {
        const isSender = tx.sender_id === currentUserId
        const isCourier = tx.courier_id === currentUserId
        const displayAmount = isCourier ? tx.courier_payout_cents : tx.amount_cents

        return (
          <div
            key={tx.id}
            className={`py-4 ${onViewDetails ? 'cursor-pointer hover:bg-surface-50' : ''}`}
            onClick={() => onViewDetails?.(tx.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-surface-900">
                    Package #{tx.package_id}
                  </span>
                  <Badge
                    variant={STATUS_VARIANTS[tx.status] || 'secondary'}
                    size="sm"
                  >
                    {STATUS_LABELS[tx.status] || tx.status}
                  </Badge>
                </div>
                <p className="text-sm text-surface-500 mt-1">
                  {formatDate(tx.created_at)}
                </p>
              </div>

              <div className="text-right">
                <p
                  className={`font-semibold ${
                    isCourier ? 'text-secondary-600' : 'text-surface-900'
                  }`}
                >
                  {isCourier ? '+' : '-'}{formatCurrency(displayAmount)}
                </p>
                {isSender && tx.platform_fee_cents > 0 && (
                  <p className="text-xs text-surface-400">
                    Fee: {formatCurrency(tx.platform_fee_cents)}
                  </p>
                )}
                {tx.refund_amount_cents > 0 && (
                  <p className="text-xs text-error-500">
                    Refunded: {formatCurrency(tx.refund_amount_cents)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
