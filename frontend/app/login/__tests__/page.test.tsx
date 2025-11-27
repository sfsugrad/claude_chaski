import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useSearchParams } from 'next/navigation'
import LoginPage from '../page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))

// Mock the API functions
const mockLogin = jest.fn()
const mockGetCurrentUser = jest.fn()

jest.mock('@/lib/api', () => ({
  authAPI: {
    login: () => mockLogin(),
    getCurrentUser: () => mockGetCurrentUser(),
  },
}))

// Mock GoogleSignInButton
jest.mock('@/components/GoogleSignInButton', () => {
  return function MockGoogleSignInButton() {
    return <button data-testid="google-signin">Continue with Google</button>
  }
})

describe('LoginPage', () => {
  const mockRouter = {
    push: jest.fn(),
  }

  const mockSearchParams = {
    get: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)
    Storage.prototype.getItem = jest.fn()
    Storage.prototype.setItem = jest.fn()
    Storage.prototype.removeItem = jest.fn()
  })

  describe('Rendering', () => {
    it('renders sign in heading', () => {
      render(<LoginPage />)
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    })

    it('renders email input', () => {
      render(<LoginPage />)
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    })

    it('renders password input', () => {
      render(<LoginPage />)
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    })

    it('renders sign in button', () => {
      render(<LoginPage />)
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('renders Google sign in button', () => {
      render(<LoginPage />)
      expect(screen.getByTestId('google-signin')).toBeInTheDocument()
    })

    it('renders register link', () => {
      render(<LoginPage />)
      expect(screen.getByText(/create one now/i)).toBeInTheDocument()
    })

    it('renders forgot password link', () => {
      render(<LoginPage />)
      expect(screen.getByText(/forgot password/i)).toBeInTheDocument()
    })
  })

  describe('Success Messages', () => {
    it('shows success message when registered=true in URL', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        if (param === 'registered') return 'true'
        return null
      })

      render(<LoginPage />)

      await waitFor(() => {
        expect(screen.getByText(/registration successful/i)).toBeInTheDocument()
      })
    })

    it('shows success message when verified=true in URL', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        if (param === 'verified') return 'true'
        return null
      })

      render(<LoginPage />)

      await waitFor(() => {
        expect(screen.getByText(/email verified/i)).toBeInTheDocument()
      })
    })

    it('shows success message when reset=true in URL', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        if (param === 'reset') return 'true'
        return null
      })

      render(<LoginPage />)

      await waitFor(() => {
        expect(screen.getByText(/password reset successful/i)).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation', () => {
    it('shows error when submitting empty form', async () => {
      render(<LoginPage />)

      // Submit form directly to bypass HTML5 required validation
      const form = screen.getByRole('button', { name: /sign in/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument()
      })
    })

    it('shows error when email is empty', async () => {
      render(<LoginPage />)

      const passwordInput = screen.getByLabelText(/password/i)
      await userEvent.type(passwordInput, 'password123')

      // Submit form directly to bypass HTML5 required validation
      const form = screen.getByRole('button', { name: /sign in/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument()
      })
    })

    it('shows error when password is empty', async () => {
      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email/i)
      await userEvent.type(emailInput, 'test@example.com')

      // Submit form directly to bypass HTML5 required validation
      const form = screen.getByRole('button', { name: /sign in/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument()
      })
    })
  })

  describe('Login Flow', () => {
    it('calls login API with form data', async () => {
      mockLogin.mockResolvedValue({ data: { access_token: 'test-token' } })
      mockGetCurrentUser.mockResolvedValue({ data: { role: 'sender' } })

      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled()
      })
    })

    it('fetches current user after successful login (cookie-based auth)', async () => {
      mockLogin.mockResolvedValue({ data: {} })
      mockGetCurrentUser.mockResolvedValue({ data: { role: 'sender' } })

      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        // After login, should fetch current user to determine redirect
        expect(mockGetCurrentUser).toHaveBeenCalled()
      })
    })

    it('redirects to dashboard for regular users', async () => {
      mockLogin.mockResolvedValue({ data: { access_token: 'test-token' } })
      mockGetCurrentUser.mockResolvedValue({ data: { role: 'sender' } })

      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('redirects to admin for admin users', async () => {
      mockLogin.mockResolvedValue({ data: { access_token: 'test-token' } })
      mockGetCurrentUser.mockResolvedValue({ data: { role: 'ADMIN' } })

      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/admin')
      })
    })

    it('shows loading state during login', async () => {
      mockLogin.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/signing in/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message on login failure', async () => {
      mockLogin.mockRejectedValue({
        response: { data: { detail: 'Invalid credentials' } },
      })

      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'wrongpassword')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
      })
    })

    it('shows generic error on network failure', async () => {
      mockLogin.mockRejectedValue(new Error('Network error'))

      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/login failed/i)).toBeInTheDocument()
      })
    })
  })
})
