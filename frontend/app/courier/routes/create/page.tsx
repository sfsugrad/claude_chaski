'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { couriersAPI, RouteCreate } from '@/lib/api'
import AddressAutocomplete from '@/components/AddressAutocomplete'

export default function CreateRoutePage() {
  const router = useRouter()
  const [formData, setFormData] = useState<RouteCreate>({
    start_address: '',
    start_lat: 0,
    start_lng: 0,
    end_address: '',
    end_lat: 0,
    end_lng: 0,
    max_deviation_km: 5,
    departure_time: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleStartAddressChange = (address: string, lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      start_address: address,
      start_lat: lat,
      start_lng: lng,
    }))
  }

  const handleEndAddressChange = (address: string, lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      end_address: address,
      end_lat: lat,
      end_lng: lng,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.start_address || !formData.end_address) {
      setError('Please enter both start and end addresses')
      return
    }

    if (formData.start_lat === 0 || formData.end_lat === 0) {
      setError('Please select addresses from the autocomplete suggestions')
      return
    }

    setLoading(true)

    try {
      const submitData = {
        ...formData,
        departure_time: formData.departure_time || undefined
      }
      const response = await couriersAPI.createRoute(submitData)
      if (response.data) {
        router.push('/courier')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create route')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/courier"
            className="text-green-600 hover:text-green-700 flex items-center gap-2"
          >
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold mt-4">Create New Route</h1>
          <p className="text-gray-600 mt-2">
            Enter your travel route to find packages along the way
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Start Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Address *
            </label>
            <AddressAutocomplete
              value={formData.start_address}
              onChange={handleStartAddressChange}
              placeholder="Enter your starting point..."
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* End Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destination Address *
            </label>
            <AddressAutocomplete
              value={formData.end_address}
              onChange={handleEndAddressChange}
              placeholder="Enter your destination..."
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Max Deviation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Deviation (km)
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={formData.max_deviation_km}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                max_deviation_km: parseInt(e.target.value) || 5
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              How far are you willing to deviate from your route? (1-50 km)
            </p>
          </div>

          {/* Departure Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Departure Time (Optional)
            </label>
            <input
              type="datetime-local"
              value={formData.departure_time}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                departure_time: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? 'Creating Route...' : 'Create Route & Find Packages'}
          </button>
        </form>
      </div>
    </div>
  )
}
