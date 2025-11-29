'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LiveMap } from './LiveMap'
import { ETACard } from './ETACard'
import { TrackingEvents } from './TrackingEvents'
import { trackingAPI, TrackingSession, LocationUpdate, TrackingEvent } from '@/lib/api'

interface TrackingPanelProps {
  packageId: number
  pickupLat: number
  pickupLng: number
  dropoffLat: number
  dropoffLng: number
  refreshInterval?: number
  showEvents?: boolean
}

export function TrackingPanel({
  packageId,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  refreshInterval = 10000, // 10 seconds
  showEvents = true,
}: TrackingPanelProps) {
  const [session, setSession] = useState<TrackingSession | null>(null)
  const [location, setLocation] = useState<LocationUpdate | null>(null)
  const [events, setEvents] = useState<TrackingEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchTrackingData = useCallback(async () => {
    try {
      // Get active session
      const sessionResponse = await trackingAPI.getActiveSession(packageId)
      setSession(sessionResponse.data)

      // Get current location
      try {
        const locationResponse = await trackingAPI.getCurrentLocation(packageId)
        setLocation(locationResponse.data)
        setLastRefresh(new Date())
      } catch {
        // Location might not be available yet
        setLocation(null)
      }

      // Get events if requested
      if (showEvents && sessionResponse.data) {
        const eventsResponse = await trackingAPI.getTrackingEvents(sessionResponse.data.id)
        setEvents(eventsResponse.data)
      }

      setError(null)
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 404) {
        // No active tracking session
        setSession(null)
        setLocation(null)
        setError(null)
      } else {
        setError('Failed to load tracking data')
      }
    } finally {
      setIsLoading(false)
    }
  }, [packageId, showEvents])

  // Initial fetch
  useEffect(() => {
    fetchTrackingData()
  }, [fetchTrackingData])

  // Auto-refresh when session is active
  useEffect(() => {
    if (!session?.is_active) return

    const interval = setInterval(fetchTrackingData, refreshInterval)
    return () => clearInterval(interval)
  }, [session?.is_active, fetchTrackingData, refreshInterval])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <p className="text-error-500 mb-4">{error}</p>
            <Button variant="outline" onClick={fetchTrackingData}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="p-6">
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
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="font-medium">Tracking Not Available</p>
            <p className="text-sm mt-1">
              Live tracking will be available once the courier starts the delivery
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Map */}
      <LiveMap
        courierLocation={
          location
            ? { latitude: location.latitude, longitude: location.longitude }
            : null
        }
        pickupLocation={{ latitude: pickupLat, longitude: pickupLng }}
        dropoffLocation={{ latitude: dropoffLat, longitude: dropoffLng }}
        heading={location?.heading}
        isLive={session.is_active && session.share_live_location}
      />

      {/* ETA Card */}
      <ETACard
        estimatedArrival={location?.estimated_arrival || session.estimated_arrival}
        distanceMeters={location?.distance_remaining_meters || session.distance_remaining_meters}
        lastUpdated={location?.timestamp || session.last_location_at}
        isLive={session.is_active && session.share_live_location}
      />

      {/* Events Timeline */}
      {showEvents && events.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Delivery Timeline</h3>
          </CardHeader>
          <CardContent>
            <TrackingEvents events={events} />
          </CardContent>
        </Card>
      )}

      {/* Manual Refresh */}
      <div className="flex items-center justify-between text-sm text-surface-500">
        <span>
          {lastRefresh
            ? `Last updated: ${lastRefresh.toLocaleTimeString()}`
            : 'Loading...'}
        </span>
        <Button variant="outline" size="sm" onClick={fetchTrackingData}>
          Refresh
        </Button>
      </div>
    </div>
  )
}
