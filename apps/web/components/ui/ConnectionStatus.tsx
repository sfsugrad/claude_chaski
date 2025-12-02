'use client';

import React from 'react';
import { clsx } from 'clsx';
import { ConnectionStatus as ConnectionStatusType } from '@/hooks/useWebSocket';

export interface ConnectionStatusProps {
  status: ConnectionStatusType;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<ConnectionStatusType, {
  color: string;
  pulseColor: string;
  label: string;
  description: string;
}> = {
  connected: {
    color: 'bg-success-500',
    pulseColor: 'bg-success-400',
    label: 'Connected',
    description: 'Real-time updates active',
  },
  connecting: {
    color: 'bg-warning-500',
    pulseColor: 'bg-warning-400',
    label: 'Connecting',
    description: 'Establishing connection...',
  },
  disconnected: {
    color: 'bg-surface-400',
    pulseColor: 'bg-surface-300',
    label: 'Offline',
    description: 'Real-time updates paused',
  },
  error: {
    color: 'bg-error-500',
    pulseColor: 'bg-error-400',
    label: 'Error',
    description: 'Connection failed',
  },
};

const sizeConfig = {
  sm: {
    dot: 'w-2 h-2',
    pulse: 'w-2 h-2',
    text: 'text-xs',
    gap: 'gap-1.5',
  },
  md: {
    dot: 'w-2.5 h-2.5',
    pulse: 'w-2.5 h-2.5',
    text: 'text-sm',
    gap: 'gap-2',
  },
  lg: {
    dot: 'w-3 h-3',
    pulse: 'w-3 h-3',
    text: 'text-base',
    gap: 'gap-2',
  },
};

export function ConnectionStatus({
  status,
  showLabel = false,
  size = 'sm',
  className,
}: ConnectionStatusProps) {
  const config = statusConfig[status];
  const sizeStyles = sizeConfig[size];
  const isActive = status === 'connected' || status === 'connecting';

  return (
    <div
      className={clsx(
        'flex items-center',
        sizeStyles.gap,
        className
      )}
      title={config.description}
      role="status"
      aria-label={`Connection status: ${config.label}`}
    >
      <span className="relative flex">
        {/* Pulse animation for active states */}
        {isActive && (
          <span
            className={clsx(
              'absolute inline-flex rounded-full opacity-75 animate-ping',
              sizeStyles.pulse,
              config.pulseColor
            )}
          />
        )}
        {/* Status dot */}
        <span
          className={clsx(
            'relative inline-flex rounded-full',
            sizeStyles.dot,
            config.color
          )}
        />
      </span>
      {showLabel && (
        <span className={clsx('text-surface-600', sizeStyles.text)}>
          {config.label}
        </span>
      )}
    </div>
  );
}

// Compact inline version for tight spaces
export interface ConnectionStatusBadgeProps {
  status: ConnectionStatusType;
  className?: string;
}

export function ConnectionStatusBadge({ status, className }: ConnectionStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        status === 'connected' && 'bg-success-50 text-success-700',
        status === 'connecting' && 'bg-warning-50 text-warning-700',
        status === 'disconnected' && 'bg-surface-100 text-surface-600',
        status === 'error' && 'bg-error-50 text-error-700',
        className
      )}
      role="status"
      aria-label={`Connection status: ${config.label}`}
    >
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full',
          config.color
        )}
      />
      {config.label}
    </div>
  );
}

export default ConnectionStatus;
