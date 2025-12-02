'use client'

import { RevenueBreakdown } from '@/lib/api'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'

interface RevenueCardProps {
  revenue: RevenueBreakdown
  period?: string
}

export function RevenueCard({ revenue, period = 'All Time' }: RevenueCardProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  const items = [
    {
      label: 'Total Transactions',
      value: revenue.total_cents,
      color: 'bg-surface-100 text-surface-700',
    },
    {
      label: 'Platform Fees',
      value: revenue.platform_fees_cents,
      color: 'bg-primary-100 text-primary-700',
    },
    {
      label: 'Courier Payouts',
      value: revenue.courier_payouts_cents,
      color: 'bg-secondary-100 text-secondary-700',
    },
    {
      label: 'Refunds',
      value: revenue.refunds_cents,
      color: 'bg-error-100 text-error-700',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Revenue Breakdown</h3>
          <span className="text-sm text-surface-500">{period}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Net Revenue Highlight */}
        <div className="text-center py-6 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg">
          <p className="text-sm text-surface-600 font-medium">Net Revenue</p>
          <p className="text-4xl font-bold text-primary-700">
            {formatCurrency(revenue.net_revenue_cents)}
          </p>
          <p className="text-xs text-surface-500 mt-1">
            Platform fees minus refunds
          </p>
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                <span className="text-sm text-surface-600">{item.label}</span>
              </div>
              <span className="font-medium text-surface-900">
                {formatCurrency(item.value)}
              </span>
            </div>
          ))}
        </div>

        {/* Visual Bar */}
        {revenue.total_cents > 0 && (
          <div className="pt-4 border-t border-surface-200">
            <p className="text-xs text-surface-500 mb-2">Distribution</p>
            <div className="h-4 bg-surface-100 rounded-full overflow-hidden flex">
              <div
                className="bg-primary-500 h-full"
                style={{
                  width: `${(revenue.platform_fees_cents / revenue.total_cents) * 100}%`,
                }}
                title="Platform Fees"
              />
              <div
                className="bg-secondary-500 h-full"
                style={{
                  width: `${(revenue.courier_payouts_cents / revenue.total_cents) * 100}%`,
                }}
                title="Courier Payouts"
              />
              {revenue.refunds_cents > 0 && (
                <div
                  className="bg-error-500 h-full"
                  style={{
                    width: `${(revenue.refunds_cents / revenue.total_cents) * 100}%`,
                  }}
                  title="Refunds"
                />
              )}
            </div>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                Fees
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-secondary-500 rounded-full"></span>
                Payouts
              </span>
              {revenue.refunds_cents > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-error-500 rounded-full"></span>
                  Refunds
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
