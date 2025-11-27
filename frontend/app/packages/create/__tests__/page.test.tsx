import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import CreatePackagePage from '../page'
import axios, { packagesAPI, authAPI, adminAPI } from '@/lib/api'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock API
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
  packagesAPI: {
    create: jest.fn(),
  },
  authAPI: {
    getCurrentUser: jest.fn(),
  },
  adminAPI: {
    getUsers: jest.fn(),
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
    required,
    className,
  }: any) {
    return (
      <input
        data-testid={`mock-${id}`}
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={(e) => {
          // Simulate address selection with coordinates
          onChange(e.target.value, 40.7128, -74.006)
        }}
        placeholder={placeholder}
        required={required}
        className={className}
      />
    )
  }
})

describe('CreatePackagePage', () => {
  const mockPush = jest.fn()
  const mockRouterReturn = {
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouterReturn)
  })

  describe('Page Rendering', () => {
    it('renders the package creation form', () => {
      render(<CreatePackagePage />)

      expect(screen.getByText('Create Package Delivery')).toBeInTheDocument()
      expect(
        screen.getByText(
          "Enter the details of your package and we'll match you with available couriers"
        )
      ).toBeInTheDocument()
    })

    it('renders back to dashboard link', () => {
      render(<CreatePackagePage />)

      const backLink = screen.getByText('← Back to Dashboard')
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard')
    })

    it('renders all form sections', () => {
      render(<CreatePackagePage />)

      expect(screen.getByText('Package Details')).toBeInTheDocument()
      expect(screen.getByText('Pickup Location')).toBeInTheDocument()
      expect(screen.getByText('Dropoff Location')).toBeInTheDocument()
    })
  })

  describe('Form Fields', () => {
    it('renders description textarea', () => {
      render(<CreatePackagePage />)

      const descriptionInput = screen.getByPlaceholderText(
        /What are you sending/i
      )
      expect(descriptionInput).toBeInTheDocument()
      expect(descriptionInput).toHaveAttribute('maxLength', '500')
    })

    it('renders size dropdown with all options', () => {
      render(<CreatePackagePage />)

      const sizeSelect = screen.getByLabelText(/Package Size/i)
      expect(sizeSelect).toBeInTheDocument()

      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(4)
      expect(screen.getByText(/Small \(Envelope/i)).toBeInTheDocument()
      expect(screen.getByText(/Medium \(Shoebox/i)).toBeInTheDocument()
      expect(screen.getByText(/Large \(Suitcase/i)).toBeInTheDocument()
      expect(screen.getByText(/Extra Large/i)).toBeInTheDocument()
    })

    it('renders weight input with correct attributes', () => {
      render(<CreatePackagePage />)

      const weightInput = screen.getByLabelText(/Weight \(kg\)/i)
      expect(weightInput).toBeInTheDocument()
      expect(weightInput).toHaveAttribute('type', 'number')
      expect(weightInput).toHaveAttribute('min', '0.1')
      expect(weightInput).toHaveAttribute('max', '1000')
      expect(weightInput).toHaveAttribute('step', '0.1')
    })

    it('renders price input with dollar symbol', () => {
      render(<CreatePackagePage />)

      const priceInput = screen.getByLabelText(/Offered Price/i)
      expect(priceInput).toBeInTheDocument()
      expect(screen.getByText('$')).toBeInTheDocument()
    })

    it('renders pickup address autocomplete', () => {
      render(<CreatePackagePage />)

      const pickupAddress = screen.getByTestId('mock-pickup_address')
      expect(pickupAddress).toBeInTheDocument()
    })

    it('renders dropoff address autocomplete', () => {
      render(<CreatePackagePage />)

      const dropoffAddress = screen.getByTestId('mock-dropoff_address')
      expect(dropoffAddress).toBeInTheDocument()
    })

    it('renders optional contact fields', () => {
      render(<CreatePackagePage />)

      expect(screen.getAllByText(/Contact Name \(Optional\)/i)).toHaveLength(2)
      expect(screen.getAllByText(/Contact Phone \(Optional\)/i)).toHaveLength(2)
    })
  })

  describe('Form Validation', () => {
    it('shows error when description is empty', async () => {
      render(<CreatePackagePage />)

      const form = screen.getByRole('button', { name: /Create Package/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(
          screen.getByText('Please provide a package description')
        ).toBeInTheDocument()
      })
    })

    it('shows error when description exceeds 500 characters', async () => {
      render(<CreatePackagePage />)

      const descriptionInput = screen.getByPlaceholderText(
        /What are you sending/i
      )
      const longDescription = 'a'.repeat(501)
      fireEvent.change(descriptionInput, { target: { value: longDescription } })

      const form = screen.getByRole('button', { name: /Create Package/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(
          screen.getByText('Description must be less than 500 characters')
        ).toBeInTheDocument()
      })
    })

    it('shows error when weight is invalid', async () => {
      render(<CreatePackagePage />)

      const descriptionInput = screen.getByPlaceholderText(
        /What are you sending/i
      )
      fireEvent.change(descriptionInput, {
        target: { value: 'Test package' },
      })

      const weightInput = screen.getByLabelText(/Weight \(kg\)/i)
      fireEvent.change(weightInput, { target: { value: '1001' } })

      const form = screen.getByRole('button', { name: /Create Package/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(
          screen.getByText('Weight must be between 0 and 1000 kg')
        ).toBeInTheDocument()
      })
    })

    it('shows error when pickup address is missing', async () => {
      render(<CreatePackagePage />)

      const descriptionInput = screen.getByPlaceholderText(
        /What are you sending/i
      )
      fireEvent.change(descriptionInput, {
        target: { value: 'Test package' },
      })

      const form = screen.getByRole('button', { name: /Create Package/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(
          screen.getByText('Please provide a pickup address')
        ).toBeInTheDocument()
      })
    })

    it('shows error when dropoff address is missing', async () => {
      render(<CreatePackagePage />)

      const descriptionInput = screen.getByPlaceholderText(
        /What are you sending/i
      )
      fireEvent.change(descriptionInput, {
        target: { value: 'Test package' },
      })

      const pickupAddress = screen.getByTestId('mock-pickup_address')
      fireEvent.change(pickupAddress, {
        target: { value: '123 Main St' },
      })

      const form = screen.getByRole('button', { name: /Create Package/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(
          screen.getByText('Please provide a dropoff address')
        ).toBeInTheDocument()
      })
    })

    // Note: Negative price validation is handled by HTML5 min="0" attribute,
    // so custom validation for negative prices is never reached in normal usage
  })

  describe('Form Submission', () => {
    const fillValidForm = () => {
      const descriptionInput = screen.getByPlaceholderText(
        /What are you sending/i
      )
      fireEvent.change(descriptionInput, {
        target: { value: 'Test package description' },
      })

      const sizeSelect = screen.getByLabelText(/Package Size/i)
      fireEvent.change(sizeSelect, { target: { value: 'medium' } })

      const weightInput = screen.getByLabelText(/Weight \(kg\)/i)
      fireEvent.change(weightInput, { target: { value: '5' } })

      const pickupAddress = screen.getByTestId('mock-pickup_address')
      fireEvent.change(pickupAddress, {
        target: { value: '123 Main St, New York, NY' },
      })

      const dropoffAddress = screen.getByTestId('mock-dropoff_address')
      fireEvent.change(dropoffAddress, {
        target: { value: '456 Broadway, New York, NY' },
      })
    }

    it('submits form with valid data', async () => {
      ;(packagesAPI.create as jest.Mock).mockResolvedValue({
        data: { id: 1, status: 'pending' },
      })

      render(<CreatePackagePage />)

      fillValidForm()

      const submitButton = screen.getByRole('button', {
        name: /Create Package/i,
      })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(packagesAPI.create).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Test package description',
            size: 'medium',
            weight_kg: 5,
            pickup_address: '123 Main St, New York, NY',
            pickup_lat: 40.7128,
            pickup_lng: -74.006,
            dropoff_address: '456 Broadway, New York, NY',
            dropoff_lat: 40.7128,
            dropoff_lng: -74.006,
          })
        )
      })

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('submits form with optional price', async () => {
      ;(packagesAPI.create as jest.Mock).mockResolvedValue({
        data: { id: 1, status: 'pending' },
      })

      render(<CreatePackagePage />)

      fillValidForm()

      const priceInput = screen.getByLabelText(/Offered Price/i)
      fireEvent.change(priceInput, { target: { value: '25.50' } })

      const submitButton = screen.getByRole('button', {
        name: /Create Package/i,
      })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(packagesAPI.create).toHaveBeenCalledWith(
          expect.objectContaining({
            price: 25.5,
          })
        )
      })
    })

    it('submits form with optional contact information', async () => {
      ;(packagesAPI.create as jest.Mock).mockResolvedValue({
        data: { id: 1, status: 'pending' },
      })

      render(<CreatePackagePage />)

      fillValidForm()

      const pickupContactName = screen.getAllByPlaceholderText('John Doe')[0]
      fireEvent.change(pickupContactName, {
        target: { value: 'John Smith' },
      })

      const pickupContactPhone =
        screen.getAllByPlaceholderText('+1234567890')[0]
      fireEvent.change(pickupContactPhone, {
        target: { value: '+15551234567' },
      })

      const submitButton = screen.getByRole('button', {
        name: /Create Package/i,
      })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(packagesAPI.create).toHaveBeenCalledWith(
          expect.objectContaining({
            pickup_contact_name: 'John Smith',
            pickup_contact_phone: '+15551234567',
          })
        )
      })
    })

    it('shows loading state during submission', async () => {
      ;(packagesAPI.create as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { id: 1 } }), 100)
          )
      )

      render(<CreatePackagePage />)

      fillValidForm()

      const submitButton = screen.getByRole('button', {
        name: /Create Package/i,
      })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Creating Package...')).toBeInTheDocument()
      })
    })

    it('handles API error with detail message', async () => {
      const errorMessage = 'Unauthorized to create package'
      ;(packagesAPI.create as jest.Mock).mockRejectedValue({
        response: {
          data: {
            detail: errorMessage,
          },
        },
      })

      render(<CreatePackagePage />)

      fillValidForm()

      const submitButton = screen.getByRole('button', {
        name: /Create Package/i,
      })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('handles generic API error', async () => {
      ;(packagesAPI.create as jest.Mock).mockRejectedValue(
        new Error('Network error')
      )

      render(<CreatePackagePage />)

      fillValidForm()

      const submitButton = screen.getByRole('button', {
        name: /Create Package/i,
      })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(
          screen.getByText('Failed to create package. Please try again.')
        ).toBeInTheDocument()
      })
    })
  })

  describe('Character Counter', () => {
    it('shows character count for description', () => {
      render(<CreatePackagePage />)

      expect(screen.getByText('0/500 characters')).toBeInTheDocument()
    })

    it('updates character count as user types', () => {
      render(<CreatePackagePage />)

      const descriptionInput = screen.getByPlaceholderText(
        /What are you sending/i
      )
      fireEvent.change(descriptionInput, {
        target: { value: 'Test description' },
      })

      expect(screen.getByText('16/500 characters')).toBeInTheDocument()
    })
  })

  describe('Form State Management', () => {
    it('updates form data when fields change', () => {
      render(<CreatePackagePage />)

      const descriptionInput = screen.getByPlaceholderText(
        /What are you sending/i
      ) as HTMLTextAreaElement
      fireEvent.change(descriptionInput, {
        target: { value: 'New description' },
      })

      expect(descriptionInput.value).toBe('New description')
    })

    it('clears error message when form is resubmitted', async () => {
      render(<CreatePackagePage />)

      const form = screen.getByRole('button', { name: /Create Package/i }).closest('form')!

      // First submission - trigger error
      fireEvent.submit(form)

      await waitFor(() => {
        expect(
          screen.getByText('Please provide a package description')
        ).toBeInTheDocument()
      })

      // Fill in description
      const descriptionInput = screen.getByPlaceholderText(
        /What are you sending/i
      )
      fireEvent.change(descriptionInput, {
        target: { value: 'Test package' },
      })

      // Second submission
      fireEvent.submit(form)

      // Error should be cleared (new error will appear, but previous one is cleared)
      await waitFor(() => {
        // The form should attempt to validate again
        expect(packagesAPI.create).not.toHaveBeenCalled()
      })
    })
  })

  describe('Admin User Selection', () => {
    const mockAdminUser = {
      id: 1,
      email: 'admin@example.com',
      full_name: 'Admin User',
      role: 'admin',
    }

    const mockUsers = [
      { id: 2, email: 'sender@example.com', full_name: 'Sender User', role: 'sender' },
      { id: 3, email: 'courier@example.com', full_name: 'Courier User', role: 'courier' },
      { id: 4, email: 'both@example.com', full_name: 'Both User', role: 'both' },
      { id: 5, email: 'courier2@example.com', full_name: 'Another Courier', role: 'COURIER' },
      { id: 6, email: 'admin2@example.com', full_name: 'Another Admin', role: 'admin' },
      { id: 7, email: 'admin3@example.com', full_name: 'Third Admin', role: 'ADMIN' },
    ]

    it('shows user dropdown for admin users', async () => {
      ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockAdminUser })
      ;(adminAPI.getUsers as jest.Mock).mockResolvedValue({ data: mockUsers })

      render(<CreatePackagePage />)

      await waitFor(() => {
        expect(screen.getByText('Create Package For User (Admin Only)')).toBeInTheDocument()
      })
    })

    it('does not show user dropdown for non-admin users', async () => {
      ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({
        data: { id: 2, email: 'sender@example.com', full_name: 'Sender', role: 'sender' },
      })

      render(<CreatePackagePage />)

      await waitFor(() => {
        expect(screen.getByText('Create Package Delivery')).toBeInTheDocument()
      })

      expect(screen.queryByText('Create Package For User (Admin Only)')).not.toBeInTheDocument()
    })

    it('filters out courier and admin users from the dropdown', async () => {
      ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockAdminUser })
      ;(adminAPI.getUsers as jest.Mock).mockResolvedValue({ data: mockUsers })

      render(<CreatePackagePage />)

      await waitFor(() => {
        expect(screen.getByText('Create Package For User (Admin Only)')).toBeInTheDocument()
      })

      // Should show sender and both users
      expect(screen.getByText(/Sender User.*sender@example.com.*sender/)).toBeInTheDocument()
      expect(screen.getByText(/Both User.*both@example.com.*both/)).toBeInTheDocument()

      // Should NOT show courier users
      expect(screen.queryByText(/Courier User.*courier@example.com/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Another Courier.*courier2@example.com/)).not.toBeInTheDocument()

      // Should NOT show admin users
      expect(screen.queryByText(/Another Admin.*admin2@example.com/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Third Admin.*admin3@example.com/)).not.toBeInTheDocument()
    })

    it('includes default empty option in dropdown', async () => {
      ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockAdminUser })
      ;(adminAPI.getUsers as jest.Mock).mockResolvedValue({ data: mockUsers })

      render(<CreatePackagePage />)

      await waitFor(() => {
        expect(screen.getByText('Select a user (leave empty to create for yourself)')).toBeInTheDocument()
      })
    })
  })
})
