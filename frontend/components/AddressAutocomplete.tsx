'use client'

import { useEffect, useRef } from 'react'

interface AddressAutocompleteProps {
  id: string
  name: string
  value: string
  onChange: (address: string, lat: number, lng: number) => void
  placeholder?: string
  required?: boolean
  className?: string
  disabled?: boolean
}

declare global {
  interface Window {
    google: any
    initGooglePlaces?: () => void
  }
}

export default function AddressAutocomplete({
  id,
  name,
  value,
  onChange,
  placeholder = 'Enter address',
  required = false,
  className = '',
  disabled = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

    // If no API key, component works as regular input
    if (!apiKey) {
      console.warn('Google Places API key not found. Autocomplete disabled.')
      return
    }

    // Load Google Places API script if not already loaded
    if (!window.google) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
      script.async = true
      script.defer = true
      script.onload = initAutocomplete
      document.head.appendChild(script)
    } else {
      initAutocomplete()
    }

    function initAutocomplete() {
      if (!inputRef.current || !window.google) return

      // Create autocomplete instance
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ['address'],
          fields: ['formatted_address', 'geometry', 'address_components'],
        }
      )

      // Listen for place selection
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace()

        if (!place.geometry || !place.geometry.location) {
          console.error('No geometry data for selected place')
          return
        }

        const address = place.formatted_address || ''
        const lat = place.geometry.location.lat()
        const lng = place.geometry.location.lng()

        onChange(address, lat, lng)
      })
    }

    // Cleanup
    return () => {
      if (autocompleteRef.current && window.google) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [onChange])

  // Handle manual input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // If user types manually, we don't have coordinates yet
    // The parent component should handle this case
    onChange(e.target.value, 0, 0)
  }

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      value={value}
      onChange={handleInputChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={className}
      autoComplete="off"
    />
  )
}
