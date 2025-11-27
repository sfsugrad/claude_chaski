import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import RegisterPage from '../page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
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

    it('renders full name input', () => {
      render(<RegisterPage />)
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
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

      await userEvent.type(screen.getByLabelText(/full name/i), 'Test User')
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

      await userEvent.type(screen.getByLabelText(/full name/i), 'Test User')
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

      await userEvent.type(screen.getByLabelText(/full name/i), 'Test User')
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

      await userEvent.type(screen.getByLabelText(/full name/i), 'Test User')
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

      await userEvent.type(screen.getByLabelText(/full name/i), 'Test User')
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

      await userEvent.type(screen.getByLabelText(/full name/i), 'Test User')
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

      await userEvent.type(screen.getByLabelText(/full name/i), 'Test User')
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

      await userEvent.type(screen.getByLabelText(/full name/i), 'Test User')
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

      await userEvent.type(screen.getByLabelText(/full name/i), 'Test User')
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
