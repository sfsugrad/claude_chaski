'use client'

import { useEffect, useRef, useCallback } from 'react'

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
  const isInitializedRef = useRef(false)
  const onChangeRef = useRef(onChange)
  // Track if we're processing a place selection to prevent race conditions
  const isSelectingPlaceRef = useRef(false)
  // Store the last valid coordinates to prevent them from being reset
  const lastValidCoordsRef = useRef<{ lat: number; lng: number } | null>(null)

  // Keep the ref updated with the latest callback
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

    // If no API key, component works as regular input
    if (!apiKey) {
      console.warn('Google Places API key not found. Autocomplete disabled.')
      return
    }

    // Don't reinitialize if autocomplete already exists
    if (isInitializedRef.current) return
    isInitializedRef.current = true

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

        // If getPlace() returns an object without geometry, it means the user
        // pressed enter or clicked away without selecting from the dropdown.
        if (!place.geometry || !place.geometry.location) {
          return
        }

        // Mark that we're selecting a place to prevent onChange handler from resetting
        isSelectingPlaceRef.current = true

        const address = place.formatted_address || ''
        const lat = place.geometry.location.lat()
        const lng = place.geometry.location.lng()

        // Store valid coordinates
        lastValidCoordsRef.current = { lat, lng }

        // Sync input value with the formatted address
        if (inputRef.current) {
          inputRef.current.value = address
        }

        onChangeRef.current(address, lat, lng)

        // Reset the flag after a short delay to allow the state update to complete
        setTimeout(() => {
          isSelectingPlaceRef.current = false
        }, 100)
      })
    }

    // Cleanup only on unmount
    return () => {
      if (autocompleteRef.current && window.google) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
        isInitializedRef.current = false
      }
    }
  }, [])

  // Sync input value when prop changes (for controlled behavior)
  useEffect(() => {
    // Only sync if we're not in the middle of a place selection
    if (inputRef.current && !isSelectingPlaceRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value
    }
  }, [value])

  // Handle manual input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // If we're in the middle of selecting a place, ignore this event
    if (isSelectingPlaceRef.current) {
      return
    }
    // User is typing - reset coordinates
    lastValidCoordsRef.current = null
    onChangeRef.current(e.target.value, 0, 0)
  }, [])

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      defaultValue={value}
      onChange={handleInputChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={className}
      autoComplete="off"
    />
  )
}
