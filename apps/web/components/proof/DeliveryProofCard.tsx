'use client'

import { useState } from 'react'
import { DeliveryProofResponse } from '@/lib/api'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

interface DeliveryProofCardProps {
  proof: DeliveryProofResponse
}

export function DeliveryProofCard({ proof }: DeliveryProofCardProps) {
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showSignatureModal, setShowSignatureModal] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDistance = (meters: number | null) => {
    if (meters === null) return 'Unknown'
    if (meters < 1000) {
      return `${Math.round(meters)}m`
    }
    return `${(meters / 1000).toFixed(2)}km`
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Delivery Proof</h3>
            <Badge variant={proof.is_verified ? 'success' : 'warning'}>
              {proof.is_verified ? 'Verified' : 'Pending Verification'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Proof Type Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-surface-600">Proof Type:</span>
            <Badge variant="secondary">
              {proof.proof_type === 'both'
                ? 'Photo + Signature'
                : proof.proof_type === 'photo'
                ? 'Photo Only'
                : proof.proof_type === 'signature'
                ? 'Signature Only'
                : 'None'}
            </Badge>
          </div>

          {/* Photo Preview */}
          {proof.photo_url && (
            <div>
              <p className="text-sm font-medium text-surface-700 mb-2">Photo</p>
              <button
                onClick={() => setShowPhotoModal(true)}
                className="block w-full"
              >
                <img
                  src={proof.photo_url}
                  alt="Delivery proof"
                  className="w-full max-h-48 object-cover rounded-lg border border-surface-200 hover:opacity-90 transition-opacity cursor-pointer"
                />
              </button>
            </div>
          )}

          {/* Signature Preview */}
          {proof.signature_url && (
            <div>
              <p className="text-sm font-medium text-surface-700 mb-2">Signature</p>
              <button
                onClick={() => setShowSignatureModal(true)}
                className="block"
              >
                <img
                  src={proof.signature_url}
                  alt="Recipient signature"
                  className="max-h-24 border border-surface-200 rounded bg-white hover:opacity-90 transition-opacity cursor-pointer"
                />
              </button>
            </div>
          )}

          {/* Recipient Info */}
          {(proof.recipient_name || proof.recipient_relationship) && (
            <div className="bg-surface-50 rounded-lg p-3">
              <p className="text-sm font-medium text-surface-700 mb-1">Recipient</p>
              {proof.recipient_name && (
                <p className="text-sm text-surface-600">{proof.recipient_name}</p>
              )}
              {proof.recipient_relationship && (
                <p className="text-xs text-surface-500 capitalize">
                  ({proof.recipient_relationship})
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          {proof.notes && (
            <div>
              <p className="text-sm font-medium text-surface-700 mb-1">Notes</p>
              <p className="text-sm text-surface-600 bg-surface-50 rounded-lg p-3">
                {proof.notes}
              </p>
            </div>
          )}

          {/* Location Info */}
          {(proof.latitude !== null || proof.distance_from_dropoff_meters !== null) && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-surface-200">
              {proof.distance_from_dropoff_meters !== null && (
                <div>
                  <p className="text-xs text-surface-500">Distance from dropoff</p>
                  <p className="text-sm font-medium">
                    {formatDistance(proof.distance_from_dropoff_meters)}
                  </p>
                </div>
              )}
              {proof.latitude !== null && proof.longitude !== null && (
                <div>
                  <p className="text-xs text-surface-500">Coordinates</p>
                  <p className="text-sm font-mono">
                    {proof.latitude.toFixed(6)}, {proof.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-surface-200">
            <div>
              <p className="text-xs text-surface-500">Captured</p>
              <p className="text-sm">{formatDate(proof.captured_at)}</p>
            </div>
            <div>
              <p className="text-xs text-surface-500">Submitted</p>
              <p className="text-sm">{formatDate(proof.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Photo Modal */}
      <Modal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        title="Delivery Photo"
      >
        {proof.photo_url && (
          <img
            src={proof.photo_url}
            alt="Delivery proof"
            className="w-full max-h-[70vh] object-contain"
          />
        )}
      </Modal>

      {/* Signature Modal */}
      <Modal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        title="Recipient Signature"
      >
        {proof.signature_url && (
          <div className="bg-white p-4 rounded-lg">
            <img
              src={proof.signature_url}
              alt="Recipient signature"
              className="max-h-64 mx-auto"
            />
          </div>
        )}
      </Modal>
    </>
  )
}
