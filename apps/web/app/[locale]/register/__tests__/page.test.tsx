import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import RegisterPage from '../page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/en/register'),
  useSearchParams: jest.fn(() => ({ get: jest.fn() })),
}))

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      registerTitle: 'Create your account',
      firstName: 'First name',
      lastName: 'Last name',
      middleName: 'Middle name',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm password',
      phoneNumber: 'Phone number',
      iWantTo: 'I want to',
      sendPackages: 'Send packages',
      deliverPackages: 'Deliver packages',
      bothSendAndDeliver: 'Both send and deliver',
      maxRouteDeviation: 'Maximum route deviation',
      createAccount: 'Create account',
      signIn: 'Sign in',
      allFieldsRequired: 'Please fill in all required fields',
      passwordTooShort: 'Password must be at least 8 characters',
      passwordsDoNotMatch: 'Passwords do not match',
      validEmail: 'Please enter a valid email',
      maxDeviationRange: 'Must be between 1 and 50',
      registrationFailed: 'Registration failed. Please try again.',
      creatingAccount: 'Creating account...',
      title: 'Privacy Policy',
      termsLabel: 'I accept the terms',
      courierAgreementLabel: 'I accept the courier agreement',
      privacyLabel: 'I accept the privacy policy',
    }
    return translations[key] || key
  },
  useLocale: () => 'en',
}))

// Mock LanguageSwitcher
jest.mock('@/components/LanguageSwitcher', () => {
  return function MockLanguageSwitcher() {
    return <div data-testid="language-switcher">EN</div>
  }
})

// Mock react-phone-number-input
jest.mock('react-phone-number-input', () => {
  return function MockPhoneInput({ value, onChange, id, ...props }: any) {
    return (
      <input
        id={id}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        data-testid="phone-input"
        {...props}
      />
    )
  }
})

// Mock @/lib/distance
jest.mock('@/lib/distance', () => ({
  kmToMiles: (km: number) => km * 0.621371,
  milesToKm: (miles: number) => miles * 1.60934,
}))

// Mock the API functions
const mockRegister = jest.fn()

jest.mock('@/lib/api', () => ({
  authAPI: {
    register: () => mockRegister(),
  },
}))

// Mock GoogleSignInButton
jest.mock('@/components/GoogleSignInButton', () => {
  return function MockGoogleSignInButton() {
    return <button data-testid="google-signin">Continue with Google</button>
  }
})

// Mock AddressAutocomplete
jest.mock('@/components/AddressAutocomplete', () => {
  return function MockAddressAutocomplete({ id, name, value, onChange, placeholder, className }: any) {
    return (
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value, 0, 0)}
        placeholder={placeholder}
        className={className}
      />
    )
  }
})

// Mock UI components
jest.mock('@/components/ui', () => ({
  Button: ({ children, isLoading, ...props }: any) => (
    <button {...props}>{isLoading ? 'Creating account...' : children}</button>
  ),
  Input: ({ label, leftIcon, error, helperText, ...props }: any) => (
    <div className="form-group w-full">
      {label && <label htmlFor={props.id} className="label">{label}</label>}
      <div className="relative input-group">
        {leftIcon && <span className="input-group-icon">{leftIcon}</span>}
        <input {...props} className="input pl-10" />
      </div>
      {error && <p className="error-text">{error}</p>}
      {helperText && <p className="helper-text">{helperText}</p>}
    </div>
  ),
  Card: ({ children, className }: any) => <div className={`card ${className || ''}`}>{children}</div>,
  CardBody: ({ children, className }: any) => <div className={`card-body ${className || ''}`}>{children}</div>,
  Alert: ({ children, variant, dismissible, onDismiss }: any) => (
    <div role="alert" className={`alert alert-${variant}`}>
      {children}
      {dismissible && <button onClick={onDismiss} aria-label="Dismiss">X</button>}
    </div>
  ),
}))

describe('RegisterPage', () => {
  const mockRouter = {
    push: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
  })

  describe('Rendering', () => {
    it('renders create account heading', () => {
      render(<RegisterPage />)
      expect(screen.getByText('Create your account')).toBeInTheDocument()
    })

    it('renders first name input', () => {
      render(<RegisterPage />)
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    })

    it('renders last name input', () => {
      render(<RegisterPage />)
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    })

    it('renders email input', () => {
      render(<RegisterPage />)
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    })

    it('renders password input', () => {
      render(<RegisterPage />)
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    })

    it('renders confirm password input', () => {
      render(<RegisterPage />)
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    })

    it('renders role select', () => {
      render(<RegisterPage />)
      expect(screen.getByLabelText(/i want to/i)).toBeInTheDocument()
    })

    it('renders Google sign in button', () => {
      render(<RegisterPage />)
      expect(screen.getByTestId('google-signin')).toBeInTheDocument()
    })

    it('renders login link', () => {
      render(<RegisterPage />)
      expect(screen.getByText(/sign in/i)).toBeInTheDocument()
    })

    it('renders phone number input', () => {
      render(<RegisterPage />)
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
    })
  })

  describe('Role Selection', () => {
    it('has sender option', () => {
      render(<RegisterPage />)
      expect(screen.getByText(/send packages/i)).toBeInTheDocument()
    })

    it('has courier option', () => {
      render(<RegisterPage />)
      expect(screen.getByText(/deliver packages/i)).toBeInTheDocument()
    })

    it('has both option', () => {
      render(<RegisterPage />)
      expect(screen.getByText(/both send and deliver/i)).toBeInTheDocument()
    })

    it('shows max deviation field when courier role selected', async () => {
      render(<RegisterPage />)

      const roleSelect = screen.getByLabelText(/i want to/i)
      await userEvent.selectOptions(roleSelect, 'courier')

      expect(screen.getByLabelText(/maximum route deviation/i)).toBeInTheDocument()
    })

    it('shows max deviation field when both role selected', async () => {
      render(<RegisterPage />)

      const roleSelect = screen.getByLabelText(/i want to/i)
      await userEvent.selectOptions(roleSelect, 'both')

      expect(screen.getByLabelText(/maximum route deviation/i)).toBeInTheDocument()
    })

    it('does not show max deviation field when sender role selected', async () => {
      render(<RegisterPage />)

      const roleSelect = screen.getByLabelText(/i want to/i)
      await userEvent.selectOptions(roleSelect, 'sender')

      expect(screen.queryByLabelText(/maximum route deviation/i)).not.toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('shows error for empty required fields', async () => {
      render(<RegisterPage />)

      // Submit form directly to bypass HTML5 required validation
      const form = screen.getByRole('button', { name: /create account/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/please fill in all required fields/i)).toBeInTheDocument()
      })
    })

    it('shows error for short password', async () => {
      render(<RegisterPage />)

      await userEvent.type(screen.getByLabelText(/first name/i), 'Test')
      await userEvent.type(screen.getByLabelText(/last name/i), 'User')
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
      await userEvent.type(screen.getByLabelText(/^password/i), 'short')
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'short')

      // Submit form directly
      const form = screen.getByRole('button', { name: /create account/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
      })
    })

    it('shows error for password mismatch', async () => {
      render(<RegisterPage />)

      await userEvent.type(screen.getByLabelText(/first name/i), 'Test')
      await userEvent.type(screen.getByLabelText(/last name/i), 'User')
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
      await userEvent.type(screen.getByLabelText(/^password/i), 'password123')
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'differentpassword')

      // Submit form directly
      const form = screen.getByRole('button', { name: /create account/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
      })
    })

    it('shows error for invalid email', async () => {
      render(<RegisterPage />)

      await userEvent.type(screen.getByLabelText(/first name/i), 'Test')
      await userEvent.type(screen.getByLabelText(/last name/i), 'User')
      await userEvent.type(screen.getByLabelText(/email/i), 'invalid-email')
      await userEvent.type(screen.getByLabelText(/^password/i), 'password123')
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123')

      // Submit form directly
      const form = screen.getByRole('button', { name: /create account/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeInTheDocument()
      })
    })

    it('shows error for invalid max deviation', async () => {
      render(<RegisterPage />)

      await userEvent.type(screen.getByLabelText(/first name/i), 'Test')
      await userEvent.type(screen.getByLabelText(/last name/i), 'User')
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
      await userEvent.type(screen.getByLabelText(/^password/i), 'password123')
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123')

      const roleSelect = screen.getByLabelText(/i want to/i)
      await userEvent.selectOptions(roleSelect, 'courier')

      const deviationInput = screen.getByLabelText(/maximum route deviation/i)
      await userEvent.clear(deviationInput)
      await userEvent.type(deviationInput, '100')

      // Submit form directly
      const form = screen.getByRole('button', { name: /create account/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/between 1 and 50/i)).toBeInTheDocument()
      })
    })
  })

  describe('Registration Flow', () => {
    it('calls register API with form data', async () => {
      mockRegister.mockResolvedValue({ data: { id: 1 } })

      render(<RegisterPage />)

      await userEvent.type(screen.getByLabelText(/first name/i), 'Test')
      await userEvent.type(screen.getByLabelText(/last name/i), 'User')
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
      await userEvent.type(screen.getByLabelText(/^password/i), 'password123')
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalled()
      })
    })

    it('redirects to register-success on successful registration', async () => {
      mockRegister.mockResolvedValue({ data: { id: 1 } })

      render(<RegisterPage />)

      await userEvent.type(screen.getByLabelText(/first name/i), 'Test')
      await userEvent.type(screen.getByLabelText(/last name/i), 'User')
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
      await userEvent.type(screen.getByLabelText(/^password/i), 'password123')
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/register-success')
      })
    })

    it('shows loading state during registration', async () => {
      mockRegister.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<RegisterPage />)

      await userEvent.type(screen.getByLabelText(/first name/i), 'Test')
      await userEvent.type(screen.getByLabelText(/last name/i), 'User')
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
      await userEvent.type(screen.getByLabelText(/^password/i), 'password123')
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/creating account/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message on registration failure', async () => {
      mockRegister.mockRejectedValue({
        response: { data: { detail: 'Email already registered' } },
      })

      render(<RegisterPage />)

      await userEvent.type(screen.getByLabelText(/first name/i), 'Test')
      await userEvent.type(screen.getByLabelText(/last name/i), 'User')
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
      await userEvent.type(screen.getByLabelText(/^password/i), 'password123')
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Email already registered')).toBeInTheDocument()
      })
    })

    it('shows generic error on network failure', async () => {
      mockRegister.mockRejectedValue(new Error('Network error'))

      render(<RegisterPage />)

      await userEvent.type(screen.getByLabelText(/first name/i), 'Test')
      await userEvent.type(screen.getByLabelText(/last name/i), 'User')
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
      await userEvent.type(screen.getByLabelText(/^password/i), 'password123')
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/registration failed/i)).toBeInTheDocument()
      })
    })
  })
})
