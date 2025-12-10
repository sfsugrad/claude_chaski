'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

interface AddressAutocompleteProps {
  id: string
  name: string
  value: string
  onChange: (address: string, lat: number, lng: number, isValidated?: boolean) => void
  onValidationChange?: (isValid: boolean) => void
  placeholder?: string
  required?: boolean
  className?: string
  disabled?: boolean
  showValidationError?: boolean
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
  onValidationChange,
  placeholder = 'Enter address',
  required = false,
  className = '',
  disabled = false,
  showValidationError = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const isInitializedRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const onValidationChangeRef = useRef(onValidationChange)
  // Track if we're processing a place selection to prevent race conditions
  const isSelectingPlaceRef = useRef(false)
  // Store the last valid coordinates to prevent them from being reset
  const lastValidCoordsRef = useRef<{ lat: number; lng: number } | null>(null)
  // Track if the address has been validated by Google
  const [isValidated, setIsValidated] = useState(false)
  // Track suggestions for display
  const [suggestions, setSuggestions] = useState<Array<{ description: string; place_id: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  // Track if user has interacted (to avoid showing errors immediately)
  const [hasBlurred, setHasBlurred] = useState(false)

  // Keep the refs updated with the latest callbacks
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onValidationChangeRef.current = onValidationChange
  }, [onValidationChange])

  // Notify parent of validation state changes
  useEffect(() => {
    onValidationChangeRef.current?.(isValidated)
  }, [isValidated])

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

        // Mark as validated since user selected from Google suggestions
        setIsValidated(true)
        setSuggestions([])
        setShowSuggestions(false)

        // Sync input value with the formatted address
        if (inputRef.current) {
          inputRef.current.value = address
        }

        onChangeRef.current(address, lat, lng, true)

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
    // User is typing - reset coordinates and validation
    lastValidCoordsRef.current = null
    setIsValidated(false)
    onChangeRef.current(e.target.value, 0, 0, false)
  }, [])

  // Handle blur - show error if address not validated
  const handleBlur = useCallback(() => {
    setHasBlurred(true)
    // Hide suggestions after a short delay to allow clicking on them
    setTimeout(() => {
      setShowSuggestions(false)
    }, 200)
  }, [])

  // Handle focus
  const handleFocus = useCallback(() => {
    if (suggestions.length > 0 && !isValidated) {
      setShowSuggestions(true)
    }
  }, [suggestions.length, isValidated])

  // Determine if we should show the error state
  const shouldShowError = showValidationError && hasBlurred && !isValidated && value.length > 0

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        defaultValue={value}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`${className} ${shouldShowError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
        autoComplete="off"
      />
      {shouldShowError && (
        <div className="mt-1">
          <p className="text-sm text-red-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Please select a valid address from the suggestions
          </p>
        </div>
      )}
      {isValidated && value.length > 0 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  )
}
