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

    it('renders start address field', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText(/start address/i)).toBeInTheDocument()
    })

    it('renders destination address field', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText(/destination address/i)).toBeInTheDocument()
    })

    it('renders max deviation field', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText(/maximum deviation/i)).toBeInTheDocument()
    })

    it('renders departure time field', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText(/departure time/i)).toBeInTheDocument()
    })

    it('renders submit button', () => {
      render(<CreateRoutePage />)
      expect(screen.getByRole('button', { name: /create route/i })).toBeInTheDocument()
    })
  })

  describe('Form Defaults', () => {
    it('has default max deviation of 5', () => {
      render(<CreateRoutePage />)
      const deviationInput = screen.getByRole('spinbutton')
      expect(deviationInput).toHaveValue(5)
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

      // Change max deviation using fireEvent
      const deviationInput = screen.getByRole('spinbutton')
      fireEvent.change(deviationInput, { target: { value: '10' } })

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

  describe('Max Deviation Field', () => {
    it('has min value of 1', () => {
      render(<CreateRoutePage />)
      const deviationInput = screen.getByRole('spinbutton')
      expect(deviationInput).toHaveAttribute('min', '1')
    })

    it('has max value of 50', () => {
      render(<CreateRoutePage />)
      const deviationInput = screen.getByRole('spinbutton')
      expect(deviationInput).toHaveAttribute('max', '50')
    })

    it('shows help text about deviation range', () => {
      render(<CreateRoutePage />)
      expect(screen.getByText(/1-50 km/i)).toBeInTheDocument()
    })
  })

  describe('Departure Time Field', () => {
    it('is optional', async () => {
      mockCreateRoute.mockResolvedValue({ data: { id: 1 } })

      render(<CreateRoutePage />)

      // Select addresses but don't set departure time
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateRoute).toHaveBeenCalled()
      })
    })

    it('includes departure_time when set', async () => {
      mockCreateRoute.mockResolvedValue({ data: { id: 1 } })

      render(<CreateRoutePage />)

      // Select addresses
      fireEvent.click(screen.getByTestId('start_address-select'))
      fireEvent.click(screen.getByTestId('end_address-select'))

      // Set departure time
      const departureInput = document.querySelector('input[type="datetime-local"]')!
      fireEvent.change(departureInput, { target: { value: '2025-01-15T10:00' } })

      // Submit form
      const form = screen.getByRole('button', { name: /create route/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateRoute).toHaveBeenCalledWith(
          expect.objectContaining({
            departure_time: '2025-01-15T10:00',
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
})
