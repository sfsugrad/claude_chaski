import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForgotPasswordPage from '../page'

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
