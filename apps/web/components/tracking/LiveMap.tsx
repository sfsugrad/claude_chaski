'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'

interface LocationPoint {
  latitude: number
  longitude: number
  timestamp?: string
}

interface LiveMapProps {
  courierLocation: LocationPoint | null
  pickupLocation: LocationPoint | null
  dropoffLocation: LocationPoint | null
  heading?: number | null
  isLive?: boolean
  className?: string
}

// Simple map visualization without external dependencies
// Can be replaced with Leaflet/Mapbox for production
export function LiveMap({
  courierLocation,
  pickupLocation,
  dropoffLocation,
  heading,
  isLive = false,
  className = '',
}: LiveMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, dimensions.width, dimensions.height)

    // Calculate bounds
    const points = [pickupLocation, dropoffLocation, courierLocation].filter(
      (p): p is LocationPoint => p !== null
    )

    if (points.length === 0) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Waiting for location data...', dimensions.width / 2, dimensions.height / 2)
      return
    }

    const lats = points.map((p) => p.latitude)
    const lngs = points.map((p) => p.longitude)

    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    // Add padding
    const latPadding = Math.max((maxLat - minLat) * 0.2, 0.005)
    const lngPadding = Math.max((maxLng - minLng) * 0.2, 0.005)

    const paddedMinLat = minLat - latPadding
    const paddedMaxLat = maxLat + latPadding
    const paddedMinLng = minLng - lngPadding
    const paddedMaxLng = maxLng + lngPadding

    // Convert lat/lng to canvas coordinates
    const toCanvas = (lat: number, lng: number) => {
      const x =
        ((lng - paddedMinLng) / (paddedMaxLng - paddedMinLng)) * dimensions.width
      const y =
        dimensions.height -
        ((lat - paddedMinLat) / (paddedMaxLat - paddedMinLat)) * dimensions.height
      return { x, y }
    }

    // Draw route line if we have all points
    if (pickupLocation && dropoffLocation) {
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 3
      ctx.setLineDash([5, 5])
      ctx.beginPath()

      const pickup = toCanvas(pickupLocation.latitude, pickupLocation.longitude)
      const dropoff = toCanvas(dropoffLocation.latitude, dropoffLocation.longitude)

      ctx.moveTo(pickup.x, pickup.y)
      ctx.lineTo(dropoff.x, dropoff.y)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Draw pickup marker (green)
    if (pickupLocation) {
      const pos = toCanvas(pickupLocation.latitude, pickupLocation.longitude)
      ctx.fillStyle = '#22c55e'
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('P', pos.x, pos.y)
    }

    // Draw dropoff marker (red)
    if (dropoffLocation) {
      const pos = toCanvas(dropoffLocation.latitude, dropoffLocation.longitude)
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('D', pos.x, pos.y)
    }

    // Draw courier marker (blue with direction)
    if (courierLocation) {
      const pos = toCanvas(courierLocation.latitude, courierLocation.longitude)

      // Draw courier circle with pulse animation effect
      if (isLive) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2)
        ctx.fill()
      }

      // Direction indicator
      if (heading !== null && heading !== undefined) {
        ctx.save()
        ctx.translate(pos.x, pos.y)
        ctx.rotate(((heading - 90) * Math.PI) / 180)
        ctx.fillStyle = '#3b82f6'
        ctx.beginPath()
        ctx.moveTo(15, 0)
        ctx.lineTo(-5, -8)
        ctx.lineTo(-5, 8)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      // Courier marker
      ctx.fillStyle = '#3b82f6'
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.stroke()

      // Courier icon
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('C', pos.x, pos.y)
    }

    // Draw legend
    ctx.fillStyle = '#64748b'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'

    const legendY = dimensions.height - 15
    // Pickup legend
    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.arc(15, legendY, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#64748b'
    ctx.fillText('Pickup', 25, legendY + 3)

    // Dropoff legend
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(85, legendY, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#64748b'
    ctx.fillText('Dropoff', 95, legendY + 3)

    // Courier legend
    ctx.fillStyle = '#3b82f6'
    ctx.beginPath()
    ctx.arc(165, legendY, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#64748b'
    ctx.fillText('Courier', 175, legendY + 3)
  }, [courierLocation, pickupLocation, dropoffLocation, heading, isLive, dimensions])

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      const container = canvasRef.current?.parentElement
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: Math.min(container.clientWidth * 0.75, 400),
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  return (
    <Card className={className}>
      <div className="relative overflow-hidden rounded-lg">
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full"
        />
        {isLive && courierLocation && (
          <div className="absolute top-2 right-2 bg-secondary-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            Live Tracking
          </div>
        )}
      </div>
    </Card>
  )
}
