'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { trackingAPI, TrackingSession } from '@/lib/api'

interface CourierLocationSharingProps {
  packageId: number
  onSessionChange?: (session: TrackingSession | null) => void
  updateIntervalMs?: number
}

export function CourierLocationSharing({
  packageId,
  onSessionChange,
  updateIntervalMs = 15000, // 15 seconds default
}: CourierLocationSharingProps) {
  const [session, setSession] = useState<TrackingSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check for existing session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await trackingAPI.getActiveSession(packageId)
        setSession(response.data)
        onSessionChange?.(response.data)
      } catch (err: unknown) {
        if ((err as { response?: { status?: number } }).response?.status !== 404) {
          setError('Failed to check tracking status')
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [packageId, onSessionChange])

  // Get current position
  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      })
    })
  }, [])

  // Send location update
  const sendLocationUpdate = useCallback(async (position: GeolocationPosition) => {
    if (!session?.id || !session.is_active) return

    try {
      await trackingAPI.updateLocation(session.id, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: position.coords.accuracy,
        altitude_meters: position.coords.altitude || undefined,
        heading: position.coords.heading || undefined,
        speed_mps: position.coords.speed || undefined,
      })
      setLastUpdate(new Date())
      setLocationError(null)
    } catch (err) {
      console.error('Failed to send location update:', err)
      setLocationError('Failed to update location')
    }
  }, [session?.id, session?.is_active])

  // Start tracking
  const startTracking = async () => {
    setIsUpdating(true)
    setError(null)
    setLocationError(null)

    try {
      // Get initial position
      const position = await getCurrentPosition()

      // Start tracking session
      const response = await trackingAPI.startTracking(packageId, {
        initial_latitude: position.coords.latitude,
        initial_longitude: position.coords.longitude,
        share_live_location: true,
      })

      setSession(response.data)
      onSessionChange?.(response.data)
      setLastUpdate(new Date())

      // Start periodic updates
      updateIntervalRef.current = setInterval(async () => {
        try {
          const pos = await getCurrentPosition()
          await sendLocationUpdate(pos)
        } catch (err) {
          console.error('Location update failed:', err)
        }
      }, updateIntervalMs)
    } catch (err: unknown) {
      const geoErr = err as GeolocationPositionError
      if (geoErr.code === 1) {
        setError('Location permission denied. Please enable location access.')
      } else if (geoErr.code === 2) {
        setError('Unable to determine location. Please try again.')
      } else {
        setError('Failed to start tracking')
      }
    } finally {
      setIsUpdating(false)
    }
  }

  // Stop tracking
  const stopTracking = async () => {
    if (!session?.id) return

    setIsUpdating(true)

    try {
      // Stop periodic updates
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }

      // Stop watching position
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }

      // End session
      const response = await trackingAPI.endTracking(session.id)
      setSession(response.data)
      onSessionChange?.(response.data)
    } catch (err) {
      setError('Failed to stop tracking')
    } finally {
      setIsUpdating(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // Resume updates if session is active
  useEffect(() => {
    if (session?.is_active && !updateIntervalRef.current) {
      updateIntervalRef.current = setInterval(async () => {
        try {
          const pos = await getCurrentPosition()
          await sendLocationUpdate(pos)
        } catch (err) {
          console.error('Location update failed:', err)
        }
      }, updateIntervalMs)
    }

    return () => {
      if (updateIntervalRef.current && !session?.is_active) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }
    }
  }, [session?.is_active, getCurrentPosition, sendLocationUpdate, updateIntervalMs])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Live Location Sharing</h3>
          {session?.is_active && (
            <Badge variant="success" size="sm">
              <span className="relative flex h-2 w-2 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
              </span>
              Sharing
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-error-50 text-error-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {locationError && (
          <div className="p-3 bg-warning-50 text-warning-600 rounded-lg text-sm">
            {locationError}
          </div>
        )}

        {!session?.is_active ? (
          <>
            <p className="text-sm text-surface-600">
              Share your real-time location with the sender so they can track the delivery.
            </p>
            <Button
              variant="primary"
              className="w-full"
              onClick={startTracking}
              disabled={isUpdating}
              loading={isUpdating}
            >
              {isUpdating ? 'Starting...' : 'Start Sharing Location'}
            </Button>
          </>
        ) : (
          <>
            <div className="bg-secondary-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-secondary-700 mb-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="font-medium">Location sharing active</span>
              </div>
              <p className="text-sm text-secondary-600">
                The sender can see your live location on the map.
              </p>
              {lastUpdate && (
                <p className="text-xs text-secondary-500 mt-2">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </p>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={stopTracking}
              disabled={isUpdating}
            >
              {isUpdating ? 'Stopping...' : 'Stop Sharing'}
            </Button>
          </>
        )}

        <p className="text-xs text-surface-400 text-center">
          Location is updated every {updateIntervalMs / 1000} seconds
        </p>
      </CardContent>
    </Card>
  )
}
