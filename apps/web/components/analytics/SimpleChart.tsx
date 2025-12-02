'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'

interface DataPoint {
  label: string
  value: number
}

interface SimpleChartProps {
  title: string
  data: DataPoint[]
  type?: 'line' | 'bar'
  color?: string
  height?: number
  showGrid?: boolean
  formatValue?: (value: number) => string
  className?: string
}

export function SimpleChart({
  title,
  data,
  type = 'line',
  color = '#3b82f6',
  height = 200,
  showGrid = true,
  formatValue = (v) => v.toString(),
  className = '',
}: SimpleChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 400, height })
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height: h } = dimensions
    const padding = { top: 20, right: 20, bottom: 40, left: 50 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = h - padding.top - padding.bottom

    // Clear canvas
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, h)

    if (data.length === 0) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No data available', width / 2, h / 2)
      return
    }

    const values = data.map((d) => d.value)
    const maxValue = Math.max(...values, 1)
    const minValue = Math.min(...values, 0)
    const valueRange = maxValue - minValue || 1

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 1

      // Horizontal grid lines
      const gridLines = 5
      for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (i * chartHeight) / gridLines
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(width - padding.right, y)
        ctx.stroke()

        // Y-axis labels
        const value = maxValue - (i * valueRange) / gridLines
        ctx.fillStyle = '#64748b'
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(formatValue(Math.round(value)), padding.left - 8, y)
      }
    }

    // Calculate point positions
    const points = data.map((d, i) => ({
      x: padding.left + (i * chartWidth) / (data.length - 1 || 1),
      y:
        padding.top +
        chartHeight -
        ((d.value - minValue) / valueRange) * chartHeight,
      data: d,
    }))

    if (type === 'line') {
      // Draw line
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()

      points.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point.x, point.y)
        } else {
          ctx.lineTo(point.x, point.y)
        }
      })
      ctx.stroke()

      // Draw area fill
      ctx.fillStyle = color + '20'
      ctx.beginPath()
      ctx.moveTo(points[0].x, h - padding.bottom)
      points.forEach((point) => {
        ctx.lineTo(point.x, point.y)
      })
      ctx.lineTo(points[points.length - 1].x, h - padding.bottom)
      ctx.closePath()
      ctx.fill()

      // Draw points
      points.forEach((point) => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(point.x, point.y, 2, 0, Math.PI * 2)
        ctx.fill()
      })
    } else {
      // Bar chart
      const barWidth = Math.min(chartWidth / data.length - 4, 40)
      const barSpacing = (chartWidth - barWidth * data.length) / (data.length + 1)

      data.forEach((d, i) => {
        const barHeight = ((d.value - minValue) / valueRange) * chartHeight
        const x = padding.left + barSpacing + i * (barWidth + barSpacing)
        const y = h - padding.bottom - barHeight

        ctx.fillStyle = color
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0])
        ctx.fill()
      })
    }

    // X-axis labels (show first, middle, last)
    ctx.fillStyle = '#64748b'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const labelIndices = [0, Math.floor(data.length / 2), data.length - 1]
    labelIndices.forEach((i) => {
      if (i < data.length) {
        const x =
          type === 'line'
            ? padding.left + (i * chartWidth) / (data.length - 1 || 1)
            : padding.left +
              (chartWidth - (40 * data.length + 4 * (data.length - 1))) / 2 +
              i * 44 +
              20
        ctx.fillText(data[i].label, x, h - padding.bottom + 8)
      }
    })
  }, [data, dimensions, type, color, showGrid, formatValue])

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      const container = canvasRef.current?.parentElement
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height,
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [height])

  return (
    <Card className={className}>
      <CardHeader>
        <h3 className="text-lg font-semibold">{title}</h3>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            className="w-full"
          />
          {hoveredPoint && (
            <div className="absolute bg-surface-900 text-white px-2 py-1 rounded text-sm pointer-events-none">
              {hoveredPoint.label}: {formatValue(hoveredPoint.value)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
