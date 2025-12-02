'use client'

import { TopCourier } from '@/lib/api'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'

interface TopCouriersTableProps {
  couriers: TopCourier[]
  isLoading?: boolean
}

export function TopCouriersTable({ couriers, isLoading = false }: TopCouriersTableProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Top Couriers</h3>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 bg-surface-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface-200 rounded w-24"></div>
                  <div className="h-3 bg-surface-100 rounded w-16"></div>
                </div>
                <div className="h-4 bg-surface-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (couriers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Top Couriers</h3>
        </CardHeader>
        <CardContent>
          <p className="text-center text-surface-500 py-4">
            No courier data available
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Top Couriers</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {couriers.map((courier, index) => (
            <div
              key={courier.courier_id}
              className="flex items-center gap-4 p-2 rounded-lg hover:bg-surface-50"
            >
              {/* Rank */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0
                    ? 'bg-yellow-100 text-yellow-700'
                    : index === 1
                    ? 'bg-gray-100 text-gray-700'
                    : index === 2
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-surface-100 text-surface-600'
                }`}
              >
                {index + 1}
              </div>

              {/* Avatar */}
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-medium">
                  {courier.name.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-surface-900 truncate">
                  {courier.name}
                </p>
                <div className="flex items-center gap-3 text-sm text-surface-500">
                  <span>{courier.deliveries} deliveries</span>
                  {courier.rating && (
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-4 h-4 text-yellow-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {courier.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>

              {/* Earnings */}
              <div className="text-right">
                <p className="font-semibold text-secondary-600">
                  {formatCurrency(courier.earnings_cents)}
                </p>
                <p className="text-xs text-surface-400">earned</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
