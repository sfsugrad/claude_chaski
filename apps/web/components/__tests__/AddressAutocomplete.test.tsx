import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AddressAutocomplete from '../AddressAutocomplete'

// Mock environment variables
const mockEnv = (apiKey: string | undefined) => {
  const original = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
  if (apiKey) {
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY = apiKey
  } else {
    delete process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
  }
  return () => {
    if (original) {
      process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY = original
    } else {
      delete process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
    }
  }
}

// Mock Google Maps API
const mockGoogleMapsAPI = () => {
  const mockAutocomplete = {
    addListener: jest.fn(),
    getPlace: jest.fn(),
  }

  const mockPlaces = {
    Autocomplete: jest.fn(() => mockAutocomplete),
  }

  const mockMaps = {
    places: mockPlaces,
    event: {
      clearInstanceListeners: jest.fn(),
    },
  }

  ;(window as any).google = {
    maps: mockMaps,
  }

  return { mockAutocomplete, mockPlaces, mockMaps }
}

describe('AddressAutocomplete', () => {
  const defaultProps = {
    id: 'test-address',
    name: 'test_address',
    value: '',
    onChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    delete (window as any).google
  })

  describe('Component Rendering', () => {
    it('renders input field with correct props', () => {
      const restoreEnv = mockEnv(undefined)
      render(<AddressAutocomplete {...defaultProps} />)

      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('id', 'test-address')
      expect(input).toHaveAttribute('name', 'test_address')

      restoreEnv()
    })

    it('renders with placeholder text', () => {
      const restoreEnv = mockEnv(undefined)
      render(
        <AddressAutocomplete
          {...defaultProps}
          placeholder="Enter your address"
        />
      )

      const input = screen.getByPlaceholderText('Enter your address')
      expect(input).toBeInTheDocument()

      restoreEnv()
    })

    it('renders with required attribute when specified', () => {
      const restoreEnv = mockEnv(undefined)
      render(<AddressAutocomplete {...defaultProps} required />)

      const input = screen.getByRole('textbox')
      expect(input).toBeRequired()

      restoreEnv()
    })

    it('renders as disabled when disabled prop is true', () => {
      const restoreEnv = mockEnv(undefined)
      render(<AddressAutocomplete {...defaultProps} disabled />)

      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()

      restoreEnv()
    })

    it('applies custom className', () => {
      const restoreEnv = mockEnv(undefined)
      render(
        <AddressAutocomplete
          {...defaultProps}
          className="custom-class"
        />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-class')

      restoreEnv()
    })
  })

  describe('Without Google Places API Key', () => {
    it('works as regular input when API key is not configured', () => {
      const restoreEnv = mockEnv(undefined)
      const onChange = jest.fn()

      render(<AddressAutocomplete {...defaultProps} onChange={onChange} />)

      const input = screen.getByRole('textbox') as HTMLInputElement
      fireEvent.change(input, { target: { value: '123 Main St' } })

      expect(onChange).toHaveBeenCalledWith('123 Main St', 0, 0)

      restoreEnv()
    })

    it('logs warning when API key is missing', () => {
      const restoreEnv = mockEnv(undefined)
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      render(<AddressAutocomplete {...defaultProps} />)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Google Places API key not found. Autocomplete disabled.'
      )

      consoleSpy.mockRestore()
      restoreEnv()
    })
  })

  describe('With Google Places API Key', () => {
    it('loads Google Maps API script when not already loaded', () => {
      const restoreEnv = mockEnv('test-api-key')

      render(<AddressAutocomplete {...defaultProps} />)

      const scripts = document.querySelectorAll('script')
      const mapsScript = Array.from(scripts).find((script) =>
        script.src.includes('maps.googleapis.com')
      )

      expect(mapsScript).toBeTruthy()
      expect(mapsScript?.src).toContain('key=test-api-key')
      expect(mapsScript?.src).toContain('libraries=places')

      restoreEnv()
    })

    it('initializes autocomplete when Google API is already loaded', () => {
      const restoreEnv = mockEnv('test-api-key')
      const { mockAutocomplete, mockPlaces } = mockGoogleMapsAPI()

      render(<AddressAutocomplete {...defaultProps} />)

      expect(mockPlaces.Autocomplete).toHaveBeenCalled()
      expect(mockAutocomplete.addListener).toHaveBeenCalledWith(
        'place_changed',
        expect.any(Function)
      )

      restoreEnv()
    })

    it('calls onChange with address and coordinates when place is selected', () => {
      const restoreEnv = mockEnv('test-api-key')
      const { mockAutocomplete } = mockGoogleMapsAPI()
      const onChange = jest.fn()

      render(<AddressAutocomplete {...defaultProps} onChange={onChange} />)

      // Simulate place selection
      const mockPlace = {
        formatted_address: '123 Main St, New York, NY 10001',
        geometry: {
          location: {
            lat: () => 40.7128,
            lng: () => -74.0060,
          },
        },
      }

      mockAutocomplete.getPlace.mockReturnValue(mockPlace)

      // Get the place_changed callback and call it
      const placeChangedCallback = mockAutocomplete.addListener.mock.calls[0][1]
      placeChangedCallback()

      expect(onChange).toHaveBeenCalledWith(
        '123 Main St, New York, NY 10001',
        40.7128,
        -74.0060
      )

      restoreEnv()
    })

    it('handles place selection without geometry data', () => {
      const restoreEnv = mockEnv('test-api-key')
      const { mockAutocomplete } = mockGoogleMapsAPI()
      const onChange = jest.fn()
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      render(<AddressAutocomplete {...defaultProps} onChange={onChange} />)

      // Simulate place selection without geometry
      mockAutocomplete.getPlace.mockReturnValue({
        formatted_address: '123 Main St',
      })

      const placeChangedCallback = mockAutocomplete.addListener.mock.calls[0][1]
      placeChangedCallback()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'No geometry data for selected place'
      )
      expect(onChange).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      restoreEnv()
    })
  })

  describe('Manual Input Handling', () => {
    it('calls onChange with input value and zero coordinates on manual input', () => {
      const restoreEnv = mockEnv('test-api-key')
      const onChange = jest.fn()

      render(<AddressAutocomplete {...defaultProps} onChange={onChange} />)

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'Manual address' } })

      expect(onChange).toHaveBeenCalledWith('Manual address', 0, 0)

      restoreEnv()
    })

    it('updates input value when value prop changes', () => {
      const restoreEnv = mockEnv(undefined)
      const { rerender } = render(
        <AddressAutocomplete {...defaultProps} value="" />
      )

      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.value).toBe('')

      rerender(<AddressAutocomplete {...defaultProps} value="New address" />)
      expect(input.value).toBe('New address')

      restoreEnv()
    })
  })

  describe('Cleanup', () => {
    it('cleans up event listeners on unmount', () => {
      const restoreEnv = mockEnv('test-api-key')
      const { mockMaps } = mockGoogleMapsAPI()

      const { unmount } = render(<AddressAutocomplete {...defaultProps} />)

      unmount()

      expect(mockMaps.event.clearInstanceListeners).toHaveBeenCalled()

      restoreEnv()
    })
  })

  describe('Autocomplete Configuration', () => {
    it('configures autocomplete with correct options', () => {
      const restoreEnv = mockEnv('test-api-key')
      const { mockPlaces } = mockGoogleMapsAPI()

      render(<AddressAutocomplete {...defaultProps} />)

      expect(mockPlaces.Autocomplete).toHaveBeenCalledWith(
        expect.any(HTMLInputElement),
        {
          types: ['address'],
          fields: ['formatted_address', 'geometry', 'address_components'],
        }
      )

      restoreEnv()
    })

    it('sets autocomplete attribute to off', () => {
      const restoreEnv = mockEnv(undefined)
      render(<AddressAutocomplete {...defaultProps} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('autocomplete', 'off')

      restoreEnv()
    })
  })
})
