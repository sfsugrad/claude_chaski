'use client';

import { useCallback, useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { clsx } from 'clsx';

const libraries: ('places' | 'geometry' | 'drawing' | 'visualization')[] = ['places', 'geometry'];

// Default map styles for a cleaner look
const defaultMapStyles = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
];

export interface MapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string | number;
  className?: string;
  children?: React.ReactNode;
  onLoad?: (map: google.maps.Map) => void;
  onClick?: (e: google.maps.MapMouseEvent) => void;
  options?: google.maps.MapOptions;
  showControls?: boolean;
}

const defaultCenter = { lat: 40.7128, lng: -74.006 }; // NYC as default

export function Map({
  center = defaultCenter,
  zoom = 12,
  height = 400,
  className,
  children,
  onLoad,
  onClick,
  options,
  showControls = true,
}: MapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || '',
    libraries,
  });

  const handleLoad = useCallback(
    (map: google.maps.Map) => {
      setMap(map);
      onLoad?.(map);
    },
    [onLoad]
  );

  const handleUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const containerStyle = {
    width: '100%',
    height: typeof height === 'number' ? `${height}px` : height,
  };

  const defaultOptions: google.maps.MapOptions = {
    disableDefaultUI: !showControls,
    zoomControl: showControls,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: showControls,
    styles: defaultMapStyles,
    ...options,
  };

  if (loadError) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center bg-surface-100 rounded-xl border border-surface-200',
          className
        )}
        style={containerStyle}
      >
        <div className="text-center p-6">
          <svg
            className="w-12 h-12 text-surface-400 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-surface-600">Failed to load map</p>
          <p className="text-xs text-surface-500 mt-1">Please check your API key</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center bg-surface-100 rounded-xl border border-surface-200 animate-pulse',
          className
        )}
        style={containerStyle}
      >
        <div className="text-center">
          <svg
            className="w-10 h-10 text-surface-400 mx-auto mb-2 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-surface-500">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('rounded-xl overflow-hidden border border-surface-200', className)}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        onLoad={handleLoad}
        onUnmount={handleUnmount}
        onClick={onClick}
        options={defaultOptions}
      >
        {children}
      </GoogleMap>
    </div>
  );
}

// Map placeholder for when API key is not configured
export function MapPlaceholder({
  height = 400,
  className,
  message = 'Map preview coming soon',
}: {
  height?: string | number;
  className?: string;
  message?: string;
}) {
  const containerStyle = {
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={clsx(
        'flex items-center justify-center bg-gradient-to-br from-surface-100 to-surface-200 rounded-xl border border-surface-200',
        className
      )}
      style={containerStyle}
    >
      <div className="text-center p-6">
        <svg
          className="w-16 h-16 text-surface-400 mx-auto mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        <p className="text-sm font-medium text-surface-600">{message}</p>
        <p className="text-xs text-surface-500 mt-1">Configure Google Maps API key to enable</p>
      </div>
    </div>
  );
}

export default Map;
