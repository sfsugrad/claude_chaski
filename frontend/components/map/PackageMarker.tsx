'use client';

import { useState } from 'react';
import { Marker, InfoWindow } from '@react-google-maps/api';
import { clsx } from 'clsx';

export type PackageStatus = 'new' | 'open_for_bids' | 'bid_selected' | 'pending_pickup' | 'in_transit' | 'delivered' | 'canceled' | 'failed';

export interface PackageMarkerData {
  id: number;
  description: string;
  status: PackageStatus;
  size: string;
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  dropoff: {
    address: string;
    lat: number;
    lng: number;
  };
  price?: number;
}

export interface PackageMarkerProps {
  package: PackageMarkerData;
  type: 'pickup' | 'dropoff';
  onClick?: (pkg: PackageMarkerData) => void;
  showInfoWindow?: boolean;
  onInfoClose?: () => void;
}

// Status colors
const statusColors: Record<PackageStatus, string> = {
  new: '#9CA3AF',          // gray
  open_for_bids: '#F59E0B', // warning/amber
  bid_selected: '#3B82F6',  // primary/blue
  pending_pickup: '#8B5CF6', // violet
  in_transit: '#06B6D4',    // cyan
  delivered: '#10B981',     // success/green
  canceled: '#EF4444',      // error/red
  failed: '#F97316',        // orange
};

// Create custom marker SVG
const createPackageIcon = (status: PackageStatus, type: 'pickup' | 'dropoff') => {
  const color = statusColors[status];
  const isPickup = type === 'pickup';

  return {
    path: isPickup
      ? 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'
      : 'M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm4 8h-3v3h-2v-3H8V8h3V5h2v3h3v2z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1.5,
    anchor: { x: 12, y: 22 } as google.maps.Point,
  };
};

export function PackageMarker({
  package: pkg,
  type,
  onClick,
  showInfoWindow = false,
  onInfoClose,
}: PackageMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);

  const location = type === 'pickup' ? pkg.pickup : pkg.dropoff;
  const icon = createPackageIcon(pkg.status, type);

  const statusLabels: Record<PackageStatus, string> = {
    new: 'New',
    open_for_bids: 'Open for Bids',
    bid_selected: 'Bid Selected',
    pending_pickup: 'Pending Pickup',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    canceled: 'Canceled',
    failed: 'Failed',
  };

  return (
    <>
      <Marker
        position={{ lat: location.lat, lng: location.lng }}
        icon={icon}
        onClick={() => onClick?.(pkg)}
        onMouseOver={() => setIsHovered(true)}
        onMouseOut={() => setIsHovered(false)}
        animation={isHovered ? google.maps.Animation.BOUNCE : undefined}
      />

      {showInfoWindow && (
        <InfoWindow
          position={{ lat: location.lat, lng: location.lng }}
          onCloseClick={onInfoClose}
        >
          <div className="p-3 min-w-[200px] max-w-[280px]">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <span
                className={clsx(
                  'text-xs font-medium uppercase tracking-wider',
                  type === 'pickup' ? 'text-success-600' : 'text-primary-600'
                )}
              >
                {type === 'pickup' ? 'Pickup' : 'Dropoff'}
              </span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${statusColors[pkg.status]}20`,
                  color: statusColors[pkg.status],
                }}
              >
                {statusLabels[pkg.status]}
              </span>
            </div>

            {/* Package info */}
            <p className="text-sm font-medium text-surface-900 mb-1 line-clamp-2">
              {pkg.description}
            </p>
            <p className="text-xs text-surface-600 mb-2">{location.address}</p>

            {/* Details */}
            <div className="flex items-center gap-3 text-xs text-surface-500">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                {pkg.size}
              </span>
              {pkg.price && (
                <span className="flex items-center gap-1 text-success-600 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ${pkg.price}
                </span>
              )}
            </div>

            {/* View button */}
            {onClick && (
              <button
                onClick={() => onClick(pkg)}
                className="mt-3 w-full text-xs font-medium text-primary-600 hover:text-primary-700 py-1.5 border border-primary-200 rounded-md hover:bg-primary-50 transition-colors"
              >
                View Details
              </button>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

// Multiple package markers with clustering support
export interface PackageMarkersProps {
  packages: PackageMarkerData[];
  showType?: 'pickup' | 'dropoff' | 'both';
  onPackageClick?: (pkg: PackageMarkerData) => void;
  selectedPackageId?: number;
}

export function PackageMarkers({
  packages,
  showType = 'both',
  onPackageClick,
  selectedPackageId,
}: PackageMarkersProps) {
  const [selectedId, setSelectedId] = useState<number | null>(selectedPackageId || null);

  const handleMarkerClick = (pkg: PackageMarkerData) => {
    setSelectedId(pkg.id);
    onPackageClick?.(pkg);
  };

  const handleInfoClose = () => {
    setSelectedId(null);
  };

  return (
    <>
      {packages.map((pkg) => (
        <>
          {(showType === 'pickup' || showType === 'both') && (
            <PackageMarker
              key={`${pkg.id}-pickup`}
              package={pkg}
              type="pickup"
              onClick={handleMarkerClick}
              showInfoWindow={selectedId === pkg.id}
              onInfoClose={handleInfoClose}
            />
          )}
          {(showType === 'dropoff' || showType === 'both') && (
            <PackageMarker
              key={`${pkg.id}-dropoff`}
              package={pkg}
              type="dropoff"
              onClick={handleMarkerClick}
              showInfoWindow={selectedId === pkg.id}
              onInfoClose={handleInfoClose}
            />
          )}
        </>
      ))}
    </>
  );
}

export default PackageMarker;
