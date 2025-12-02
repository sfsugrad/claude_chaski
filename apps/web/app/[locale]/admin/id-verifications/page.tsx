'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { idVerificationAPI, AdminVerificationResponse, IDVerificationStatus } from '@/lib/api'

export default function AdminIDVerificationsPage() {
  const router = useRouter()
  const [verifications, setVerifications] = useState<AdminVerificationResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [selectedVerification, setSelectedVerification] = useState<AdminVerificationResponse | null>(null)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchVerifications = async () => {
    setLoading(true)
    setError('')
    try {
      const response = filter === 'pending'
        ? await idVerificationAPI.admin.getPending()
        : await idVerificationAPI.admin.getAll()
      setVerifications(response.data)
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Admin access required')
        router.push('/dashboard')
      } else {
        setError(err.response?.data?.detail || 'Failed to load verifications')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVerifications()
  }, [filter])

  const handleReview = async () => {
    if (!selectedVerification || !reviewAction) return
    if (reviewAction === 'reject' && !rejectionReason.trim()) {
      setError('Please provide a rejection reason')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await idVerificationAPI.admin.review(
        selectedVerification.id,
        reviewAction,
        reviewAction === 'reject' ? rejectionReason : undefined,
        adminNotes || undefined
      )
      // Close modal and refresh
      setSelectedVerification(null)
      setReviewAction(null)
      setRejectionReason('')
      setAdminNotes('')
      fetchVerifications()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadgeColor = (status: IDVerificationStatus) => {
    switch (status) {
      case 'verified':
      case 'admin_approved':
        return 'bg-green-100 text-green-800'
      case 'pending':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'requires_review':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
      case 'admin_rejected':
        return 'bg-red-100 text-red-800'
      case 'expired':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">ID Verifications</h1>
              <p className="mt-1 text-sm text-gray-600">Review and manage courier ID verifications</p>
            </div>
            <Link
              href="/admin"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Back to Admin
            </Link>
          </div>

          {/* Filter Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setFilter('pending')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    filter === 'pending'
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Pending Review
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    filter === 'all'
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  All Verifications
                </button>
              </nav>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <p className="mt-2 text-gray-600">Loading verifications...</p>
            </div>
          ) : verifications.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No verifications</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filter === 'pending' ? 'No verifications pending review' : 'No verifications found'}
              </p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {verifications.map((verification) => (
                    <tr key={verification.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {verification.user_full_name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {verification.user_email || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(verification.status)}`}>
                          {verification.status.replace('_', ' ')}
                        </span>
                        {verification.failure_reason && (
                          <p className="mt-1 text-xs text-red-600">{verification.failure_reason}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {verification.document_type || '-'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {verification.document_country || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(verification.submitted_at || verification.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {['requires_review', 'failed'].includes(verification.status) && (
                          <button
                            onClick={() => {
                              setSelectedVerification(verification)
                              setReviewAction(null)
                              setRejectionReason('')
                              setAdminNotes('')
                            }}
                            className="text-purple-600 hover:text-purple-900"
                          >
                            Review
                          </button>
                        )}
                        {!['requires_review', 'failed'].includes(verification.status) && (
                          <button
                            onClick={() => setSelectedVerification(verification)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {selectedVerification && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                ID Verification Details
              </h3>
              <button
                onClick={() => setSelectedVerification(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">User</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedVerification.user_full_name}</p>
                  <p className="text-sm text-gray-500">{selectedVerification.user_email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Status</label>
                  <span className={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(selectedVerification.status)}`}>
                    {selectedVerification.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Document Type</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedVerification.document_type || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Country</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedVerification.document_country || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Created</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(selectedVerification.created_at)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Submitted</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(selectedVerification.submitted_at)}</p>
                </div>
              </div>

              {selectedVerification.failure_reason && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Failure Reason</label>
                  <p className="mt-1 text-sm text-red-600">{selectedVerification.failure_reason}</p>
                </div>
              )}

              {selectedVerification.rejection_reason && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Rejection Reason</label>
                  <p className="mt-1 text-sm text-red-600">{selectedVerification.rejection_reason}</p>
                </div>
              )}

              {selectedVerification.admin_notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Admin Notes</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedVerification.admin_notes}</p>
                </div>
              )}

              {/* Review Actions */}
              {['requires_review', 'failed'].includes(selectedVerification.status) && (
                <>
                  <hr className="my-4" />
                  <div className="space-y-4">
                    <div className="flex space-x-4">
                      <button
                        onClick={() => setReviewAction('approve')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
                          reviewAction === 'approve'
                            ? 'bg-green-600 text-white'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setReviewAction('reject')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
                          reviewAction === 'reject'
                            ? 'bg-red-600 text-white'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        Reject
                      </button>
                    </div>

                    {reviewAction === 'reject' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Rejection Reason <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Reason shown to user"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Admin Notes (optional)
                      </label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={2}
                        placeholder="Internal notes"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                      />
                    </div>

                    {reviewAction && (
                      <button
                        onClick={handleReview}
                        disabled={submitting}
                        className={`w-full py-2 px-4 rounded-md text-sm font-medium text-white ${
                          reviewAction === 'approve'
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-red-600 hover:bg-red-700'
                        } disabled:opacity-50`}
                      >
                        {submitting ? 'Submitting...' : `Confirm ${reviewAction === 'approve' ? 'Approval' : 'Rejection'}`}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
