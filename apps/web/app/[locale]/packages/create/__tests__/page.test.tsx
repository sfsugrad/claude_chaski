import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import CreatePackagePage from '../page'

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

// Mock UI components
jest.mock('@/components/ui', () => ({
  Button: ({ children, loading, disabled, onClick, type, ...props }: any) => (
    <button type={type} disabled={disabled || loading} onClick={onClick} {...props}>
      {loading ? 'Creating Package...' : children}
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
  Select: ({ options, value, onChange, ...props }: any) => (
    <select value={value} onChange={onChange} {...props}>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  ),
}))

// Mock Progress component
jest.mock('@/components/ui/Progress', () => ({
  ProgressSteps: ({ steps, currentStep }: any) => (
    <div data-testid="progress-steps" data-current={currentStep}>
      {steps.map((step: string, i: number) => (
        <span key={i} data-active={i === currentStep}>{step}</span>
      ))}
    </div>
  ),
}))

// Mock logistics components
jest.mock('@/components/logistics/SizeSelector', () => ({
  SizeSelector: ({ value, onChange }: any) => (
    <div data-testid="size-selector">
      {['small', 'medium', 'large', 'extra_large'].map(size => (
        <button
          key={size}
          type="button"
          data-testid={`size-${size}`}
          onClick={() => onChange(size)}
          data-selected={value === size}
        >
          {size}
        </button>
      ))}
    </div>
  ),
}))

jest.mock('@/components/logistics/LocationInput', () => ({
  LocationInput: ({ pickup, dropoff, onPickupChange, onDropoffChange, showContactFields }: any) => (
    <div data-testid="location-input">
      <input
        data-testid="pickup-address"
        value={pickup.address}
        onChange={(e) => onPickupChange({ ...pickup, address: e.target.value, lat: 40.7128, lng: -74.006 })}
        placeholder="Pickup"
      />
      <input
        data-testid="dropoff-address"
        value={dropoff.address}
        onChange={(e) => onDropoffChange({ ...dropoff, address: e.target.value, lat: 40.7128, lng: -74.006 })}
        placeholder="Dropoff"
      />
      {showContactFields && (
        <>
          <input
            data-testid="pickup-contact-name"
            value={pickup.contactName || ''}
            onChange={(e) => onPickupChange({ ...pickup, contactName: e.target.value })}
            placeholder="Pickup Contact Name"
          />
          <input
            data-testid="dropoff-contact-name"
            value={dropoff.contactName || ''}
            onChange={(e) => onDropoffChange({ ...dropoff, contactName: e.target.value })}
            placeholder="Dropoff Contact Name"
          />
        </>
      )}
    </div>
  ),
  LocationDisplay: () => <div data-testid="location-display" />,
  AddressDisplay: ({ label, address }: any) => <div data-testid={`address-display-${label.toLowerCase()}`}>{address}</div>,
}))

// Mock AddressAutocomplete (used in LocationInput internally but we mock LocationInput above)
jest.mock('@/components/AddressAutocomplete', () => {
  return function MockAddressAutocomplete() {
    return <div data-testid="mock-autocomplete" />
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

    // Default: non-admin user
    const { authAPI } = require('@/lib/api')
    authAPI.getCurrentUser.mockResolvedValue({
      data: { id: 1, email: 'user@example.com', full_name: 'Test User', role: 'sender' },
    })
  })

  describe('Page Rendering', () => {
    it('renders the page heading', () => {
      render(<CreatePackagePage />)
      expect(screen.getByText('Create Package Delivery')).toBeInTheDocument()
    })

    it('renders page description', () => {
      render(<CreatePackagePage />)
      expect(screen.getByText(/we'll match you with available couriers/i)).toBeInTheDocument()
    })

    it('renders back to dashboard link', () => {
      render(<CreatePackagePage />)
      const backLink = screen.getByText(/back to dashboard/i)
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard')
    })
  })

  describe('Wizard Navigation', () => {
    it('renders progress steps', () => {
      render(<CreatePackagePage />)
      expect(screen.getByTestId('progress-steps')).toBeInTheDocument()
    })

    it('shows step 1 (Package Details) by default', () => {
      render(<CreatePackagePage />)
      // Check for the step label in the wizard content (h3 heading)
      expect(screen.getByRole('heading', { name: /package details/i })).toBeInTheDocument()
    })

    it('renders continue button on step 1', () => {
      render(<CreatePackagePage />)
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    })
  })

  describe('Step 1: Package Details', () => {
    it('renders description textarea', () => {
      render(<CreatePackagePage />)
      const description = screen.getByPlaceholderText(/what are you sending/i)
      expect(description).toBeInTheDocument()
    })

    it('renders size selector', () => {
      render(<CreatePackagePage />)
      expect(screen.getByTestId('size-selector')).toBeInTheDocument()
    })

    it('renders weight presets', () => {
      render(<CreatePackagePage />)
      expect(screen.getByText('< 1 kg')).toBeInTheDocument()
      expect(screen.getByText('1-2 kg')).toBeInTheDocument()
    })

    it('renders price input', () => {
      render(<CreatePackagePage />)
      expect(screen.getByText(/offered price/i)).toBeInTheDocument()
    })

    it('shows validation error when description is empty', async () => {
      render(<CreatePackagePage />)

      const continueBtn = screen.getByRole('button', { name: /continue/i })
      fireEvent.click(continueBtn)

      await waitFor(() => {
        expect(screen.getByText(/please provide a package description/i)).toBeInTheDocument()
      })
    })

    it('shows character counter', () => {
      render(<CreatePackagePage />)
      expect(screen.getByText('0/500 characters')).toBeInTheDocument()
    })

    it('updates character count as user types', () => {
      render(<CreatePackagePage />)

      const description = screen.getByPlaceholderText(/what are you sending/i)
      fireEvent.change(description, { target: { value: 'Test package' } })

      expect(screen.getByText('12/500 characters')).toBeInTheDocument()
    })
  })

  describe('Step Navigation', () => {
    const fillStep1 = () => {
      const description = screen.getByPlaceholderText(/what are you sending/i)
      fireEvent.change(description, { target: { value: 'Test package description' } })
    }

    it('advances to step 2 when step 1 is valid', async () => {
      render(<CreatePackagePage />)

      fillStep1()

      const continueBtn = screen.getByRole('button', { name: /continue/i })
      fireEvent.click(continueBtn)

      await waitFor(() => {
        expect(screen.getByText(/pickup & dropoff/i)).toBeInTheDocument()
      })
    })

    it('shows back button on step 2', async () => {
      render(<CreatePackagePage />)

      fillStep1()
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
      })
    })

    it('can go back to step 1 from step 2', async () => {
      render(<CreatePackagePage />)

      fillStep1()
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() => {
        expect(screen.getByText(/pickup & dropoff/i)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /back/i }))

      await waitFor(() => {
        expect(screen.getByText(/describe what you're sending/i)).toBeInTheDocument()
      })
    })
  })

  describe('Step 2: Locations', () => {
    const fillStep1AndAdvance = async () => {
      const description = screen.getByPlaceholderText(/what are you sending/i)
      fireEvent.change(description, { target: { value: 'Test package' } })
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() => {
        expect(screen.getByTestId('location-input')).toBeInTheDocument()
      })
    }

    it('renders location input component', async () => {
      render(<CreatePackagePage />)
      await fillStep1AndAdvance()

      expect(screen.getByTestId('location-input')).toBeInTheDocument()
    })

    it('renders pickup and dropoff fields', async () => {
      render(<CreatePackagePage />)
      await fillStep1AndAdvance()

      expect(screen.getByTestId('pickup-address')).toBeInTheDocument()
      expect(screen.getByTestId('dropoff-address')).toBeInTheDocument()
    })

    it('shows validation error when pickup address is missing', async () => {
      render(<CreatePackagePage />)
      await fillStep1AndAdvance()

      // Try to continue without filling addresses
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() => {
        expect(screen.getByText(/please provide a pickup address/i)).toBeInTheDocument()
      })
    })

    it('shows validation error when dropoff address is missing', async () => {
      render(<CreatePackagePage />)
      await fillStep1AndAdvance()

      // Fill only pickup
      const pickupInput = screen.getByTestId('pickup-address')
      fireEvent.change(pickupInput, { target: { value: '123 Main St' } })

      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() => {
        expect(screen.getByText(/please provide a dropoff address/i)).toBeInTheDocument()
      })
    })
  })

  describe('Step 3: Review', () => {
    const fillAllStepsAndAdvance = async () => {
      // Step 1
      const description = screen.getByPlaceholderText(/what are you sending/i)
      fireEvent.change(description, { target: { value: 'Test package' } })
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() => {
        expect(screen.getByTestId('location-input')).toBeInTheDocument()
      })

      // Step 2
      const pickupInput = screen.getByTestId('pickup-address')
      const dropoffInput = screen.getByTestId('dropoff-address')
      fireEvent.change(pickupInput, { target: { value: '123 Main St' } })
      fireEvent.change(dropoffInput, { target: { value: '456 Oak Ave' } })
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() => {
        expect(screen.getByText(/review your package/i)).toBeInTheDocument()
      })
    }

    it('shows review page heading', async () => {
      render(<CreatePackagePage />)
      await fillAllStepsAndAdvance()

      expect(screen.getByText(/review your package/i)).toBeInTheDocument()
    })

    it('shows package summary', async () => {
      render(<CreatePackagePage />)
      await fillAllStepsAndAdvance()

      expect(screen.getByText('Test package')).toBeInTheDocument()
    })

    it('shows create package button on review step', async () => {
      render(<CreatePackagePage />)
      await fillAllStepsAndAdvance()

      expect(screen.getByRole('button', { name: /create package/i })).toBeInTheDocument()
    })

    it('shows edit links', async () => {
      render(<CreatePackagePage />)
      await fillAllStepsAndAdvance()

      const editButtons = screen.getAllByText(/edit/i)
      expect(editButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Form Submission', () => {
    const fillAndSubmit = async () => {
      // Step 1
      const description = screen.getByPlaceholderText(/what are you sending/i)
      fireEvent.change(description, { target: { value: 'Test package' } })
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() => {
        expect(screen.getByTestId('location-input')).toBeInTheDocument()
      })

      // Step 2
      fireEvent.change(screen.getByTestId('pickup-address'), { target: { value: '123 Main St' } })
      fireEvent.change(screen.getByTestId('dropoff-address'), { target: { value: '456 Oak Ave' } })
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() => {
        expect(screen.getByText(/review your package/i)).toBeInTheDocument()
      })

      // Step 3: Submit
      fireEvent.click(screen.getByRole('button', { name: /create package/i }))
    }

    it('submits form with valid data', async () => {
      const { packagesAPI } = require('@/lib/api')
      packagesAPI.create.mockResolvedValue({ data: { id: 1, status: 'pending' } })

      render(<CreatePackagePage />)
      await fillAndSubmit()

      await waitFor(() => {
        expect(packagesAPI.create).toHaveBeenCalled()
      })
    })

    it('redirects to dashboard on success', async () => {
      const { packagesAPI } = require('@/lib/api')
      packagesAPI.create.mockResolvedValue({ data: { id: 1, status: 'pending' } })

      render(<CreatePackagePage />)
      await fillAndSubmit()

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('shows loading state during submission', async () => {
      const { packagesAPI } = require('@/lib/api')
      packagesAPI.create.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<CreatePackagePage />)
      await fillAndSubmit()

      await waitFor(() => {
        expect(screen.getByText(/creating package/i)).toBeInTheDocument()
      })
    })

    it('handles API error with detail message', async () => {
      const { packagesAPI } = require('@/lib/api')
      packagesAPI.create.mockRejectedValue({
        response: { data: { detail: 'Unauthorized' } },
      })

      render(<CreatePackagePage />)
      await fillAndSubmit()

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument()
      })
    })

    it('handles generic API error', async () => {
      const { packagesAPI } = require('@/lib/api')
      packagesAPI.create.mockRejectedValue(new Error('Network error'))

      render(<CreatePackagePage />)
      await fillAndSubmit()

      await waitFor(() => {
        expect(screen.getByText(/failed to create package/i)).toBeInTheDocument()
      })
    })
  })

  describe('Admin User Selection', () => {
    it('shows user dropdown for admin users', async () => {
      const { authAPI, adminAPI } = require('@/lib/api')
      authAPI.getCurrentUser.mockResolvedValue({
        data: { id: 1, email: 'admin@example.com', full_name: 'Admin', role: 'admin' },
      })
      adminAPI.getUsers.mockResolvedValue({
        data: [
          { id: 2, email: 'sender@example.com', full_name: 'Sender User', role: 'sender' },
        ],
      })

      render(<CreatePackagePage />)

      await waitFor(() => {
        expect(screen.getByText(/create package for user/i)).toBeInTheDocument()
      })
    })

    it('does not show user dropdown for non-admin users', async () => {
      render(<CreatePackagePage />)

      await waitFor(() => {
        expect(screen.getByText('Create Package Delivery')).toBeInTheDocument()
      })

      expect(screen.queryByText(/create package for user/i)).not.toBeInTheDocument()
    })
  })
})
