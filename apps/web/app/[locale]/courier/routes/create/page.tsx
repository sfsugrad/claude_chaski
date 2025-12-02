'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import { couriersAPI, RouteCreate } from '@/lib/api';
import { Button, Card, CardBody, Alert, Input } from '@/components/ui';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { RouteMap } from '@/components/map';
import CourierVerificationGuard from '@/components/CourierVerificationGuard';
import { kmToMiles, milesToKm } from '@/lib/distance';

// Values stored in km, displayed in miles
const deviationPresets = [
  { value: 1.6, label: '1 mi', description: 'Very close to route' },
  { value: 4.8, label: '3 mi', description: 'Slight detour' },
  { value: 8, label: '5 mi', description: 'Moderate detour' },
  { value: 16, label: '10 mi', description: 'Moderate detour' },
  { value: 32, label: '20 mi', description: 'Significant detour' },
];

function CreateRouteContent() {
  const router = useRouter();
  const [formData, setFormData] = useState<RouteCreate>({
    start_address: '',
    start_lat: 0,
    start_lng: 0,
    end_address: '',
    end_lat: 0,
    end_lng: 0,
    max_deviation_km: 5,
    departure_time: '',
    trip_date: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStartAddressChange = (address: string, lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      start_address: address,
      start_lat: lat,
      start_lng: lng,
    }));
  };

  const handleEndAddressChange = (address: string, lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      end_address: address,
      end_lat: lat,
      end_lng: lng,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.start_address || !formData.end_address) {
      setError('Please enter both start and end addresses');
      return;
    }

    if (formData.start_lat === 0 || formData.end_lat === 0) {
      setError('Please select addresses from the autocomplete suggestions');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        ...formData,
        departure_time: formData.departure_time || undefined,
        trip_date: formData.trip_date || undefined,
      };
      const response = await couriersAPI.createRoute(submitData);
      if (response.data) {
        router.push('/courier');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create route');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-success-50 to-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/courier"
            className="inline-flex items-center gap-2 text-success-600 hover:text-success-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-surface-900">Create New Route</h1>
          <p className="mt-2 text-surface-600">
            Enter your travel route to find packages along the way
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert variant="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Route Card */}
          <Card>
            <CardBody className="p-6">
              <h3 className="text-lg font-semibold text-surface-900 mb-4">Your Route</h3>

              {/* Visual Route Input */}
              <div className="space-y-0">
                <div className="flex">
                  {/* Left: markers and connector */}
                  <div className="flex flex-col items-center mr-4">
                    <div className="w-8 h-8 rounded-full bg-success-500 flex items-center justify-center text-white shadow-md">
                      <span className="text-sm font-bold">A</span>
                    </div>
                    <div className="w-0.5 h-12 bg-gradient-to-b from-success-500 to-primary-500 my-1" />
                    <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white shadow-md">
                      <span className="text-sm font-bold">B</span>
                    </div>
                  </div>

                  {/* Right: address inputs */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">
                        Starting Point <span className="text-error-500">*</span>
                      </label>
                      <AddressAutocomplete
                        id="start_address"
                        name="start_address"
                        value={formData.start_address}
                        onChange={handleStartAddressChange}
                        placeholder="Where are you leaving from?"
                        required
                        className="w-full px-4 py-2.5 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-success-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">
                        Destination <span className="text-error-500">*</span>
                      </label>
                      <AddressAutocomplete
                        id="end_address"
                        name="end_address"
                        value={formData.end_address}
                        onChange={handleEndAddressChange}
                        placeholder="Where are you going?"
                        required
                        className="w-full px-4 py-2.5 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Route Preview Map */}
          {(formData.start_lat !== 0 || formData.end_lat !== 0) && (
            <Card>
              <CardBody className="p-6">
                <h3 className="text-lg font-semibold text-surface-900 mb-4">Route Preview</h3>
                <RouteMap
                  pickup={
                    formData.start_lat !== 0
                      ? {
                          address: formData.start_address,
                          lat: formData.start_lat,
                          lng: formData.start_lng,
                          label: 'Start',
                        }
                      : undefined
                  }
                  dropoff={
                    formData.end_lat !== 0
                      ? {
                          address: formData.end_address,
                          lat: formData.end_lat,
                          lng: formData.end_lng,
                          label: 'End',
                        }
                      : undefined
                  }
                  height={300}
                  showRoute={formData.start_lat !== 0 && formData.end_lat !== 0}
                  showDeviationRadius={formData.start_lat !== 0 && formData.end_lat !== 0}
                  deviationKm={formData.max_deviation_km}
                />
              </CardBody>
            </Card>
          )}

          {/* Deviation Card */}
          <Card>
            <CardBody className="p-6">
              <h3 className="text-lg font-semibold text-surface-900 mb-2">Pickup Radius</h3>
              <p className="text-sm text-surface-500 mb-4">
                How far from your route are you willing to pick up packages?
              </p>

              {/* Visual Deviation Indicator */}
              <div className="mb-6 p-4 bg-surface-50 rounded-xl">
                <div className="flex items-center justify-center gap-4">
                  <div className="relative">
                    {/* Route line */}
                    <div className="w-32 h-1 bg-surface-300 rounded-full" />
                    {/* Deviation radius visualization */}
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-primary-400 rounded-full opacity-30 transition-all duration-300"
                      style={{
                        width: `${Math.min(formData.max_deviation_km * 6, 128)}px`,
                        height: `${Math.min(formData.max_deviation_km * 4, 80)}px`,
                      }}
                    />
                    {/* Center dot */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary-500 rounded-full" />
                  </div>
                </div>
                <p className="text-center text-sm text-surface-600 mt-3">
                  <span className="font-semibold text-primary-600">{kmToMiles(formData.max_deviation_km).toFixed(1)} mi</span> radius
                  around your route
                </p>
              </div>

              {/* Preset Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {deviationPresets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, max_deviation_km: preset.value }))}
                    className={clsx(
                      'p-3 rounded-lg border-2 transition-all text-left',
                      formData.max_deviation_km === preset.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-surface-200 hover:border-primary-300'
                    )}
                  >
                    <span
                      className={clsx(
                        'text-lg font-semibold',
                        formData.max_deviation_km === preset.value ? 'text-primary-700' : 'text-surface-900'
                      )}
                    >
                      {preset.label}
                    </span>
                    <span
                      className={clsx(
                        'block text-xs mt-0.5',
                        formData.max_deviation_km === preset.value ? 'text-primary-600' : 'text-surface-500'
                      )}
                    >
                      {preset.description}
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom slider */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">
                  Custom distance
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="0.5"
                    value={kmToMiles(formData.max_deviation_km)}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        max_deviation_km: milesToKm(parseFloat(e.target.value) || 3),
                      }))
                    }
                    className="flex-1 h-2 bg-surface-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                  <span className="w-16 text-center text-sm font-medium text-surface-700">
                    {kmToMiles(formData.max_deviation_km).toFixed(1)} mi
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Schedule Card */}
          <Card>
            <CardBody className="p-6">
              <h3 className="text-lg font-semibold text-surface-900 mb-2">When are you traveling?</h3>
              <p className="text-sm text-surface-500 mb-4">
                Set your trip date to help match with packages
              </p>

              <div className="space-y-4">
                {/* Trip Date */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    Trip Date <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.trip_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, trip_date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2.5 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Departure Time (optional) */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    Departure Time <span className="text-surface-400">(optional)</span>
                  </label>
                  <input
                    type="time"
                    value={formData.departure_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, departure_time: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-xs text-surface-500 mt-2">
                    Leave empty if your schedule is flexible
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Info Card */}
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-primary-900">What happens next?</h4>
                <p className="text-sm text-primary-700 mt-1">
                  Once you create your route, we'll show you packages that match your path. You can browse and
                  accept deliveries that work for you.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
            {loading ? 'Creating Route...' : 'Create Route & Find Packages'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function CreateRoutePage() {
  return (
    <CourierVerificationGuard>
      <CreateRouteContent />
    </CourierVerificationGuard>
  );
}
