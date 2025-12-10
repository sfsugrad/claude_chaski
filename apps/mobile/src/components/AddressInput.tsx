import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Platform } from 'react-native'
import Constants from 'expo-constants'
import { useState, useCallback, useRef, useEffect } from 'react'

const GOOGLE_PLACES_API_KEY = Constants.expoConfig?.extra?.googlePlacesApiKey || ''

export interface AddressData {
  address: string
  lat: number
  lng: number
}

interface Prediction {
  place_id: string
  description: string
}

interface AddressInputProps {
  label: string
  placeholder?: string
  value?: AddressData
  onAddressSelect: (data: AddressData) => void
  required?: boolean
  type?: 'pickup' | 'dropoff'
}

// Load Google Maps script for web
const loadGoogleMapsScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'web') {
      resolve()
      return
    }

    if (typeof window !== 'undefined' && (window as any).google?.maps?.places) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
}

export function AddressInput({
  label,
  placeholder = 'Enter address',
  value,
  onAddressSelect,
  required = false,
  type = 'pickup',
}: AddressInputProps) {
  const [query, setQuery] = useState(value?.address || '')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [googleLoaded, setGoogleLoaded] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const autocompleteServiceRef = useRef<any>(null)
  const placesServiceRef = useRef<any>(null)
  const inputRef = useRef<any>(null)

  // Load Google Maps on web
  useEffect(() => {
    if (Platform.OS === 'web' && GOOGLE_PLACES_API_KEY) {
      loadGoogleMapsScript()
        .then(() => {
          setGoogleLoaded(true)
          if ((window as any).google?.maps?.places) {
            autocompleteServiceRef.current = new (window as any).google.maps.places.AutocompleteService()
            // Create a dummy div for PlacesService
            const dummyDiv = document.createElement('div')
            placesServiceRef.current = new (window as any).google.maps.places.PlacesService(dummyDiv)
          }
        })
        .catch((err) => console.error('Error loading Google Maps:', err))
    }
  }, [])

  const searchPlacesWeb = useCallback((text: string) => {
    if (!autocompleteServiceRef.current || text.length < 3) {
      setPredictions([])
      return
    }

    setLoading(true)
    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: text,
        types: ['address'],
        componentRestrictions: { country: 'us' },
      },
      (results: any[], status: string) => {
        setLoading(false)
        if (status === 'OK' && results) {
          setPredictions(
            results.slice(0, 5).map((r: any) => ({
              place_id: r.place_id,
              description: r.description,
            }))
          )
          setShowDropdown(true)
        } else {
          setPredictions([])
        }
      }
    )
  }, [])

  const searchPlacesNative = useCallback(async (text: string) => {
    if (!GOOGLE_PLACES_API_KEY || text.length < 3) {
      setPredictions([])
      return
    }

    setLoading(true)
    try {
      // For native, we can use the HTTP API directly
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&types=address&components=country:us&key=${GOOGLE_PLACES_API_KEY}`
      )
      const data = await response.json()
      if (data.predictions) {
        setPredictions(data.predictions.slice(0, 5))
        setShowDropdown(true)
      }
    } catch (error) {
      console.error('Error fetching places:', error)
      setPredictions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleTextChange = (text: string) => {
    setQuery(text)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      if (Platform.OS === 'web' && googleLoaded) {
        searchPlacesWeb(text)
      } else if (Platform.OS !== 'web') {
        searchPlacesNative(text)
      }
    }, 300)
  }

  const handleSelectPlaceWeb = (prediction: Prediction) => {
    setQuery(prediction.description)
    setShowDropdown(false)
    setPredictions([])

    if (!placesServiceRef.current) return

    placesServiceRef.current.getDetails(
      { placeId: prediction.place_id, fields: ['geometry'] },
      (place: any, status: string) => {
        if (status === 'OK' && place?.geometry?.location) {
          onAddressSelect({
            address: prediction.description,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          })
        }
      }
    )
  }

  const handleSelectPlaceNative = async (prediction: Prediction) => {
    setQuery(prediction.description)
    setShowDropdown(false)
    setPredictions([])

    if (!GOOGLE_PLACES_API_KEY) return

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry&key=${GOOGLE_PLACES_API_KEY}`
      )
      const data = await response.json()

      if (data.result?.geometry?.location) {
        onAddressSelect({
          address: prediction.description,
          lat: data.result.geometry.location.lat,
          lng: data.result.geometry.location.lng,
        })
      }
    } catch (error) {
      console.error('Error fetching place details:', error)
    }
  }

  const handleSelectPlace = (prediction: Prediction) => {
    if (Platform.OS === 'web') {
      handleSelectPlaceWeb(prediction)
    } else {
      handleSelectPlaceNative(prediction)
    }
  }

  // If no API key, show manual entry mode
  if (!GOOGLE_PLACES_API_KEY) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
        <TextInput
          style={[styles.input, type === 'pickup' ? styles.inputPickup : styles.inputDropoff]}
          value={query}
          onChangeText={(text) => {
            setQuery(text)
            onAddressSelect({
              address: text,
              lat: 34.0522,
              lng: -118.2437,
            })
          }}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.helperText}>
          Address autocomplete requires a Google Places API key
        </Text>
      </View>
    )
  }

  // Web: waiting for Google to load
  if (Platform.OS === 'web' && !googleLoaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
        <View style={[styles.input, styles.loadingInput]}>
          <ActivityIndicator size="small" color="#6b7280" />
          <Text style={styles.loadingText}>Loading address search...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>

      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={[styles.input, type === 'pickup' ? styles.inputPickup : styles.inputDropoff]}
          value={query}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          onBlur={() => {
            // Delay hiding to allow click on prediction
            setTimeout(() => setShowDropdown(false), 200)
          }}
        />
        {loading && (
          <ActivityIndicator size="small" color="#6b7280" style={styles.loader} />
        )}
      </View>

      {showDropdown && predictions.length > 0 && (
        <View style={styles.dropdown}>
          {predictions.map((item, index) => (
            <TouchableOpacity
              key={item.place_id}
              style={[
                styles.predictionItem,
                index < predictions.length - 1 && styles.predictionItemBorder,
              ]}
              onPress={() => handleSelectPlace(item)}
            >
              <View style={[styles.predictionDot, type === 'pickup' ? styles.pickupDot : styles.dropoffDot]} />
              <Text style={styles.predictionText} numberOfLines={2}>
                {item.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {value?.address && value.lat !== 0 && !showDropdown && (
        <View style={styles.selectedAddress}>
          <View style={[styles.addressDot, type === 'pickup' ? styles.pickupDot : styles.dropoffDot]} />
          <Text style={styles.selectedAddressText} numberOfLines={2}>
            {value.address}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    zIndex: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111',
  },
  inputPickup: {
    borderColor: '#3b82f6',
  },
  inputDropoff: {
    borderColor: '#22c55e',
  },
  loadingInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#d1d5db',
  },
  loadingText: {
    marginLeft: 8,
    color: '#6b7280',
    fontSize: 14,
  },
  loader: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  predictionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  predictionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  predictionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  helperText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  selectedAddress: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  addressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 8,
  },
  pickupDot: {
    backgroundColor: '#3b82f6',
  },
  dropoffDot: {
    backgroundColor: '#22c55e',
  },
  selectedAddressText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
  },
})

export default AddressInput
