'use client'

import { TrackingEvent } from '@/lib/api'

interface TrackingEventsProps {
  events: TrackingEvent[]
}

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  location_update: { icon: '📍', color: 'bg-blue-100 text-blue-600' },
  pickup_started: { icon: '🚶', color: 'bg-yellow-100 text-yellow-600' },
  pickup_completed: { icon: '📦', color: 'bg-green-100 text-green-600' },
  in_transit: { icon: '🚗', color: 'bg-blue-100 text-blue-600' },
  delivery_started: { icon: '🏠', color: 'bg-purple-100 text-purple-600' },
  delivery_completed: { icon: '✅', color: 'bg-green-100 text-green-600' },
  delay_reported: { icon: '⏰', color: 'bg-orange-100 text-orange-600' },
  route_deviation: { icon: '↩️', color: 'bg-red-100 text-red-600' },
}

const EVENT_LABELS: Record<string, string> = {
  location_update: 'Location Updated',
  pickup_started: 'Heading to Pickup',
  pickup_completed: 'Package Picked Up',
  in_transit: 'In Transit',
  delivery_started: 'Arriving at Destination',
  delivery_completed: 'Package Delivered',
  delay_reported: 'Delay Reported',
  route_deviation: 'Route Changed',
}

export function TrackingEvents({ events }: TrackingEventsProps) {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-surface-500">
        <p>No tracking events yet</p>
      </div>
    )
  }

  // Group events by date
  const groupedEvents: Record<string, TrackingEvent[]> = {}
  events.forEach((event) => {
    const dateKey = formatDate(event.created_at)
    if (!groupedEvents[dateKey]) {
      groupedEvents[dateKey] = []
    }
    groupedEvents[dateKey].push(event)
  })

  return (
    <div className="space-y-6">
      {Object.entries(groupedEvents).map(([date, dateEvents]) => (
        <div key={date}>
          <h4 className="text-sm font-medium text-surface-500 mb-3">{date}</h4>
          <div className="space-y-3">
            {dateEvents.map((event, index) => {
              const eventConfig = EVENT_ICONS[event.event_type] || {
                icon: '📌',
                color: 'bg-gray-100 text-gray-600',
              }

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3"
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full ${eventConfig.color} flex items-center justify-center text-sm`}
                  >
                    {eventConfig.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-surface-900">
                        {EVENT_LABELS[event.event_type] || event.event_type}
                      </p>
                      <span className="text-xs text-surface-400">
                        {formatTime(event.created_at)}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-sm text-surface-600 mt-0.5">
                        {event.description}
                      </p>
                    )}
                    {event.extra_data && (
                      <p className="text-xs text-surface-400 mt-1">
                        {(() => {
                          try {
                            const meta = JSON.parse(event.extra_data)
                            if (meta.estimated_delay_minutes) {
                              return `Expected delay: ${meta.estimated_delay_minutes} minutes`
                            }
                            return null
                          } catch {
                            return null
                          }
                        })()}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
