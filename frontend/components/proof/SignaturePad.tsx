'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'

interface SignaturePadProps {
  onComplete: (signatureDataUrl: string) => void
  onClear?: () => void
  width?: number
  height?: number
  penColor?: string
  backgroundColor?: string
  disabled?: boolean
}

export function SignaturePad({
  onComplete,
  onClear,
  width = 400,
  height = 200,
  penColor = '#000000',
  backgroundColor = '#ffffff',
  disabled = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size accounting for device pixel ratio
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    // Set background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    // Set drawing styles
    ctx.strokeStyle = penColor
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [width, height, penColor, backgroundColor])

  const getCanvasCoordinates = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }

      const rect = canvas.getBoundingClientRect()

      if ('touches' in event) {
        // Touch event
        const touch = event.touches[0] || event.changedTouches[0]
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        }
      } else {
        // Mouse event
        return {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
      }
    },
    []
  )

  const startDrawing = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return
      event.preventDefault()

      const pos = getCanvasCoordinates(event)
      lastPosRef.current = pos
      setIsDrawing(true)
    },
    [disabled, getCanvasCoordinates]
  )

  const draw = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || disabled) return
      event.preventDefault()

      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx || !lastPosRef.current) return

      const currentPos = getCanvasCoordinates(event)

      ctx.beginPath()
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
      ctx.lineTo(currentPos.x, currentPos.y)
      ctx.stroke()

      lastPosRef.current = currentPos
      setHasSignature(true)
    },
    [isDrawing, disabled, getCanvasCoordinates]
  )

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
    lastPosRef.current = null
  }, [])

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)
    setHasSignature(false)
    onClear?.()
  }, [width, height, backgroundColor, onClear])

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return

    const dataUrl = canvas.toDataURL('image/png')
    onComplete(dataUrl)
  }, [hasSignature, onComplete])

  return (
    <div className="space-y-4">
      <div
        className={`
          relative border-2 rounded-lg overflow-hidden
          ${disabled ? 'border-surface-300 opacity-50' : 'border-surface-400'}
        `}
      >
        <canvas
          ref={canvasRef}
          className={`
            block touch-none
            ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}
          `}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
        />

        {!hasSignature && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-surface-400 text-sm">
              Sign here
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={disabled || !hasSignature}
          className="flex-1"
        >
          Clear
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={disabled || !hasSignature}
          className="flex-1"
        >
          Confirm Signature
        </Button>
      </div>

      <p className="text-xs text-surface-500 text-center">
        By signing, you confirm the package was delivered
      </p>
    </div>
  )
}
