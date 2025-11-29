'use client';

import React, { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
}

const variantClasses: Record<AlertVariant, string> = {
  success: 'bg-success-50 text-success-800 border-success-200',
  warning: 'bg-warning-50 text-warning-800 border-warning-200',
  error: 'bg-error-50 text-error-800 border-error-200',
  info: 'bg-info-50 text-info-800 border-info-200',
};

const iconColors: Record<AlertVariant, string> = {
  success: 'text-success-500',
  warning: 'text-warning-500',
  error: 'text-error-500',
  info: 'text-info-500',
};

const DefaultIcon = ({ variant }: { variant: AlertVariant }) => {
  const iconClass = clsx('h-5 w-5', iconColors[variant]);

  switch (variant) {
    case 'success':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'warning':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'error':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = 'info',
      title,
      dismissible = false,
      onDismiss,
      icon,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role="alert"
        className={clsx(
          'flex items-start gap-3',
          'p-4 rounded-lg border',
          'text-sm',
          variantClasses[variant],
          className
        )}
        {...props}
      >
        <span className="flex-shrink-0">
          {icon || <DefaultIcon variant={variant} />}
        </span>
        <div className="flex-1 min-w-0">
          {title && <p className="font-medium mb-1">{title}</p>}
          <div className={title ? 'opacity-90' : ''}>{children}</div>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 -mr-1 -mt-1 p-1 rounded hover:bg-black/10 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export default Alert;
