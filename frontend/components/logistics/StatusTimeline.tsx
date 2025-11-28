'use client';

import React from 'react';
import { clsx } from 'clsx';

export type PackageStatus = 'pending' | 'matched' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';

export interface StatusStep {
  status: PackageStatus;
  label: string;
  timestamp?: string;
  description?: string;
}

export interface StatusTimelineProps {
  currentStatus: PackageStatus;
  orientation?: 'horizontal' | 'vertical';
  showTimestamps?: boolean;
  className?: string;
}

const statusOrder: PackageStatus[] = ['pending', 'matched', 'picked_up', 'in_transit', 'delivered'];

const statusConfig: Record<PackageStatus, { label: string; icon: React.ReactNode; description: string }> = {
  pending: {
    label: 'Pending',
    description: 'Waiting for courier match',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  matched: {
    label: 'Matched',
    description: 'Courier assigned to delivery',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  picked_up: {
    label: 'Picked Up',
    description: 'Package collected by courier',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  in_transit: {
    label: 'In Transit',
    description: 'On the way to destination',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    ),
  },
  delivered: {
    label: 'Delivered',
    description: 'Package delivered successfully',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Delivery cancelled',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
};

function getStatusState(status: PackageStatus, currentStatus: PackageStatus) {
  if (currentStatus === 'cancelled') {
    return status === 'cancelled' ? 'current' : 'cancelled';
  }

  const currentIndex = statusOrder.indexOf(currentStatus);
  const statusIndex = statusOrder.indexOf(status);

  if (statusIndex < currentIndex) return 'completed';
  if (statusIndex === currentIndex) return 'current';
  return 'upcoming';
}

export function StatusTimeline({
  currentStatus,
  orientation = 'horizontal',
  showTimestamps = false,
  className,
}: StatusTimelineProps) {
  const steps = currentStatus === 'cancelled'
    ? [...statusOrder.slice(0, statusOrder.indexOf(currentStatus) || 1), 'cancelled' as PackageStatus]
    : statusOrder;

  if (orientation === 'vertical') {
    return (
      <div className={clsx('flex flex-col', className)}>
        {steps.map((status, index) => {
          const state = getStatusState(status, currentStatus);
          const config = statusConfig[status];
          const isLast = index === steps.length - 1;

          return (
            <div key={status} className="flex">
              {/* Icon and connector */}
              <div className="flex flex-col items-center mr-4">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                    state === 'completed' && 'bg-success-500 text-white',
                    state === 'current' && 'bg-primary-500 text-white ring-4 ring-primary-100',
                    state === 'upcoming' && 'bg-surface-100 text-surface-400',
                    state === 'cancelled' && 'bg-error-500 text-white'
                  )}
                >
                  {config.icon}
                </div>
                {!isLast && (
                  <div
                    className={clsx(
                      'w-0.5 flex-1 min-h-[40px]',
                      state === 'completed' ? 'bg-success-500' : 'bg-surface-200'
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div className={clsx('pb-8', isLast && 'pb-0')}>
                <p
                  className={clsx(
                    'font-medium',
                    state === 'completed' && 'text-success-700',
                    state === 'current' && 'text-primary-700',
                    state === 'upcoming' && 'text-surface-400',
                    state === 'cancelled' && 'text-error-700'
                  )}
                >
                  {config.label}
                </p>
                <p className="text-sm text-surface-500 mt-0.5">{config.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal layout
  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((status, index) => {
          const state = getStatusState(status, currentStatus);
          const config = statusConfig[status];
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={status}>
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                    state === 'completed' && 'bg-success-500 text-white',
                    state === 'current' && 'bg-primary-500 text-white ring-4 ring-primary-100',
                    state === 'upcoming' && 'bg-surface-100 text-surface-400',
                    state === 'cancelled' && 'bg-error-500 text-white'
                  )}
                >
                  {config.icon}
                </div>
                <p
                  className={clsx(
                    'text-xs font-medium mt-2 text-center max-w-[80px]',
                    state === 'completed' && 'text-success-700',
                    state === 'current' && 'text-primary-700',
                    state === 'upcoming' && 'text-surface-400',
                    state === 'cancelled' && 'text-error-700'
                  )}
                >
                  {config.label}
                </p>
              </div>
              {!isLast && (
                <div
                  className={clsx(
                    'flex-1 h-0.5 mx-2',
                    state === 'completed' ? 'bg-success-500' : 'bg-surface-200'
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

// Compact version for cards
export function StatusTimelineCompact({
  currentStatus,
  className,
}: {
  currentStatus: PackageStatus;
  className?: string;
}) {
  const config = statusConfig[currentStatus];
  const currentIndex = statusOrder.indexOf(currentStatus);
  const progress = currentStatus === 'cancelled'
    ? 0
    : ((currentIndex + 1) / statusOrder.length) * 100;

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={clsx(
              'w-6 h-6 rounded-full flex items-center justify-center',
              currentStatus === 'delivered' && 'bg-success-100 text-success-600',
              currentStatus === 'cancelled' && 'bg-error-100 text-error-600',
              currentStatus !== 'delivered' && currentStatus !== 'cancelled' && 'bg-primary-100 text-primary-600'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {currentStatus === 'delivered' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : currentStatus === 'cancelled' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              )}
            </svg>
          </div>
          <span className="text-sm font-medium text-surface-900">{config.label}</span>
        </div>
        {currentStatus !== 'cancelled' && (
          <span className="text-xs text-surface-500">
            {currentIndex + 1}/{statusOrder.length}
          </span>
        )}
      </div>
      {currentStatus !== 'cancelled' && (
        <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              currentStatus === 'delivered' ? 'bg-success-500' : 'bg-primary-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default StatusTimeline;
