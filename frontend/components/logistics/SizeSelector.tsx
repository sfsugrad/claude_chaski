'use client';

import React from 'react';
import { clsx } from 'clsx';

export type PackageSize = 'small' | 'medium' | 'large' | 'extra_large';

export interface SizeSelectorProps {
  value: PackageSize;
  onChange: (size: PackageSize) => void;
  className?: string;
}

interface SizeOption {
  value: PackageSize;
  label: string;
  description: string;
  dimensions: string;
  icon: React.ReactNode;
  weightHint: string;
}

const sizeOptions: SizeOption[] = [
  {
    value: 'small',
    label: 'Small',
    description: 'Envelope, small box',
    dimensions: 'Up to 30×20×10cm',
    weightHint: '< 2kg',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Shoebox size',
    dimensions: 'Up to 40×30×20cm',
    weightHint: '2-5kg',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    value: 'large',
    label: 'Large',
    description: 'Suitcase size',
    dimensions: 'Up to 60×40×40cm',
    weightHint: '5-15kg',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: 'extra_large',
    label: 'Extra Large',
    description: 'Multiple boxes',
    dimensions: 'Larger than 60cm',
    weightHint: '> 15kg',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
];

export function SizeSelector({ value, onChange, className }: SizeSelectorProps) {
  return (
    <div className={clsx('grid grid-cols-2 md:grid-cols-4 gap-3', className)}>
      {sizeOptions.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={clsx(
              'relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200',
              'hover:border-primary-300 hover:bg-primary-50/50',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
              isSelected
                ? 'border-primary-500 bg-primary-50 shadow-md'
                : 'border-surface-200 bg-white'
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2">
                <svg
                  className="w-5 h-5 text-primary-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}

            <div
              className={clsx(
                'p-3 rounded-full mb-3',
                isSelected ? 'bg-primary-100 text-primary-600' : 'bg-surface-100 text-surface-500'
              )}
            >
              {option.icon}
            </div>

            <h4
              className={clsx(
                'font-semibold text-sm',
                isSelected ? 'text-primary-700' : 'text-surface-900'
              )}
            >
              {option.label}
            </h4>

            <p className="text-xs text-surface-500 mt-1 text-center">{option.description}</p>

            <div className="mt-2 pt-2 border-t border-surface-100 w-full">
              <p className="text-xs text-surface-400 text-center">{option.dimensions}</p>
              <p className="text-xs text-surface-400 text-center">{option.weightHint}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Compact inline version for smaller spaces
export function SizeSelectorInline({
  value,
  onChange,
  className,
}: SizeSelectorProps) {
  return (
    <div className={clsx('flex flex-wrap gap-2', className)}>
      {sizeOptions.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              isSelected
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-surface-200 bg-white text-surface-600 hover:border-primary-300'
            )}
          >
            <span className={clsx('w-5 h-5', isSelected ? 'text-primary-500' : 'text-surface-400')}>
              {option.icon}
            </span>
            <span className="text-sm font-medium">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Display-only badge for showing size
export function SizeBadge({
  size,
  className,
}: {
  size: PackageSize;
  className?: string;
}) {
  const option = sizeOptions.find((o) => o.value === size);
  if (!option) return null;

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-100 text-surface-700',
        className
      )}
    >
      <span className="w-4 h-4 text-surface-500">{option.icon}</span>
      <span className="text-sm font-medium">{option.label}</span>
    </div>
  );
}

export default SizeSelector;
