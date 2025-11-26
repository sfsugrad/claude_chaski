'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { packagesAPI, PackageCreate } from '@/lib/api'
import AddressAutocomplete from '@/components/AddressAutocomplete'

export default function CreatePackagePage() {
  const router = useRouter()
  const [formData, setFormData] = useState<PackageCreate>({
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
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'weight_kg' || name === 'price'
        ? parseFloat(value) || 0
        : value,
    }))
  }

  // Handle pickup address selection from autocomplete
  const handlePickupAddressChange = (address: string, lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      pickup_address: address,
      pickup_lat: lat,
      pickup_lng: lng,
    }))
  }

  // Handle dropoff address selection from autocomplete
  const handleDropoffAddressChange = (address: string, lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      dropoff_address: address,
      dropoff_lat: lat,
      dropoff_lng: lng,
    }))
  }

  const validateForm = () => {
    if (!formData.description || formData.description.length < 1) {
      setError('Please provide a package description')
      return false
    }

    if (formData.description.length > 500) {
      setError('Description must be less than 500 characters')
      return false
    }

    if (formData.weight_kg <= 0 || formData.weight_kg > 1000) {
      setError('Weight must be between 0 and 1000 kg')
      return false
    }

    if (!formData.pickup_address) {
      setError('Please provide a pickup address')
      return false
    }

    if (!formData.dropoff_address) {
      setError('Please provide a dropoff address')
      return false
    }

    if (formData.price !== undefined && formData.price < 0) {
      setError('Price must be a positive number')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      // Remove empty optional fields
      const submitData: PackageCreate = {
        ...formData,
        pickup_contact_name: formData.pickup_contact_name || undefined,
        pickup_contact_phone: formData.pickup_contact_phone || undefined,
        dropoff_contact_name: formData.dropoff_contact_name || undefined,
        dropoff_contact_phone: formData.dropoff_contact_phone || undefined,
      }

      const response = await packagesAPI.create(submitData)

      if (response.data) {
        router.push('/dashboard')
      }
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail)
      } else {
        setError('Failed to create package. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2"
          >
            ← Back to Dashboard
          </Link>
          <h2 className="mt-4 text-3xl font-extrabold text-gray-900">
            Create Package Delivery
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter the details of your package and we'll match you with available couriers
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-8 rounded-lg shadow-md space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                {error}
              </div>
            )}

            {/* Package Details Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Package Details
              </h3>
              <div className="space-y-4">
                {/* Description */}
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Description *
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    required
                    rows={3}
                    value={formData.description}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="What are you sending? (e.g., Documents, clothes, electronics)"
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.description.length}/500 characters
                  </p>
                </div>

                {/* Size and Weight */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="size"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Package Size *
                    </label>
                    <select
                      id="size"
                      name="size"
                      value={formData.size}
                      onChange={handleChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="small">Small (Envelope, small box)</option>
                      <option value="medium">Medium (Shoebox size)</option>
                      <option value="large">Large (Suitcase size)</option>
                      <option value="extra_large">Extra Large (Multiple boxes)</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="weight_kg"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Weight (kg) *
                    </label>
                    <input
                      id="weight_kg"
                      name="weight_kg"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="1000"
                      required
                      value={formData.weight_kg}
                      onChange={handleChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Price */}
                <div>
                  <label
                    htmlFor="price"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Offered Price (Optional)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price || ''}
                      onChange={handleChange}
                      className="block w-full pl-7 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty to let couriers make offers
                  </p>
                </div>
              </div>
            </div>

            {/* Pickup Location Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Pickup Location
              </h3>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="pickup_address"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Pickup Address *
                  </label>
                  <AddressAutocomplete
                    id="pickup_address"
                    name="pickup_address"
                    value={formData.pickup_address}
                    onChange={handlePickupAddressChange}
                    placeholder="Start typing to search for pickup address..."
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
                      ? 'Select an address from the autocomplete suggestions. Coordinates will be set automatically.'
                      : 'Google Places API key not configured. Please enter a valid address.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="pickup_contact_name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Contact Name (Optional)
                    </label>
                    <input
                      id="pickup_contact_name"
                      name="pickup_contact_name"
                      type="text"
                      value={formData.pickup_contact_name}
                      onChange={handleChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pickup_contact_phone"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Contact Phone (Optional)
                    </label>
                    <input
                      id="pickup_contact_phone"
                      name="pickup_contact_phone"
                      type="tel"
                      value={formData.pickup_contact_phone}
                      onChange={handleChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+1234567890"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dropoff Location Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Dropoff Location
              </h3>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="dropoff_address"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Dropoff Address *
                  </label>
                  <AddressAutocomplete
                    id="dropoff_address"
                    name="dropoff_address"
                    value={formData.dropoff_address}
                    onChange={handleDropoffAddressChange}
                    placeholder="Start typing to search for dropoff address..."
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
                      ? 'Select an address from the autocomplete suggestions. Coordinates will be set automatically.'
                      : 'Google Places API key not configured. Please enter a valid address.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="dropoff_contact_name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Contact Name (Optional)
                    </label>
                    <input
                      id="dropoff_contact_name"
                      name="dropoff_contact_name"
                      type="text"
                      value={formData.dropoff_contact_name}
                      onChange={handleChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="dropoff_contact_phone"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Contact Phone (Optional)
                    </label>
                    <input
                      id="dropoff_contact_phone"
                      name="dropoff_contact_phone"
                      type="tel"
                      value={formData.dropoff_contact_phone}
                      onChange={handleChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+1234567890"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Package...' : 'Create Package'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
