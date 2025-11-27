'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authAPI, ratingsAPI, UserResponse, RatingResponse, UserRatingSummary } from '@/lib/api'
import Navbar from '@/components/Navbar'
import StarRating from '@/components/StarRating'

export default function MyReviewsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserResponse | null>(null)
  const [ratings, setRatings] = useState<RatingResponse[]>([])
  const [summary, setSummary] = useState<UserRatingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const userResponse = await authAPI.getCurrentUser()
      setUser(userResponse.data)

      const [ratingsResponse, summaryResponse] = await Promise.all([
        ratingsAPI.getUserRatings(userResponse.data.id),
        ratingsAPI.getUserRatingSummary(userResponse.data.id)
      ])

      setRatings(ratingsResponse.data.ratings)
      setSummary(summaryResponse.data)
    } catch (err) {
      setError('Please log in to view your reviews.')
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your reviews...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">My Reviews</h1>
          <p className="text-gray-600 mt-1">See what others have said about you</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Rating Summary */}
        {summary && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-gray-900">
                  {summary.average_rating?.toFixed(1) || '-'}
                </div>
                <div className="mt-2">
                  <StarRating
                    rating={summary.average_rating || 0}
                    size="lg"
                  />
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {summary.total_ratings} {summary.total_ratings === 1 ? 'review' : 'reviews'}
                </div>
              </div>

              {/* Rating Breakdown */}
              <div className="flex-1">
                {[5, 4, 3, 2, 1].map((score) => {
                  const count = summary.rating_breakdown[score] || 0
                  const percentage = summary.total_ratings > 0
                    ? (count / summary.total_ratings) * 100
                    : 0

                  return (
                    <div key={score} className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-600 w-3">{score}</span>
                      <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-yellow-400 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500 w-8">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Reviews List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Reviews</h2>
          </div>

          {ratings.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-4">📝</div>
              <p className="text-gray-600">You haven't received any reviews yet.</p>
              <p className="text-sm text-gray-500 mt-2">
                Complete deliveries to start receiving reviews from other users.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {ratings.map((rating) => (
                <div key={rating.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-medium text-gray-900">
                        {rating.rater_name || 'Anonymous User'}
                      </span>
                      <div className="mt-1">
                        <StarRating rating={rating.score} size="sm" />
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">
                      {new Date(rating.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  {rating.comment ? (
                    <p className="text-gray-700 mt-2">{rating.comment}</p>
                  ) : (
                    <p className="text-gray-400 italic mt-2">No comment provided</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
