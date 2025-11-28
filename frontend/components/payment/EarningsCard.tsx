'use client'

import { EarningsSummary, CourierBalance } from '@/lib/api'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface EarningsCardProps {
  earnings: EarningsSummary
  balance?: CourierBalance
  onRequestPayout?: () => void
  isPayoutLoading?: boolean
}

export function EarningsCard({
  earnings,
  balance,
  onRequestPayout,
  isPayoutLoading = false,
}: EarningsCardProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const pendingAmount = balance?.pending_cents || earnings.pending_payout_cents

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Earnings</h3>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Total Earnings */}
        <div className="text-center py-4 bg-primary-50 rounded-lg">
          <p className="text-sm text-primary-600 font-medium">Total Earnings</p>
          <p className="text-3xl font-bold text-primary-700">
            {formatCurrency(earnings.total_earnings_cents)}
          </p>
          <p className="text-sm text-primary-500 mt-1">
            {earnings.total_deliveries} deliveries
          </p>
        </div>

        {/* Balance Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-50 rounded-lg p-4">
            <p className="text-xs text-surface-500 uppercase tracking-wide">
              Pending
            </p>
            <p className="text-xl font-semibold text-surface-900">
              {formatCurrency(pendingAmount)}
            </p>
            <p className="text-xs text-surface-400 mt-1">
              Ready for payout
            </p>
          </div>

          {balance && (
            <div className="bg-surface-50 rounded-lg p-4">
              <p className="text-xs text-surface-500 uppercase tracking-wide">
                Available
              </p>
              <p className="text-xl font-semibold text-secondary-600">
                {formatCurrency(balance.available_cents)}
              </p>
              <p className="text-xs text-surface-400 mt-1">
                In your account
              </p>
            </div>
          )}
        </div>

        {/* Last Payout */}
        <div className="flex items-center justify-between py-2 border-t border-surface-200">
          <span className="text-sm text-surface-600">Last payout</span>
          <span className="text-sm font-medium">
            {formatDate(earnings.last_payout_at)}
          </span>
        </div>

        {/* Request Payout Button */}
        {onRequestPayout && pendingAmount > 0 && (
          <Button
            variant="primary"
            className="w-full"
            onClick={onRequestPayout}
            disabled={isPayoutLoading || pendingAmount === 0}
            loading={isPayoutLoading}
          >
            {isPayoutLoading
              ? 'Processing...'
              : `Request Payout (${formatCurrency(pendingAmount)})`}
          </Button>
        )}

        {pendingAmount === 0 && (
          <p className="text-center text-sm text-surface-500">
            Complete more deliveries to earn payouts
          </p>
        )}
      </CardContent>
    </Card>
  )
}
