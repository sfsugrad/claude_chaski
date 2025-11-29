import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import CreateRoutePage from '../page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock API
const mockCreateRoute = jest.fn()

jest.mock('@/lib/api', () => ({
  couriersAPI: {
    createRoute: (data: any) => mockCreateRoute(data),
  },
}))

// Mock UI components
jest.mock('@/components/ui', () => ({
  Button: ({ children, loading, disabled, ...props }: any) => (
    <button disabled={disabled || loading} {...props}>
      {loading ? 'Creating Route...' : children}
    </button>
  ),
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardBody: ({ children, className }: any) => <div className={className}>{children}</div>,
  Alert: ({ children, variant, onClose }: any) => (
    <div role="alert" data-variant={variant}>
      {children}
      {onClose && <button onClick={onClose}>Close</button>}
    </div>
  ),
  Input: (props: any) => <input {...props} />,
}))

// Mock AddressAutocomplete component
jest.mock('@/components/AddressAutocomplete', () => {
  return function MockAddressAutocomplete({
    id,
    name,
    value,
    onChange,
    placeholder,
  }: {
    id: string
    name: string
    value: string
    onChange: (address: string, lat: number, lng: number) => void
    placeholder?: string
  }) {
    return (
      <div data-testid={`address-autocomplete-${id}`}>
        <input
          id={id}
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            // Simulate selecting an address with coordinates
            const address = e.target.value
            if (address.includes('test')) {
              // Simulate a valid address selection
              onChange(address, 37.7749, -122.4194)
            } else {
              onChange(address, 0, 0)
            }
          }}
          data-testid={`${id}-input`}
        />
        <button
          type="button"
          data-testid={`${id}-select`}
          onClick={() => onChange(`Selected ${name}`, 37.7749, -122.4194)}
        >
          Select Address
        </button>
      </div>
    )
  }
})

describe('CreateRoutePage', () => {
  const mockRouter = {
    push: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
  })

  describe('Rendering', () => {
    it('renders page heading', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText('Create New Route')).toBeInTheDocument()
    })

    it('renders page description', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText(/enter your travel route/i)).toBeInTheDocument()
    })

    it('renders back to dashboard link', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText(/back to dashboard/i)).toBeInTheDocument()
    })

    it('renders starting point field', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText(/starting point/i)).toBeInTheDocument()
    })

    it('renders destination field', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText(/destination/i)).toBeInTheDocument()
    })

    it('renders pickup radius section', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText(/pickup radius/i)).toBeInTheDocument()
    })

    it('renders when are you traveling section', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText(/when are you traveling/i)).toBeInTheDocument()
    })

    it('renders submit button', () => {
      render(<CreateRoutePage />)
      expect(screen.getByRole('button', { name: /create route/i })).toBeInTheDocument()
    })
  })

  describe('Form Defaults', () => {
    it('has default max deviation of 5', () => {
      render(<CreateRoutePage />)
      // The slider has default value of 5
      const slider = screen.getByRole('slider')
      expect(slider).toHaveValue('5')
    })
  })

  describe('Form Validation', () => {
    it('shows error when start address is empty', async () => {
      render(<CreateRoutePage />)

      // Select only end address
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/please enter both start and end addresses/i)).toBeInTheDocument()
      })
    })

    it('shows error when end address is empty', async () => {
      render(<CreateRoutePage />)

      // Select only start address
      fireEvent.click(screen.getByTestId('start_address-select'))

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/please enter both start and end addresses/i)).toBeInTheDocument()
      })
    })

    it('shows error when addresses not selected from autocomplete', async () => {
      render(<CreateRoutePage />)

      // Type addresses without selecting from autocomplete (lat/lng will be 0)
      const startInput = screen.getByTestId('start_address-input')
      const endInput = screen.getByTestId('end_address-input')

      await userEvent.type(startInput, '123 Main St')
      await userEvent.type(endInput, '456 Oak Ave')

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/please select addresses from the autocomplete/i)).toBeInTheDocument()
      })
    })
  })

  describe('Form Submission', () => {
    it('calls createRoute API with form data', async () => {
      mockCreateRoute.mockResolvedValue({ data: { id: 1 } })

      render(<CreateRoutePage />)

      // Select addresses
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateRoute).toHaveBeenCalled()
      })
    })

    it('includes max deviation in submission', async () => {
      mockCreateRoute.mockResolvedValue({ data: { id: 1 } })

      render(<CreateRoutePage />)

      // Change max deviation using slider
      const slider = screen.getByRole('slider')
      fireEvent.change(slider, { target: { value: '10' } })

      // Select addresses
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateRoute).toHaveBeenCalledWith(
          expect.objectContaining({
            max_deviation_km: 10,
          })
        )
      })
    })

    it('redirects to courier page on success', async () => {
      mockCreateRoute.mockResolvedValue({ data: { id: 1 } })

      render(<CreateRoutePage />)

      // Select addresses
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/courier')
      })
    })

    it('shows loading state during submission', async () => {
      mockCreateRoute.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<CreateRoutePage />)

      // Select addresses
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/creating route/i)).toBeInTheDocument()
      })
    })

    it('disables button during loading', async () => {
      mockCreateRoute.mockImplementation(() => new Promise(() => {}))

      render(<CreateRoutePage />)

      // Select addresses
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /creating route/i })
        expect(button).toBeDisabled()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message on API failure', async () => {
      mockCreateRoute.mockRejectedValue({
        response: { data: { detail: 'Route creation failed' } },
      })

      render(<CreateRoutePage />)

      // Select addresses
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('Route creation failed')).toBeInTheDocument()
      })
    })

    it('shows generic error on network failure', async () => {
      mockCreateRoute.mockRejectedValue(new Error('Network error'))

      render(<CreateRoutePage />)

      // Select addresses
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/failed to create route/i)).toBeInTheDocument()
      })
    })
  })

  describe('Deviation Presets', () => {
    it('renders deviation preset buttons', () => {
      render(<CreateRoutePage />)
      // Use getAllByText since the km values appear multiple times (button + display)
      expect(screen.getAllByText('2 km').length).toBeGreaterThan(0)
      expect(screen.getAllByText('5 km').length).toBeGreaterThan(0)
      expect(screen.getAllByText('10 km').length).toBeGreaterThan(0)
      expect(screen.getAllByText('20 km').length).toBeGreaterThan(0)
    })

    it('can change deviation via preset buttons', async () => {
      mockCreateRoute.mockResolvedValue({ data: { id: 1 } })

      render(<CreateRoutePage />)

      // Click on 10km preset
      fireEvent.click(screen.getByText('10 km'))

      // Verify slider updated
      const slider = screen.getByRole('slider')
      expect(slider).toHaveValue('10')

      // Select addresses and submit
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateRoute).toHaveBeenCalledWith(
          expect.objectContaining({
            max_deviation_km: 10,
          })
        )
      })
    })
  })

  describe('Trip Date and Departure Time Fields', () => {
    it('trip date and departure time are optional', async () => {
      mockCreateRoute.mockResolvedValue({ data: { id: 1 } })

      render(<CreateRoutePage />)

      // Select addresses but don't set trip date or departure time
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateRoute).toHaveBeenCalled()
      })
    })

    it('includes trip_date when set', async () => {
      mockCreateRoute.mockResolvedValue({ data: { id: 1 } })

      render(<CreateRoutePage />)

      // Select addresses
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Set trip date
      const tripDateInput = document.querySelector('input[type="date"]')!
      fireEvent.change(tripDateInput, { target: { value: '2025-01-15' } })

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateRoute).toHaveBeenCalledWith(
          expect.objectContaining({
            trip_date: '2025-01-15',
          })
        )
      })
    })

    it('includes departure_time when set', async () => {
      mockCreateRoute.mockResolvedValue({ data: { id: 1 } })

      render(<CreateRoutePage />)

      // Select addresses
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Set departure time
      const departureInput = document.querySelector('input[type="time"]')!
      fireEvent.change(departureInput, { target: { value: '10:00' } })

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateRoute).toHaveBeenCalledWith(
          expect.objectContaining({
            departure_time: '10:00',
          })
        )
      })
    })
  })

  describe('Navigation', () => {
    it('back link points to courier dashboard', () => {
      render(<CreateRoutePage />)
      const backLink = screen.getByText(/back to dashboard/i)
      expect(backLink.closest('a')).toHaveAttribute('href', '/courier')
    })
  })

  describe('Info Section', () => {
    it('shows what happens next info', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText(/what happens next/i)).toBeInTheDocument()
    })
  })
})
