'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { PhotoCapture, SignaturePad } from '@/components/proof'
import { packagesAPI, proofAPI, DeliveryProofCreate, PackageResponse } from '@/lib/api'
import CourierVerificationGuard from '@/components/CourierVerificationGuard'

type ProofStep = 'photo' | 'signature' | 'details' | 'confirm'

const RECIPIENT_RELATIONSHIPS = [
  { value: 'addressee', label: 'Addressee (recipient)' },
  { value: 'family', label: 'Family member' },
  { value: 'neighbor', label: 'Neighbor' },
  { value: 'colleague', label: 'Colleague' },
  { value: 'security', label: 'Security/Doorman' },
  { value: 'other', label: 'Other' },
]

function CaptureProofContent() {
  const params = useParams()
  const router = useRouter()
  const packageId = parseInt(params.packageId as string, 10)

  const [currentStep, setCurrentStep] = useState<ProofStep>('photo')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pkg, setPkg] = useState<PackageResponse | null>(null)

  // Proof data
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoS3Key, setPhotoS3Key] = useState<string | null>(null)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [recipientName, setRecipientName] = useState('')
  const [recipientRelationship, setRecipientRelationship] = useState('')
  const [notes, setNotes] = useState('')
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)

  // Get package details
  useEffect(() => {
    const fetchPackage = async () => {
      try {
        const response = await packagesAPI.getById(packageId)
        setPkg(response.data)

        // Check if package is in the right status
        if (!['picked_up', 'in_transit'].includes(response.data.status)) {
          setError(`Cannot capture proof for package in "${response.data.status}" status`)
        }
      } catch (err) {
        setError('Failed to load package details')
      } finally {
        setLoading(false)
      }
    }

    fetchPackage()
  }, [packageId])

  // Get current location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
        },
        (err) => {
          console.warn('Geolocation error:', err)
        },
        { enableHighAccuracy: true }
      )
    }
  }, [])

  const handlePhotoCapture = useCallback((file: File, dataUrl: string) => {
    setPhotoFile(file)
    setPhotoPreview(dataUrl)
  }, [])

  const handleSignatureComplete = useCallback((dataUrl: string) => {
    setSignatureData(dataUrl)
  }, [])

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null

    try {
      // Get pre-signed URL
      const urlResponse = await proofAPI.getUploadUrl(packageId, 'photo', photoFile.type)
      const { upload_url, key, fields } = urlResponse.data

      // Upload to S3
      await proofAPI.uploadToS3(upload_url, fields, photoFile)

      return key
    } catch (err) {
      throw new Error('Failed to upload photo')
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      // Upload photo if present
      let s3Key = photoS3Key
      if (photoFile && !photoS3Key) {
        s3Key = await uploadPhoto()
        setPhotoS3Key(s3Key)
      }

      // Prepare proof data
      const proofData: DeliveryProofCreate = {
        photo_s3_key: s3Key || undefined,
        signature_data: signatureData || undefined,
        recipient_name: recipientName || undefined,
        recipient_relationship: recipientRelationship || undefined,
        notes: notes || undefined,
        latitude: location?.lat,
        longitude: location?.lng,
        location_accuracy_meters: location?.accuracy,
        captured_at: new Date().toISOString(),
      }

      // Create proof record
      await proofAPI.create(packageId, proofData)

      // Redirect to package details
      router.push(`/packages/${packageId}?delivered=true`)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit proof'
      setError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const goToStep = (step: ProofStep) => {
    setCurrentStep(step)
  }

  const canProceedFromPhoto = photoPreview !== null
  const canProceedFromSignature = signatureData !== null || photoPreview !== null
  const canSubmit = (photoPreview !== null || signatureData !== null)

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 p-4 flex items-center justify-center">
        <div className="text-surface-600">Loading...</div>
      </div>
    )
  }

  if (error && !pkg) {
    return (
      <div className="min-h-screen bg-surface-50 p-4">
        <Alert variant="error" title="Error">
          {error}
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-surface-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-semibold">Delivery Proof</h1>
          <p className="text-sm text-surface-600 mt-1">
            {pkg?.dropoff_address}
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b border-surface-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-between">
          {(['photo', 'signature', 'details', 'confirm'] as ProofStep[]).map((step, idx) => (
            <button
              key={step}
              onClick={() => goToStep(step)}
              className={`flex items-center gap-2 ${
                currentStep === step
                  ? 'text-primary-600 font-medium'
                  : 'text-surface-400'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  currentStep === step
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-200 text-surface-600'
                }`}
              >
                {idx + 1}
              </span>
              <span className="hidden sm:inline capitalize">{step}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto p-4">
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* Step: Photo */}
        {currentStep === 'photo' && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Take Photo</h2>
              <p className="text-sm text-surface-600">
                Take a photo of the delivered package at the dropoff location
              </p>
            </CardHeader>
            <CardContent>
              <PhotoCapture
                onCapture={handlePhotoCapture}
                onClear={() => {
                  setPhotoFile(null)
                  setPhotoPreview(null)
                  setPhotoS3Key(null)
                }}
              />
              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => goToStep('signature')}
                  className="flex-1"
                >
                  Skip Photo
                </Button>
                <Button
                  variant="primary"
                  onClick={() => goToStep('signature')}
                  disabled={!canProceedFromPhoto}
                  className="flex-1"
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Signature */}
        {currentStep === 'signature' && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Collect Signature</h2>
              <p className="text-sm text-surface-600">
                Ask the recipient to sign below to confirm delivery
              </p>
            </CardHeader>
            <CardContent>
              <SignaturePad
                onComplete={handleSignatureComplete}
                onClear={() => setSignatureData(null)}
                width={Math.min(380, window.innerWidth - 64)}
                height={200}
              />
              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => goToStep('photo')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  variant="outline"
                  onClick={() => goToStep('details')}
                  className="flex-1"
                >
                  Skip Signature
                </Button>
                <Button
                  variant="primary"
                  onClick={() => goToStep('details')}
                  disabled={!canProceedFromSignature}
                  className="flex-1"
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Details */}
        {currentStep === 'details' && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Recipient Details</h2>
              <p className="text-sm text-surface-600">
                Add optional information about the delivery
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Recipient Name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Who received the package?"
              />

              <Select
                label="Relationship"
                value={recipientRelationship}
                onChange={(e) => setRecipientRelationship(e.target.value)}
                options={[
                  { value: '', label: 'Select relationship...' },
                  ...RECIPIENT_RELATIONSHIPS,
                ]}
              />

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes about the delivery..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                />
              </div>

              {location && (
                <div className="text-xs text-surface-500">
                  Location captured: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  {' '}(accuracy: {Math.round(location.accuracy)}m)
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => goToStep('signature')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={() => goToStep('confirm')}
                  className="flex-1"
                >
                  Review
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Confirm */}
        {currentStep === 'confirm' && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Confirm Delivery</h2>
              <p className="text-sm text-surface-600">
                Review the proof before submitting
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preview captured proof */}
              <div className="grid grid-cols-2 gap-4">
                {photoPreview && (
                  <div>
                    <p className="text-sm font-medium text-surface-700 mb-1">Photo</p>
                    <img
                      src={photoPreview}
                      alt="Proof photo"
                      className="w-full h-32 object-cover rounded-lg border border-surface-200"
                    />
                  </div>
                )}
                {signatureData && (
                  <div>
                    <p className="text-sm font-medium text-surface-700 mb-1">Signature</p>
                    <img
                      src={signatureData}
                      alt="Signature"
                      className="h-20 border border-surface-200 rounded bg-white"
                    />
                  </div>
                )}
              </div>

              {(recipientName || recipientRelationship) && (
                <div className="bg-surface-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-surface-700">Recipient</p>
                  {recipientName && <p className="text-sm">{recipientName}</p>}
                  {recipientRelationship && (
                    <p className="text-xs text-surface-500 capitalize">
                      {RECIPIENT_RELATIONSHIPS.find(r => r.value === recipientRelationship)?.label}
                    </p>
                  )}
                </div>
              )}

              {notes && (
                <div className="bg-surface-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-surface-700">Notes</p>
                  <p className="text-sm">{notes}</p>
                </div>
              )}

              <Alert variant="info">
                By submitting, you confirm that this package has been delivered
                successfully. This action cannot be undone.
              </Alert>

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => goToStep('details')}
                  className="flex-1"
                  disabled={submitting}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  loading={submitting}
                  className="flex-1"
                >
                  {submitting ? 'Submitting...' : 'Submit Proof'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function CaptureProofPage() {
  return (
    <CourierVerificationGuard>
      <CaptureProofContent />
    </CourierVerificationGuard>
  )
}
