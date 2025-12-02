'use client'

import React, { useEffect, useState, Children, cloneElement, isValidElement } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// AnimatedContainer - Entry animations for content blocks
// ============================================================================

type AnimationType = 'fadeIn' | 'fadeInUp' | 'fadeInDown' | 'slideInLeft' | 'slideInRight' | 'scaleIn' | 'none'

interface AnimatedContainerProps {
  children: React.ReactNode
  animation?: AnimationType
  delay?: number // in milliseconds
  duration?: number // in milliseconds
  className?: string
  as?: keyof JSX.IntrinsicElements
  triggerOnce?: boolean // Only animate once when visible
}

const animationClasses: Record<AnimationType, string> = {
  fadeIn: 'animate-fade-in',
  fadeInUp: 'animate-fade-in-up',
  fadeInDown: 'animate-fade-in-down',
  slideInLeft: 'animate-slide-in-left',
  slideInRight: 'animate-slide-in-right',
  scaleIn: 'animate-scale-in',
  none: '',
}

export function AnimatedContainer({
  children,
  animation = 'fadeIn',
  delay = 0,
  duration,
  className,
  as: Component = 'div',
  triggerOnce = true,
}: AnimatedContainerProps) {
  const [isVisible, setIsVisible] = useState(delay === 0)

  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setIsVisible(true), delay)
      return () => clearTimeout(timer)
    }
  }, [delay])

  const style: React.CSSProperties = {
    ...(duration && { animationDuration: `${duration}ms` }),
    opacity: isVisible ? undefined : 0,
  }

  return React.createElement(
    Component,
    {
      className: cn(
        isVisible && animationClasses[animation],
        className
      ),
      style,
    },
    children
  )
}

// ============================================================================
// AnimatedList - Staggered animations for list items
// ============================================================================

interface AnimatedListProps {
  children: React.ReactNode
  animation?: AnimationType
  staggerDelay?: number // Delay between each item in milliseconds
  initialDelay?: number // Initial delay before first item animates
  className?: string
  itemClassName?: string
}

export function AnimatedList({
  children,
  animation = 'fadeInUp',
  staggerDelay = 50,
  initialDelay = 0,
  className,
  itemClassName,
}: AnimatedListProps) {
  const childArray = Children.toArray(children)

  return (
    <div className={className}>
      {childArray.map((child, index) => (
        <AnimatedContainer
          key={index}
          animation={animation}
          delay={initialDelay + index * staggerDelay}
          className={itemClassName}
        >
          {child}
        </AnimatedContainer>
      ))}
    </div>
  )
}

// ============================================================================
// PageTransition - Page-level transitions
// ============================================================================

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      className={cn(
        'transition-opacity duration-300',
        mounted ? 'opacity-100' : 'opacity-0',
        className
      )}
    >
      {children}
    </div>
  )
}

// ============================================================================
// FadeIn - Simple fade in wrapper
// ============================================================================

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  duration?: number
  className?: string
}

export function FadeIn({ children, delay = 0, duration = 300, className }: FadeInProps) {
  const [isVisible, setIsVisible] = useState(delay === 0)

  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setIsVisible(true), delay)
      return () => clearTimeout(timer)
    }
  }, [delay])

  return (
    <div
      className={cn(
        'transition-opacity',
        isVisible ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  )
}

// ============================================================================
// SlideIn - Slide in from direction
// ============================================================================

type SlideDirection = 'left' | 'right' | 'up' | 'down'

interface SlideInProps {
  children: React.ReactNode
  direction?: SlideDirection
  delay?: number
  duration?: number
  distance?: number // in pixels
  className?: string
}

const getSlideTransform = (direction: SlideDirection, distance: number, isVisible: boolean) => {
  if (isVisible) return 'translate(0, 0)'

  switch (direction) {
    case 'left':
      return `translateX(-${distance}px)`
    case 'right':
      return `translateX(${distance}px)`
    case 'up':
      return `translateY(-${distance}px)`
    case 'down':
      return `translateY(${distance}px)`
  }
}

export function SlideIn({
  children,
  direction = 'up',
  delay = 0,
  duration = 300,
  distance = 20,
  className,
}: SlideInProps) {
  const [isVisible, setIsVisible] = useState(delay === 0)

  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setIsVisible(true), delay)
      return () => clearTimeout(timer)
    }
  }, [delay])

  return (
    <div
      className={cn(
        'transition-all',
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        opacity: isVisible ? 1 : 0,
        transform: getSlideTransform(direction, distance, isVisible),
      }}
    >
      {children}
    </div>
  )
}

// ============================================================================
// ScaleIn - Scale in with optional spring effect
// ============================================================================

interface ScaleInProps {
  children: React.ReactNode
  delay?: number
  duration?: number
  initialScale?: number
  className?: string
}

export function ScaleIn({
  children,
  delay = 0,
  duration = 200,
  initialScale = 0.95,
  className,
}: ScaleInProps) {
  const [isVisible, setIsVisible] = useState(delay === 0)

  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setIsVisible(true), delay)
      return () => clearTimeout(timer)
    }
  }, [delay])

  return (
    <div
      className={cn(
        'transition-all',
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : `scale(${initialScale})`,
      }}
    >
      {children}
    </div>
  )
}

// ============================================================================
// Pulse - Attention-grabbing pulse animation
// ============================================================================

interface PulseProps {
  children: React.ReactNode
  active?: boolean
  className?: string
}

export function Pulse({ children, active = true, className }: PulseProps) {
  return (
    <div className={cn(active && 'animate-pulse-soft', className)}>
      {children}
    </div>
  )
}

// ============================================================================
// Hover animations - Wrappers for hover effects
// ============================================================================

interface HoverScaleProps {
  children: React.ReactNode
  scale?: number
  className?: string
}

export function HoverScale({ children, scale = 1.02, className }: HoverScaleProps) {
  return (
    <div
      className={cn(
        'transition-transform duration-200 ease-out',
        className
      )}
      style={{
        ['--hover-scale' as string]: scale,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `scale(${scale})`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      {children}
    </div>
  )
}

interface HoverLiftProps {
  children: React.ReactNode
  lift?: number // in pixels
  className?: string
}

export function HoverLift({ children, lift = 4, className }: HoverLiftProps) {
  return (
    <div
      className={cn(
        'transition-all duration-200 ease-out',
        className
      )}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `translateY(-${lift}px)`
        e.currentTarget.style.boxShadow = '0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = ''
      }}
    >
      {children}
    </div>
  )
}

// ============================================================================
// Skeleton with shimmer effect
// ============================================================================

interface ShimmerProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean | string
}

export function Shimmer({ className, width, height, rounded = true }: ShimmerProps) {
  const roundedClass = typeof rounded === 'string'
    ? rounded
    : rounded
      ? 'rounded-md'
      : ''

  return (
    <div
      className={cn(
        'bg-gray-200 animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]',
        roundedClass,
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  )
}

// ============================================================================
// CountUp - Animated number counter
// ============================================================================

interface CountUpProps {
  end: number
  start?: number
  duration?: number // in milliseconds
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}

export function CountUp({
  end,
  start = 0,
  duration = 1000,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}: CountUpProps) {
  const [count, setCount] = useState(start)

  useEffect(() => {
    let startTime: number | null = null
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentCount = start + (end - start) * easeOut

      setCount(currentCount)

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animationFrame)
  }, [end, start, duration])

  const displayValue = decimals > 0
    ? count.toFixed(decimals)
    : Math.round(count).toString()

  return (
    <span className={className}>
      {prefix}{displayValue}{suffix}
    </span>
  )
}

// ============================================================================
// ProgressBar - Animated progress bar
// ============================================================================

interface ProgressBarProps {
  value: number // 0-100
  max?: number
  animated?: boolean
  variant?: 'primary' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const progressVariants = {
  primary: 'bg-primary-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
}

const progressSizes = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
}

export function ProgressBar({
  value,
  max = 100,
  animated = true,
  variant = 'primary',
  size = 'md',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const [width, setWidth] = useState(0)
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  useEffect(() => {
    // Delay to trigger animation
    const timer = setTimeout(() => setWidth(percentage), 50)
    return () => clearTimeout(timer)
  }, [percentage])

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full bg-gray-200 rounded-full overflow-hidden', progressSizes[size])}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            progressVariants[variant],
            animated && 'origin-left'
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 mt-1">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  )
}

// ============================================================================
// Ripple effect for buttons (utility hook)
// ============================================================================

export function useRipple() {
  const createRipple = (event: React.MouseEvent<HTMLElement>) => {
    const element = event.currentTarget
    const rect = element.getBoundingClientRect()
    const ripple = document.createElement('span')
    const diameter = Math.max(rect.width, rect.height)
    const radius = diameter / 2

    ripple.style.width = ripple.style.height = `${diameter}px`
    ripple.style.left = `${event.clientX - rect.left - radius}px`
    ripple.style.top = `${event.clientY - rect.top - radius}px`
    ripple.className = 'absolute rounded-full bg-white/30 animate-ripple pointer-events-none'

    // Remove existing ripples
    const existingRipple = element.querySelector('.animate-ripple')
    if (existingRipple) {
      existingRipple.remove()
    }

    element.style.position = 'relative'
    element.style.overflow = 'hidden'
    element.appendChild(ripple)

    // Clean up after animation
    setTimeout(() => {
      ripple.remove()
    }, 600)
  }

  return { createRipple }
}
