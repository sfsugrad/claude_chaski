'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className,
}: SkeletonProps) {
  const baseClasses = 'bg-surface-200 animate-pulse';

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={clsx(baseClasses, variantClasses[variant], className)}
      style={style}
      aria-hidden="true"
    />
  );
}

// Preset components for common use cases
export function SkeletonText({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 && lines > 1 ? '75%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonTitle({ className }: { className?: string }) {
  return <Skeleton variant="text" height={24} className={className} />;
}

export function SkeletonAvatar({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeMap = { sm: 32, md: 40, lg: 48 };
  return (
    <Skeleton
      variant="circular"
      width={sizeMap[size]}
      height={sizeMap[size]}
      className={className}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx('bg-white rounded-xl border border-surface-200 p-6', className)}>
      <div className="flex items-start gap-4">
        <SkeletonAvatar />
        <div className="flex-1 space-y-3">
          <SkeletonTitle />
          <SkeletonText lines={2} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonButton({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const heightMap = { sm: 32, md: 40, lg: 48 };
  return (
    <Skeleton
      variant="rounded"
      width={100}
      height={heightMap[size]}
      className={className}
    />
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={clsx('space-y-3', className)}>
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-surface-200">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="text" height={16} className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Attach preset components
Skeleton.Text = SkeletonText;
Skeleton.Title = SkeletonTitle;
Skeleton.Avatar = SkeletonAvatar;
Skeleton.Card = SkeletonCard;
Skeleton.Button = SkeletonButton;
Skeleton.Table = SkeletonTable;

export default Skeleton;
