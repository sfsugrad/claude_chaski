'use client'

import { CourierPerformance } from '@/lib/api'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'

interface CourierPerformanceCardProps {
  performance: CourierPerformance
  showEarnings?: boolean
}

export function CourierPerformanceCard({
  performance,
  showEarnings = true,
}: CourierPerformanceCardProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  const formatTime = (minutes: number | null) => {
    if (!minutes) return 'N/A'
    if (minutes < 60) return `${Math.round(minutes)} min`
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}h ${mins}m`
  }

  const successRate =
    performance.total_deliveries > 0
      ? (performance.successful_deliveries / performance.total_deliveries) * 100
      : 0

  const onTimeRate =
    performance.successful_deliveries > 0
      ? (performance.on_time_deliveries / performance.successful_deliveries) * 100
      : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Your Performance</h3>
          {performance.current_streak > 0 && (
            <div className="flex items-center gap-1 text-sm bg-secondary-50 text-secondary-700 px-2 py-1 rounded-full">
              <span className="text-lg">🔥</span>
              <span>{performance.current_streak} streak</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Rating */}
        <div className="text-center py-4 bg-primary-50 rounded-lg">
          <div className="flex items-center justify-center gap-2">
            <svg
              className="w-8 h-8 text-yellow-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-3xl font-bold text-primary-700">
              {performance.average_rating?.toFixed(1) || 'N/A'}
            </span>
          </div>
          <p className="text-sm text-primary-600 mt-1">Average Rating</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-50 rounded-lg p-4">
            <p className="text-xs text-surface-500 uppercase tracking-wide">
              Total Deliveries
            </p>
            <p className="text-2xl font-bold text-surface-900">
              {performance.total_deliveries}
            </p>
          </div>

          <div className="bg-surface-50 rounded-lg p-4">
            <p className="text-xs text-surface-500 uppercase tracking-wide">
              Success Rate
            </p>
            <p className="text-2xl font-bold text-secondary-600">
              {successRate.toFixed(0)}%
            </p>
          </div>

          <div className="bg-surface-50 rounded-lg p-4">
            <p className="text-xs text-surface-500 uppercase tracking-wide">
              On-Time Rate
            </p>
            <p className="text-2xl font-bold text-primary-600">
              {onTimeRate.toFixed(0)}%
            </p>
          </div>

          <div className="bg-surface-50 rounded-lg p-4">
            <p className="text-xs text-surface-500 uppercase tracking-wide">
              Avg. Delivery Time
            </p>
            <p className="text-2xl font-bold text-surface-900">
              {formatTime(performance.average_delivery_time)}
            </p>
          </div>
        </div>

        {/* Earnings */}
        {showEarnings && (
          <div className="border-t border-surface-200 pt-4">
            <h4 className="text-sm font-medium text-surface-600 mb-3">
              Earnings
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-surface-500">This Month</p>
                <p className="text-xl font-bold text-secondary-600">
                  {formatCurrency(performance.earnings_this_month)}
                </p>
              </div>
              <div>
                <p className="text-xs text-surface-500">All Time</p>
                <p className="text-xl font-bold text-surface-900">
                  {formatCurrency(performance.total_earnings)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Last Activity */}
        {performance.last_delivery_at && (
          <p className="text-xs text-surface-400 text-center">
            Last delivery:{' '}
            {new Date(performance.last_delivery_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
