'use client'

import { useState, useEffect } from 'react'

interface CountdownTimerProps {
  deadline: string | null
  onExpire?: () => void
  className?: string
  showLabel?: boolean
}

export default function CountdownTimer({
  deadline,
  onExpire,
  className = '',
  showLabel = true,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number
    minutes: number
    seconds: number
    expired: boolean
  }>({ hours: 0, minutes: 0, seconds: 0, expired: false })

  useEffect(() => {
    if (!deadline) {
      setTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: true })
      return
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const deadlineTime = new Date(deadline).getTime()
      const difference = deadlineTime - now

      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: true })
        onExpire?.()
        return
      }

      const hours = Math.floor(difference / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      setTimeLeft({ hours, minutes, seconds, expired: false })
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [deadline, onExpire])

  if (!deadline) {
    return null
  }

  const isUrgent = timeLeft.hours < 6 && !timeLeft.expired
  const isCritical = timeLeft.hours < 1 && !timeLeft.expired

  const formatNumber = (n: number) => n.toString().padStart(2, '0')

  if (timeLeft.expired) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && <span className="text-sm text-gray-500">Deadline:</span>}
        <span className="text-red-600 font-medium">Expired</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && <span className="text-sm text-gray-500">Time left:</span>}
      <div
        className={`font-mono font-medium ${
          isCritical
            ? 'text-red-600'
            : isUrgent
            ? 'text-orange-500'
            : 'text-gray-900'
        }`}
      >
        {timeLeft.hours > 0 && (
          <>
            <span className="tabular-nums">{formatNumber(timeLeft.hours)}</span>
            <span className="text-gray-400">h </span>
          </>
        )}
        <span className="tabular-nums">{formatNumber(timeLeft.minutes)}</span>
        <span className="text-gray-400">m </span>
        <span className="tabular-nums">{formatNumber(timeLeft.seconds)}</span>
        <span className="text-gray-400">s</span>
      </div>
      {isCritical && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          Urgent
        </span>
      )}
    </div>
  )
}
