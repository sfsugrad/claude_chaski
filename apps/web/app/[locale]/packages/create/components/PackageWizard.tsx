'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { PackageCreate, packagesAPI, authAPI, adminAPI, AdminUser, UserResponse } from '@/lib/api';
import { Button, Card, CardBody, Alert, Select } from '@/components/ui';
import { ProgressSteps } from '@/components/ui/Progress';
import { SizeSelector, PackageSize } from '@/components/logistics/SizeSelector';
import { LocationInput, LocationData, LocationDisplay, AddressDisplay } from '@/components/logistics/LocationInput';

type User = AdminUser;

interface WizardData extends PackageCreate {
  pickupData: LocationData;
  dropoffData: LocationData;
}

const STEPS = ['Package Details', 'Locations', 'Review'];

const weightPresets = [
  { label: '< 1 kg', value: 0.5 },
  { label: '1-2 kg', value: 1.5 },
  { label: '2-5 kg', value: 3 },
  { label: '5-10 kg', value: 7 },
  { label: '10-20 kg', value: 15 },
  { label: '> 20 kg', value: 25 },
];

export function PackageWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);

  const [formData, setFormData] = useState<WizardData>({
    description: '',
    size: 'small',
    weight_kg: 1,
    pickup_address: '',
    pickup_lat: 0,
    pickup_lng: 0,
    dropoff_address: '',
    dropoff_lat: 0,
    dropoff_lng: 0,
    pickup_contact_name: '',
    pickup_contact_phone: '',
    dropoff_contact_name: '',
    dropoff_contact_phone: '',
    price: undefined,
    sender_id: undefined,
    pickupData: { address: '', lat: 0, lng: 0, isValidated: false },
    dropoffData: { address: '', lat: 0, lng: 0, isValidated: false },
  });

  // Track if user has attempted to proceed (to show validation errors)
  const [showAddressValidation, setShowAddressValidation] = useState(false);

  useEffect(() => {
    checkAdminAndLoadUsers();
  }, []);

  const checkAdminAndLoadUsers = async () => {
    try {
      const response = await authAPI.getCurrentUser();
      const user = response.data;
      setCurrentUser(user);

      if (user.default_address && user.default_address_lat && user.default_address_lng) {
        // Pre-filled addresses from user profile are considered validated
        // since they have lat/lng coordinates from a previous Google Places selection
        setFormData((prev) => ({
          ...prev,
          pickup_address: user.default_address || '',
          pickup_lat: user.default_address_lat || 0,
          pickup_lng: user.default_address_lng || 0,
          pickupData: {
            address: user.default_address || '',
            lat: user.default_address_lat || 0,
            lng: user.default_address_lng || 0,
            isValidated: true,
          },
        }));
      }

      if (user.role === 'admin' || user.role === 'ADMIN') {
        setIsAdmin(true);
        await loadUsers();
      }
    } catch (err) {
      console.error('Error checking user role:', err);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await adminAPI.getUsers(0, 1000);
      setUsers(response.data.users);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSizeChange = (size: PackageSize) => {
    setFormData((prev) => ({ ...prev, size }));
  };

  const handleWeightPreset = (weight: number) => {
    setFormData((prev) => ({ ...prev, weight_kg: weight }));
  };

  const handlePickupChange = (data: LocationData) => {
    setFormData((prev) => ({
      ...prev,
      pickupData: data,
      pickup_address: data.address,
      pickup_lat: data.lat,
      pickup_lng: data.lng,
      pickup_contact_name: data.contactName || '',
      pickup_contact_phone: data.contactPhone || '',
    }));
  };

  const handleDropoffChange = (data: LocationData) => {
    setFormData((prev) => ({
      ...prev,
      dropoffData: data,
      dropoff_address: data.address,
      dropoff_lat: data.lat,
      dropoff_lng: data.lng,
      dropoff_contact_name: data.contactName || '',
      dropoff_contact_phone: data.contactPhone || '',
    }));
  };

  const validateStep = (step: number): boolean => {
    setError('');

    switch (step) {
      case 0: // Package Details
        if (!formData.description || formData.description.length < 1) {
          setError('Please provide a package description');
          return false;
        }
        if (formData.description.length > 500) {
          setError('Description must be less than 500 characters');
          return false;
        }
        if (formData.weight_kg <= 0 || formData.weight_kg > 1000) {
          setError('Weight must be between 0 and 1000 kg');
          return false;
        }
        if (formData.price !== undefined && formData.price < 0) {
          setError('Price must be a positive number');
          return false;
        }
        return true;

      case 1: // Locations
        if (!formData.pickup_address) {
          setError('Please provide a pickup address');
          return false;
        }
        if (!formData.dropoff_address) {
          setError('Please provide a dropoff address');
          return false;
        }
        // Check if addresses are validated by Google
        if (!formData.pickupData.isValidated) {
          setError('Please select a valid pickup address from the suggestions');
          setShowAddressValidation(true);
          return false;
        }
        if (!formData.dropoffData.isValidated) {
          setError('Please select a valid dropoff address from the suggestions');
          setShowAddressValidation(true);
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setError('');
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      const submitData: PackageCreate = {
        description: formData.description,
        size: formData.size,
        weight_kg: formData.weight_kg,
        pickup_address: formData.pickup_address,
        pickup_lat: formData.pickup_lat,
        pickup_lng: formData.pickup_lng,
        dropoff_address: formData.dropoff_address,
        dropoff_lat: formData.dropoff_lat,
        dropoff_lng: formData.dropoff_lng,
        pickup_contact_name: formData.pickup_contact_name || undefined,
        pickup_contact_phone: formData.pickup_contact_phone || undefined,
        dropoff_contact_name: formData.dropoff_contact_name || undefined,
        dropoff_contact_phone: formData.dropoff_contact_phone || undefined,
        price: formData.price,
        sender_id: formData.sender_id,
      };

      const response = await packagesAPI.create(submitData);

      if (response.data) {
        router.push('/dashboard');
      }
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to create package. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Progress */}
      <Card>
        <CardBody className="py-6">
          <ProgressSteps steps={STEPS} currentStep={currentStep} variant="primary" />
        </CardBody>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Step Content */}
      <Card>
        <CardBody className="p-6">
          {/* Step 1: Package Details */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-surface-900 mb-1">Package Details</h3>
                <p className="text-sm text-surface-500">Describe what you're sending</p>
              </div>

              {/* Admin: Select User */}
              {isAdmin && (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-primary-900 mb-2">
                    Create Package For User (Admin Only)
                  </label>
                  {loadingUsers ? (
                    <p className="text-sm text-primary-600">Loading users...</p>
                  ) : (
                    <Select
                      options={[
                        { value: '', label: 'Select a user (leave empty for yourself)' },
                        ...users
                          .filter(
                            (user) =>
                              user.role !== 'courier' &&
                              user.role !== 'COURIER' &&
                              user.role !== 'admin' &&
                              user.role !== 'ADMIN'
                          )
                          .map((user) => ({
                            value: String(user.id),
                            label: `${user.full_name} (${user.email}) - ${user.role}`,
                          })),
                      ]}
                      value={formData.sender_id ? String(formData.sender_id) : ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          sender_id: e.target.value ? parseInt(e.target.value) : undefined,
                        }))
                      }
                    />
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">
                  Description <span className="text-error-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="What are you sending? (e.g., Documents, clothes, electronics)"
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
                <p className="mt-1 text-xs text-surface-500">
                  {formData.description.length}/500 characters
                </p>
              </div>

              {/* Size Selector */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-3">
                  Package Size <span className="text-error-500">*</span>
                </label>
                <SizeSelector value={formData.size as PackageSize} onChange={handleSizeChange} />
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">
                  Weight <span className="text-error-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {weightPresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => handleWeightPreset(preset.value)}
                      className={clsx(
                        'px-3 py-1.5 text-sm rounded-full border transition-all',
                        formData.weight_kg === preset.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-surface-200 text-surface-600 hover:border-primary-300'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="1000"
                    value={formData.weight_kg}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, weight_kg: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-32 px-3 py-2 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <span className="text-surface-500">kg</span>
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">
                  Offered Price (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-surface-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        price: e.target.value ? parseFloat(e.target.value) : undefined,
                      }))
                    }
                    placeholder="0.00"
                    className="w-32 px-3 py-2 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <p className="mt-1 text-xs text-surface-500">
                  Leave empty to let couriers make offers
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Locations */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-surface-900 mb-1">Pickup & Dropoff</h3>
                <p className="text-sm text-surface-500">Where should we pick up and deliver your package?</p>
              </div>

              <LocationInput
                pickup={formData.pickupData}
                dropoff={formData.dropoffData}
                onPickupChange={handlePickupChange}
                onDropoffChange={handleDropoffChange}
                showContactFields
                showValidationErrors={showAddressValidation}
              />

              {currentUser?.default_address && (
                <p className="text-xs text-primary-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pickup address pre-filled from your default address
                </p>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-surface-900 mb-1">Review Your Package</h3>
                <p className="text-sm text-surface-500">Make sure everything looks correct before submitting</p>
              </div>

              {/* Package Summary */}
              <div className="bg-surface-50 rounded-xl p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-surface-900">Package Details</h4>
                    <p className="text-sm text-surface-600 mt-1">{formData.description}</p>
                  </div>
                  <button
                    onClick={() => setCurrentStep(0)}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    Edit
                  </button>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-200 text-surface-700 text-sm">
                    Size: {formData.size.replace('_', ' ')}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-200 text-surface-700 text-sm">
                    Weight: {formData.weight_kg} kg
                  </span>
                  {formData.price !== undefined && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-success-100 text-success-700 text-sm font-medium">
                      ${formData.price.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Route Summary */}
              <div className="bg-surface-50 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <h4 className="font-medium text-surface-900">Route</h4>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    Edit
                  </button>
                </div>

                <div className="space-y-3">
                  <AddressDisplay
                    label="Pickup"
                    address={formData.pickup_address}
                    type="pickup"
                  />
                  <AddressDisplay
                    label="Dropoff"
                    address={formData.dropoff_address}
                    type="dropoff"
                  />
                </div>

                {(formData.pickup_contact_name || formData.dropoff_contact_name) && (
                  <div className="mt-4 pt-4 border-t border-surface-200 grid grid-cols-2 gap-4">
                    {formData.pickup_contact_name && (
                      <div>
                        <p className="text-xs text-surface-500">Pickup Contact</p>
                        <p className="text-sm text-surface-900">{formData.pickup_contact_name}</p>
                        {formData.pickup_contact_phone && (
                          <p className="text-xs text-surface-500">{formData.pickup_contact_phone}</p>
                        )}
                      </div>
                    )}
                    {formData.dropoff_contact_name && (
                      <div>
                        <p className="text-xs text-surface-500">Dropoff Contact</p>
                        <p className="text-sm text-surface-900">{formData.dropoff_contact_name}</p>
                        {formData.dropoff_contact_phone && (
                          <p className="text-xs text-surface-500">{formData.dropoff_contact_phone}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
          className={clsx(currentStep === 0 && 'invisible')}
        >
          Back
        </Button>

        <div className="flex items-center gap-3">
          {currentStep < STEPS.length - 1 ? (
            <Button variant="primary" onClick={handleNext}>
              Continue
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSubmit} loading={loading}>
              {loading ? 'Creating Package...' : 'Create Package'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PackageWizard;
