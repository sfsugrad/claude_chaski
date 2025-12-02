'use client';

import React from 'react';
import { clsx } from 'clsx';

export type ProgressVariant = 'primary' | 'success' | 'warning' | 'error';
export type ProgressSize = 'sm' | 'md' | 'lg';

export interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  showValue?: boolean;
  label?: string;
  className?: string;
  animated?: boolean;
}

const variantClasses: Record<ProgressVariant, string> = {
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
};

const trackClasses: Record<ProgressVariant, string> = {
  primary: 'bg-primary-100',
  success: 'bg-success-100',
  warning: 'bg-warning-100',
  error: 'bg-error-100',
};

const sizeClasses: Record<ProgressSize, string> = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export function ProgressBar({
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  showValue = false,
  label,
  className,
  animated = false,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={clsx('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between mb-1.5">
          {label && <span className="text-sm font-medium text-surface-700">{label}</span>}
          {showValue && (
            <span className="text-sm text-surface-500">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div
        className={clsx('w-full rounded-full overflow-hidden', trackClasses[variant], sizeClasses[size])}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'Progress'}
      >
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500 ease-out',
            variantClasses[variant],
            animated && 'animate-pulse'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export interface ProgressRingProps {
  value: number;
  max?: number;
  variant?: ProgressVariant;
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
  label?: string;
  className?: string;
}

const ringVariantClasses: Record<ProgressVariant, string> = {
  primary: 'text-primary-500',
  success: 'text-success-500',
  warning: 'text-warning-500',
  error: 'text-error-500',
};

const ringTrackClasses: Record<ProgressVariant, string> = {
  primary: 'text-primary-100',
  success: 'text-success-100',
  warning: 'text-warning-100',
  error: 'text-error-100',
};

export function ProgressRing({
  value,
  max = 100,
  variant = 'primary',
  size = 64,
  strokeWidth = 4,
  showValue = true,
  label,
  className,
}: ProgressRingProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={clsx('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'Progress'}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={ringTrackClasses[variant]}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={clsx('transition-all duration-500 ease-out', ringVariantClasses[variant])}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-surface-900">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}

export interface ProgressStepsProps {
  steps: string[];
  currentStep: number;
  variant?: ProgressVariant;
  className?: string;
}

export function ProgressSteps({
  steps,
  currentStep,
  variant = 'primary',
  className,
}: ProgressStepsProps) {
  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center">
                <div
                  className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    'transition-all duration-200',
                    isCompleted && clsx(variantClasses[variant], 'text-white'),
                    isCurrent && clsx('ring-2 ring-offset-2', `ring-${variant === 'primary' ? 'primary' : variant}-500`, 'bg-white', `text-${variant === 'primary' ? 'primary' : variant}-600`),
                    isUpcoming && 'bg-surface-100 text-surface-400'
                  )}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={clsx(
                    'mt-2 text-xs font-medium',
                    isCompleted || isCurrent ? 'text-surface-900' : 'text-surface-400'
                  )}
                >
                  {step}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={clsx(
                    'flex-1 h-0.5 mx-2',
                    index < currentStep ? variantClasses[variant] : 'bg-surface-200'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// Compound component pattern
const Progress = {
  Bar: ProgressBar,
  Ring: ProgressRing,
  Steps: ProgressSteps,
};

export default Progress;
