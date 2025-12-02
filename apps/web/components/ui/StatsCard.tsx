'use client';

import { clsx } from 'clsx';

export type StatsCardVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';

export interface StatsCardTrend {
  value: number;
  direction: 'up' | 'down';
  label?: string;
}

export interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: StatsCardTrend;
  variant?: StatsCardVariant;
  className?: string;
  description?: string;
}

const variantStyles: Record<StatsCardVariant, { bg: string; border: string; icon: string; accent: string }> = {
  default: {
    bg: 'bg-white',
    border: 'border-surface-200',
    icon: 'text-surface-500 bg-surface-100',
    accent: 'text-surface-900',
  },
  primary: {
    bg: 'bg-white',
    border: 'border-primary-200',
    icon: 'text-primary-600 bg-primary-100',
    accent: 'text-primary-600',
  },
  success: {
    bg: 'bg-white',
    border: 'border-success-200',
    icon: 'text-success-600 bg-success-100',
    accent: 'text-success-600',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-warning-200',
    icon: 'text-warning-600 bg-warning-100',
    accent: 'text-warning-600',
  },
  error: {
    bg: 'bg-white',
    border: 'border-error-200',
    icon: 'text-error-600 bg-error-100',
    accent: 'text-error-600',
  },
};

// Trend arrow icons
function TrendUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function TrendDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  );
}

export function StatsCard({
  label,
  value,
  icon,
  trend,
  variant = 'default',
  className,
  description,
}: StatsCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={clsx(
        'rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md',
        styles.bg,
        styles.border,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-500 truncate">{label}</p>
          <p className={clsx('mt-2 text-3xl font-bold tracking-tight', styles.accent)}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {description && (
            <p className="mt-1 text-sm text-surface-500">{description}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={clsx(
                  'inline-flex items-center gap-1 text-sm font-medium',
                  trend.direction === 'up' ? 'text-success-600' : 'text-error-600'
                )}
              >
                {trend.direction === 'up' ? (
                  <TrendUpIcon className="w-4 h-4" />
                ) : (
                  <TrendDownIcon className="w-4 h-4" />
                )}
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              {trend.label && (
                <span className="text-sm text-surface-500">{trend.label}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className={clsx('flex-shrink-0 p-3 rounded-lg', styles.icon)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// Compact variant for inline stats
export interface StatsCardInlineProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  variant?: StatsCardVariant;
  className?: string;
}

export function StatsCardInline({
  label,
  value,
  icon,
  variant = 'default',
  className,
}: StatsCardInlineProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-lg border p-3',
        styles.bg,
        styles.border,
        className
      )}
    >
      {icon && (
        <div className={clsx('flex-shrink-0 p-2 rounded-md', styles.icon)}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-surface-500 truncate">{label}</p>
        <p className={clsx('text-lg font-semibold', styles.accent)}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
    </div>
  );
}

// Stats grid helper
export interface StatsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatsGrid({ children, columns = 4, className }: StatsGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={clsx('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  );
}

export default StatsCard;
