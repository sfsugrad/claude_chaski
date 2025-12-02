'use client';

import { useEffect, useState, useCallback } from 'react';
import { Marker, Polyline, InfoWindow, Circle } from '@react-google-maps/api';
import { clsx } from 'clsx';
import { Map, MapPlaceholder } from './Map';

export interface Location {
  address: string;
  lat: number;
  lng: number;
  label?: string;
}

export interface RouteMapProps {
  pickup?: Location;
  dropoff?: Location;
  height?: string | number;
  className?: string;
  showRoute?: boolean;
  showDeviationRadius?: boolean;
  deviationKm?: number;
  onPickupClick?: () => void;
  onDropoffClick?: () => void;
  interactive?: boolean;
}

// Custom marker icons matching our A/B design
const createMarkerIcon = (label: string, color: string) => ({
  path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
  fillColor: color,
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2,
  scale: 1.8,
  anchor: { x: 12, y: 22 } as google.maps.Point,
  labelOrigin: { x: 12, y: 9 } as google.maps.Point,
});

export function RouteMap({
  pickup,
  dropoff,
  height = 400,
  className,
  showRoute = true,
  showDeviationRadius = false,
  deviationKm = 5,
  onPickupClick,
  onDropoffClick,
  interactive = true,
}: RouteMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<'pickup' | 'dropoff' | null>(null);
  const [routePath, setRoutePath] = useState<google.maps.LatLng[]>([]);

  // Check if we have a valid API key
  const hasApiKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY);

  // Calculate bounds to fit both markers
  const fitBounds = useCallback(() => {
    if (!map || (!pickup && !dropoff)) return;

    const bounds = new google.maps.LatLngBounds();
    if (pickup) bounds.extend({ lat: pickup.lat, lng: pickup.lng });
    if (dropoff) bounds.extend({ lat: dropoff.lat, lng: dropoff.lng });

    // Add padding
    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

    // Don't zoom too far in for single points
    const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
      const currentZoom = map.getZoom();
      if (currentZoom && currentZoom > 15) {
        map.setZoom(15);
      }
    });

    return () => google.maps.event.removeListener(listener);
  }, [map, pickup, dropoff]);

  // Fetch directions for route line
  useEffect(() => {
    if (!showRoute || !pickup || !dropoff || !map) {
      setRoutePath([]);
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: dropoff.lat, lng: dropoff.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const path = result.routes[0].overview_path;
          setRoutePath(path);
        }
      }
    );
  }, [pickup, dropoff, showRoute, map]);

  // Fit bounds when markers change
  useEffect(() => {
    fitBounds();
  }, [fitBounds]);

  const handleMapLoad = useCallback((loadedMap: google.maps.Map) => {
    setMap(loadedMap);
  }, []);

  // Calculate center point
  const center = pickup && dropoff
    ? {
        lat: (pickup.lat + dropoff.lat) / 2,
        lng: (pickup.lng + dropoff.lng) / 2,
      }
    : pickup
    ? { lat: pickup.lat, lng: pickup.lng }
    : dropoff
    ? { lat: dropoff.lat, lng: dropoff.lng }
    : { lat: 40.7128, lng: -74.006 };

  if (!hasApiKey) {
    return (
      <MapPlaceholder
        height={height}
        className={className}
        message={pickup || dropoff ? 'Route preview' : 'Map preview coming soon'}
      />
    );
  }

  return (
    <Map
      center={center}
      zoom={12}
      height={height}
      className={className}
      onLoad={handleMapLoad}
    >
      {/* Route line */}
      {showRoute && routePath.length > 0 && (
        <Polyline
          path={routePath}
          options={{
            strokeColor: '#3B82F6',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            geodesic: true,
          }}
        />
      )}

      {/* Deviation radius circles */}
      {showDeviationRadius && routePath.length > 0 && (
        <>
          {/* Show circles along the route */}
          {routePath
            .filter((_, i) => i % Math.ceil(routePath.length / 5) === 0)
            .map((point, index) => (
              <Circle
                key={index}
                center={{ lat: point.lat(), lng: point.lng() }}
                radius={deviationKm * 1000}
                options={{
                  strokeColor: '#3B82F6',
                  strokeOpacity: 0.3,
                  strokeWeight: 1,
                  fillColor: '#3B82F6',
                  fillOpacity: 0.05,
                }}
              />
            ))}
        </>
      )}

      {/* Pickup marker (A - Green) */}
      {pickup && (
        <Marker
          position={{ lat: pickup.lat, lng: pickup.lng }}
          icon={createMarkerIcon('A', '#10B981')}
          label={{
            text: 'A',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
          onClick={() => {
            if (interactive) {
              setSelectedMarker('pickup');
              onPickupClick?.();
            }
          }}
        />
      )}

      {/* Dropoff marker (B - Blue) */}
      {dropoff && (
        <Marker
          position={{ lat: dropoff.lat, lng: dropoff.lng }}
          icon={createMarkerIcon('B', '#3B82F6')}
          label={{
            text: 'B',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
          onClick={() => {
            if (interactive) {
              setSelectedMarker('dropoff');
              onDropoffClick?.();
            }
          }}
        />
      )}

      {/* Info windows */}
      {selectedMarker === 'pickup' && pickup && (
        <InfoWindow
          position={{ lat: pickup.lat, lng: pickup.lng }}
          onCloseClick={() => setSelectedMarker(null)}
        >
          <div className="p-2 min-w-[150px]">
            <p className="text-xs font-medium text-success-600 uppercase tracking-wider mb-1">
              Pickup
            </p>
            <p className="text-sm text-surface-900">{pickup.address}</p>
          </div>
        </InfoWindow>
      )}

      {selectedMarker === 'dropoff' && dropoff && (
        <InfoWindow
          position={{ lat: dropoff.lat, lng: dropoff.lng }}
          onCloseClick={() => setSelectedMarker(null)}
        >
          <div className="p-2 min-w-[150px]">
            <p className="text-xs font-medium text-primary-600 uppercase tracking-wider mb-1">
              Dropoff
            </p>
            <p className="text-sm text-surface-900">{dropoff.address}</p>
          </div>
        </InfoWindow>
      )}
    </Map>
  );
}

// Simple static map preview (no interactivity needed)
export function RouteMapStatic({
  pickup,
  dropoff,
  height = 200,
  className,
}: {
  pickup?: Location;
  dropoff?: Location;
  height?: number;
  className?: string;
}) {
  // Generate static map URL
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  const hasApiKey = Boolean(apiKey);

  if (!hasApiKey || (!pickup && !dropoff)) {
    return (
      <MapPlaceholder
        height={height}
        className={className}
        message="Route preview"
      />
    );
  }

  // Create markers for static map
  const markers: string[] = [];
  if (pickup) {
    markers.push(`markers=color:green%7Clabel:A%7C${pickup.lat},${pickup.lng}`);
  }
  if (dropoff) {
    markers.push(`markers=color:blue%7Clabel:B%7C${dropoff.lat},${dropoff.lng}`);
  }

  // Path between points
  const path = pickup && dropoff
    ? `&path=color:0x3B82F6%7Cweight:4%7C${pickup.lat},${pickup.lng}%7C${dropoff.lat},${dropoff.lng}`
    : '';

  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=600x${height}&maptype=roadmap&${markers.join('&')}${path}&key=${apiKey}`;

  return (
    <div
      className={clsx('rounded-xl overflow-hidden border border-surface-200', className)}
      style={{ height }}
    >
      <img
        src={staticMapUrl}
        alt="Route map"
        className="w-full h-full object-cover"
      />
    </div>
  );
}

export default RouteMap;
