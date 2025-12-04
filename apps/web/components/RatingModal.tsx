'use client'

import { useState } from 'react'
import StarRating from './StarRating'
import { ratingsAPI, PendingRating } from '@/lib/api'

interface RatingModalProps {
  isOpen: boolean
  onClose: () => void
  pendingRating: PendingRating
  onRatingSubmitted: () => void
}

export default function RatingModal({
  isOpen,
  onClose,
  pendingRating,
  onRatingSubmitted,
}: RatingModalProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rating === 0) {
      setError('Please select a rating')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await ratingsAPI.create({
        package_id: pendingRating.package_id,
        score: rating,
        comment: comment.trim() || undefined,
      })
      onRatingSubmitted()
      onClose()
      setRating(0)
      setComment('')
    } catch (err: any) {
      // Handle various error response formats from FastAPI
      const detail = err.response?.data?.detail;
      let errorMessage = 'Failed to submit rating';

      if (Array.isArray(detail)) {
        // FastAPI validation errors come as array of objects with {type, loc, msg, input}
        errorMessage = detail.map((e: any) => {
          if (typeof e === 'string') return e;
          return e.msg || JSON.stringify(e);
        }).join(', ');
      } else if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (detail && typeof detail === 'object') {
        // Single validation error object
        errorMessage = detail.msg || JSON.stringify(detail);
      }

      setError(errorMessage);
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setRating(0)
    setComment('')
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Rate Your Experience</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-gray-600">
            How was your experience with{' '}
            <span className="font-medium">{pendingRating.user_to_rate_name}</span>
            {' '}as a {pendingRating.user_to_rate_role}?
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Package: {pendingRating.package_description}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Rating
            </label>
            <div className="flex justify-center">
              <StarRating
                rating={rating}
                size="lg"
                interactive
                onRatingChange={setRating}
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
              Comment (Optional)
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-gray-400 mt-1">{comment.length}/1000</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={isSubmitting || rating === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
