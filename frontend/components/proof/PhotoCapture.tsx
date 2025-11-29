'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/Button'

interface PhotoCaptureProps {
  onCapture: (file: File, dataUrl: string) => void
  onClear?: () => void
  maxSizeMB?: number
  disabled?: boolean
}

export function PhotoCapture({
  onCapture,
  onClear,
  maxSizeMB = 10,
  disabled = false,
}: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setError(null)

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }

      // Validate file size
      const maxBytes = maxSizeMB * 1024 * 1024
      if (file.size > maxBytes) {
        setError(`Image must be smaller than ${maxSizeMB}MB`)
        return
      }

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        setPreview(dataUrl)
        onCapture(file, dataUrl)
      }
      reader.readAsDataURL(file)
    },
    [maxSizeMB, onCapture]
  )

  const handleClear = useCallback(() => {
    setPreview(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClear?.()
  }, [onClear])

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className="space-y-4">
      {/* Hidden file input with camera capture on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Captured proof"
            className="w-full max-h-64 object-contain rounded-lg border border-surface-200"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleButtonClick}
              disabled={disabled}
            >
              Retake
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={disabled}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={disabled}
          className={`
            w-full h-48 border-2 border-dashed rounded-lg
            flex flex-col items-center justify-center gap-3
            transition-colors
            ${
              disabled
                ? 'bg-surface-100 border-surface-300 cursor-not-allowed'
                : 'bg-surface-50 border-surface-300 hover:border-primary-500 hover:bg-primary-50 cursor-pointer'
            }
          `}
        >
          <svg
            className={`w-12 h-12 ${disabled ? 'text-surface-400' : 'text-surface-500'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className={`text-sm font-medium ${disabled ? 'text-surface-400' : 'text-surface-600'}`}>
            Take Photo or Upload
          </span>
          <span className="text-xs text-surface-400">
            Max {maxSizeMB}MB
          </span>
        </button>
      )}

      {error && (
        <p className="text-sm text-error-600">{error}</p>
      )}
    </div>
  )
}
