'use client'

import { useState } from 'react'

interface StarRatingProps {
  rating?: number
  maxRating?: number
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  onRatingChange?: (rating: number) => void
  showValue?: boolean
  totalRatings?: number
}

export default function StarRating({
  rating = 0,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onRatingChange,
  showValue = false,
  totalRatings,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0)
  const [selectedRating, setSelectedRating] = useState(rating)

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  const displayRating = interactive ? (hoverRating || selectedRating) : rating

  const handleClick = (value: number) => {
    if (interactive) {
      setSelectedRating(value)
      onRatingChange?.(value)
    }
  }

  const handleMouseEnter = (value: number) => {
    if (interactive) {
      setHoverRating(value)
    }
  }

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[...Array(maxRating)].map((_, index) => {
          const value = index + 1
          const isFilled = value <= displayRating
          const isPartiallyFilled = !isFilled && value - 0.5 <= displayRating

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleClick(value)}
              onMouseEnter={() => handleMouseEnter(value)}
              onMouseLeave={handleMouseLeave}
              disabled={!interactive}
              className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform disabled:cursor-default`}
              aria-label={`${value} star${value > 1 ? 's' : ''}`}
            >
              <svg
                className={`${sizeClasses[size]} ${
                  isFilled
                    ? 'text-yellow-400 fill-yellow-400'
                    : isPartiallyFilled
                    ? 'text-yellow-400 fill-yellow-200'
                    : 'text-gray-300 fill-gray-300'
                }`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
          )
        })}
      </div>
      {showValue && rating > 0 && (
        <span className="text-sm text-gray-600 ml-1">
          {rating.toFixed(1)}
          {totalRatings !== undefined && (
            <span className="text-gray-400"> ({totalRatings})</span>
          )}
        </span>
      )}
      {showValue && rating === 0 && (
        <span className="text-sm text-gray-400 ml-1">No ratings</span>
      )}
    </div>
  )
}
