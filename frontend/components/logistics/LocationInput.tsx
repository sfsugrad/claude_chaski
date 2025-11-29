'use client';

import React from 'react';
import { clsx } from 'clsx';
import AddressAutocomplete from '@/components/AddressAutocomplete';

export interface LocationData {
  address: string;
  lat: number;
  lng: number;
  contactName?: string;
  contactPhone?: string;
}

export interface LocationInputProps {
  pickup: LocationData;
  dropoff: LocationData;
  onPickupChange: (data: LocationData) => void;
  onDropoffChange: (data: LocationData) => void;
  showContactFields?: boolean;
  className?: string;
}

// Pickup marker icon (green)
const PickupIcon = () => (
  <div className="w-8 h-8 rounded-full bg-success-500 flex items-center justify-center text-white shadow-md">
    <span className="text-sm font-bold">A</span>
  </div>
);

// Dropoff marker icon (red/primary)
const DropoffIcon = () => (
  <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white shadow-md">
    <span className="text-sm font-bold">B</span>
  </div>
);

export function LocationInput({
  pickup,
  dropoff,
  onPickupChange,
  onDropoffChange,
  showContactFields = false,
  className,
}: LocationInputProps) {
  const handlePickupAddress = (address: string, lat: number, lng: number) => {
    onPickupChange({ ...pickup, address, lat, lng });
  };

  const handleDropoffAddress = (address: string, lat: number, lng: number) => {
    onDropoffChange({ ...dropoff, address, lat, lng });
  };

  return (
    <div className={clsx('space-y-0', className)}>
      {/* Visual route indicator */}
      <div className="flex">
        {/* Left side: markers and connector */}
        <div className="flex flex-col items-center mr-4">
          <PickupIcon />
          <div className="w-0.5 h-8 bg-gradient-to-b from-success-500 to-primary-500 my-1" />
          <DropoffIcon />
        </div>

        {/* Right side: address inputs */}
        <div className="flex-1 space-y-4">
          {/* Pickup */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Pickup Location
            </label>
            <AddressAutocomplete
              id="pickup_address"
              name="pickup_address"
              value={pickup.address}
              onChange={handlePickupAddress}
              placeholder="Enter pickup address..."
              required
              className="w-full px-3 py-2.5 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-success-500"
            />
          </div>

          {/* Dropoff */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Dropoff Location
            </label>
            <AddressAutocomplete
              id="dropoff_address"
              name="dropoff_address"
              value={dropoff.address}
              onChange={handleDropoffAddress}
              placeholder="Enter dropoff address..."
              required
              className="w-full px-3 py-2.5 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Contact fields (collapsible) */}
      {showContactFields && (
        <div className="mt-6 pt-6 border-t border-surface-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pickup Contact */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-surface-700 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-success-100 flex items-center justify-center text-success-600 text-xs font-bold">
                  A
                </span>
                Pickup Contact
              </h4>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Name (optional)</label>
                <input
                  type="text"
                  value={pickup.contactName || ''}
                  onChange={(e) => onPickupChange({ ...pickup, contactName: e.target.value })}
                  placeholder="Contact name"
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-success-500"
                />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Phone (optional)</label>
                <input
                  type="tel"
                  value={pickup.contactPhone || ''}
                  onChange={(e) => onPickupChange({ ...pickup, contactPhone: e.target.value })}
                  placeholder="+1 234 567 8900"
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-success-500"
                />
              </div>
            </div>

            {/* Dropoff Contact */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-surface-700 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xs font-bold">
                  B
                </span>
                Dropoff Contact
              </h4>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Name (optional)</label>
                <input
                  type="text"
                  value={dropoff.contactName || ''}
                  onChange={(e) => onDropoffChange({ ...dropoff, contactName: e.target.value })}
                  placeholder="Contact name"
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Phone (optional)</label>
                <input
                  type="tel"
                  value={dropoff.contactPhone || ''}
                  onChange={(e) => onDropoffChange({ ...dropoff, contactPhone: e.target.value })}
                  placeholder="+1 234 567 8900"
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact display version for showing route
export function LocationDisplay({
  pickup,
  dropoff,
  className,
}: {
  pickup: { address: string };
  dropoff: { address: string };
  className?: string;
}) {
  return (
    <div className={clsx('flex items-start gap-3', className)}>
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-success-500 flex items-center justify-center text-white text-xs font-bold">
          A
        </div>
        <div className="w-0.5 h-6 bg-gradient-to-b from-success-500 to-primary-500" />
        <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold">
          B
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-3">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Pickup</p>
          <p className="text-sm text-surface-900 truncate">{pickup.address || 'Not set'}</p>
        </div>
        <div>
          <p className="text-xs text-surface-500 uppercase tracking-wide">Dropoff</p>
          <p className="text-sm text-surface-900 truncate">{dropoff.address || 'Not set'}</p>
        </div>
      </div>
    </div>
  );
}

// Address display with copy button
export function AddressDisplay({
  label,
  address,
  type = 'default',
  className,
}: {
  label: string;
  address: string;
  type?: 'pickup' | 'dropoff' | 'default';
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const iconColor = type === 'pickup' ? 'text-success-500' : type === 'dropoff' ? 'text-primary-500' : 'text-surface-400';
  const bgColor = type === 'pickup' ? 'bg-success-50' : type === 'dropoff' ? 'bg-primary-50' : 'bg-surface-50';

  return (
    <div className={clsx('rounded-lg p-3', bgColor, className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <svg className={clsx('w-5 h-5 mt-0.5 flex-shrink-0', iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div className="min-w-0">
            <p className="text-xs text-surface-500 uppercase tracking-wide">{label}</p>
            <p className="text-sm text-surface-900 break-words">{address}</p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 p-1.5 rounded-md hover:bg-surface-200 transition-colors"
          title="Copy address"
        >
          {copied ? (
            <svg className="w-4 h-4 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default LocationInput;
