import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForgotPasswordPage from '../page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
  usePathname: jest.fn(() => '/en/forgot-password'),
}))

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      forgotPasswordTitle: 'Forgot your password?',
      forgotPasswordDescription: 'Enter your email address and we will send you a reset link.',
      email: 'Email',
      sendResetLink: 'Send reset link',
      backToSignIn: 'Back to sign in',
      signIn: 'Sign in',
      emailRequired: 'Please enter your email address',
      resetLinkSent: 'Reset link sent! Check your email.',
      requestFailed: 'Failed to send reset link. Please try again.',
      sending: 'Sending...',
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

// Mock UI components
jest.mock('@/components/ui', () => ({
  Button: ({ children, isLoading, ...props }: any) => (
    <button {...props}>{isLoading ? 'Sending...' : children}</button>
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

// Mock the API functions
const mockForgotPassword = jest.fn()

jest.mock('@/lib/api', () => ({
  authAPI: {
    forgotPassword: (data: any) => mockForgotPassword(data),
  },
}))

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders forgot password heading', () => {
      render(<ForgotPasswordPage />)
      expect(screen.getByText('Forgot your password?')).toBeInTheDocument()
    })

    it('renders email input', () => {
      render(<ForgotPasswordPage />)
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    })

    it('renders send reset link button', () => {
      render(<ForgotPasswordPage />)
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
    })

    it('renders sign in link', () => {
      render(<ForgotPasswordPage />)
      expect(screen.getByText(/sign in/i)).toBeInTheDocument()
    })

    it('renders description text', () => {
      render(<ForgotPasswordPage />)
      expect(screen.getByText(/enter your email address/i)).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('shows error when submitting empty form', async () => {
      render(<ForgotPasswordPage />)

      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/please enter your email address/i)).toBeInTheDocument()
      })
    })
  })

  describe('Submit Flow', () => {
    it('calls forgotPassword API with email', async () => {
      mockForgotPassword.mockResolvedValue({ data: { message: 'Email sent' } })

      render(<ForgotPasswordPage />)

      const emailInput = screen.getByLabelText(/email/i)
      await userEvent.type(emailInput, 'test@example.com')

      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockForgotPassword).toHaveBeenCalledWith({ email: 'test@example.com' })
      })
    })

    it('shows loading state during submission', async () => {
      mockForgotPassword.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<ForgotPasswordPage />)

      const emailInput = screen.getByLabelText(/email/i)
      await userEvent.type(emailInput, 'test@example.com')

      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/sending/i)).toBeInTheDocument()
      })
    })

    it('shows success message after successful submission', async () => {
      mockForgotPassword.mockResolvedValue({ data: { message: 'Email sent' } })

      render(<ForgotPasswordPage />)

      const emailInput = screen.getByLabelText(/email/i)
      await userEvent.type(emailInput, 'test@example.com')

      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument()
      })
    })

    it('hides form after successful submission', async () => {
      mockForgotPassword.mockResolvedValue({ data: { message: 'Email sent' } })

      render(<ForgotPasswordPage />)

      const emailInput = screen.getByLabelText(/email/i)
      await userEvent.type(emailInput, 'test@example.com')

      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument()
      })
    })

    it('shows return to login link after success', async () => {
      mockForgotPassword.mockResolvedValue({ data: { message: 'Email sent' } })

      render(<ForgotPasswordPage />)

      const emailInput = screen.getByLabelText(/email/i)
      await userEvent.type(emailInput, 'test@example.com')

      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/return to login/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message on API failure', async () => {
      mockForgotPassword.mockRejectedValue({
        response: { data: { detail: 'Something went wrong' } },
      })

      render(<ForgotPasswordPage />)

      const emailInput = screen.getByLabelText(/email/i)
      await userEvent.type(emailInput, 'test@example.com')

      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      })
    })

    it('shows generic error on network failure', async () => {
      mockForgotPassword.mockRejectedValue(new Error('Network error'))

      render(<ForgotPasswordPage />)

      const emailInput = screen.getByLabelText(/email/i)
      await userEvent.type(emailInput, 'test@example.com')

      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/an error occurred/i)).toBeInTheDocument()
      })
    })
  })
})
