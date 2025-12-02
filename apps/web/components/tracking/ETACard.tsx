'use client'

import { Card, CardContent } from '@/components/ui/Card'

interface ETACardProps {
  estimatedArrival: string | null
  distanceMeters: number | null
  lastUpdated: string | null
  isLive?: boolean
}

export function ETACard({
  estimatedArrival,
  distanceMeters,
  lastUpdated,
  isLive = false,
}: ETACardProps) {
  const formatDistance = (meters: number | null) => {
    if (meters === null) return 'Unknown'
    if (meters < 1000) {
      return `${Math.round(meters)} m`
    }
    return `${(meters / 1000).toFixed(1)} km`
  }

  const formatETA = (isoString: string | null) => {
    if (!isoString) return 'Calculating...'
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getTimeRemaining = (isoString: string | null) => {
    if (!isoString) return null
    const arrival = new Date(isoString)
    const now = new Date()
    const diffMs = arrival.getTime() - now.getTime()

    if (diffMs < 0) return 'Arriving now'

    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Less than 1 min'
    if (diffMins < 60) return `${diffMins} min`

    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hours}h ${mins}m`
  }

  const formatLastUpdated = (isoString: string | null) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffSec < 10) return 'Just now'
    if (diffSec < 60) return `${diffSec}s ago`
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    return date.toLocaleTimeString()
  }

  const timeRemaining = getTimeRemaining(estimatedArrival)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-surface-600">
            Delivery Status
          </h3>
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs text-secondary-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary-500"></span>
              </span>
              Live
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* ETA */}
          <div>
            <p className="text-xs text-surface-500 mb-1">Estimated Arrival</p>
            <p className="text-2xl font-bold text-surface-900">
              {formatETA(estimatedArrival)}
            </p>
            {timeRemaining && (
              <p className="text-sm text-primary-600 font-medium mt-1">
                {timeRemaining}
              </p>
            )}
          </div>

          {/* Distance */}
          <div>
            <p className="text-xs text-surface-500 mb-1">Distance Remaining</p>
            <p className="text-2xl font-bold text-surface-900">
              {formatDistance(distanceMeters)}
            </p>
          </div>
        </div>

        {/* Last updated */}
        {lastUpdated && (
          <p className="text-xs text-surface-400 mt-4 text-right">
            Updated {formatLastUpdated(lastUpdated)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
