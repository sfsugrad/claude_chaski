import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useSearchParams } from 'next/navigation'
import ResetPasswordPage from '../page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(() => '/en/reset-password'),
}))

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      resetPasswordTitle: 'Reset your password',
      newPassword: 'New password',
      confirmNewPassword: 'Confirm password',
      resetPasswordButton: 'Reset password',
      signIn: 'Sign in',
      invalidResetLink: 'Invalid reset link. Please request a new one.',
      requestNewLink: 'Request a new reset link',
      allFieldsRequired: 'Please fill in all fields',
      passwordTooShort: 'Password must be at least 8 characters',
      passwordsDoNotMatch: 'Passwords do not match',
      passwordResetSuccess: 'Password reset successful! Redirecting to login...',
      resetFailed: 'An error occurred. Please try again.',
      resetting: 'Resetting...',
      passwordRequirements: 'Password must be at least 8 characters',
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

// Mock the API functions
const mockResetPassword = jest.fn()

jest.mock('@/lib/api', () => ({
  authAPI: {
    resetPassword: (data: any) => mockResetPassword(data),
  },
}))

describe('ResetPasswordPage', () => {
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
  })

  describe('Without Token', () => {
    beforeEach(() => {
      mockSearchParams.get.mockReturnValue(null)
    })

    it('shows invalid link message when no token', () => {
      render(<ResetPasswordPage />)
      expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument()
    })

    it('shows request new link button', () => {
      render(<ResetPasswordPage />)
      expect(screen.getByText(/request a new reset link/i)).toBeInTheDocument()
    })

    it('does not show password form', () => {
      render(<ResetPasswordPage />)
      expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument()
    })
  })

  describe('With Token - Rendering', () => {
    beforeEach(() => {
      mockSearchParams.get.mockReturnValue('valid-token-123')
    })

    it('renders reset password heading', () => {
      render(<ResetPasswordPage />)
      expect(screen.getByText('Reset your password')).toBeInTheDocument()
    })

    it('renders new password input', () => {
      render(<ResetPasswordPage />)
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    })

    it('renders confirm password input', () => {
      render(<ResetPasswordPage />)
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    })

    it('renders reset password button', () => {
      render(<ResetPasswordPage />)
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
    })

    it('renders sign in link', () => {
      render(<ResetPasswordPage />)
      expect(screen.getByText(/sign in/i)).toBeInTheDocument()
    })

    it('renders password requirements hint', () => {
      render(<ResetPasswordPage />)
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })
  })

  describe('With Token - Form Validation', () => {
    beforeEach(() => {
      mockSearchParams.get.mockReturnValue('valid-token-123')
    })

    it('shows error when passwords are empty', async () => {
      render(<ResetPasswordPage />)

      const form = screen.getByRole('button', { name: /reset password/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument()
      })
    })

    it('shows error when password is too short', async () => {
      render(<ResetPasswordPage />)

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      await userEvent.type(passwordInput, 'short')
      await userEvent.type(confirmInput, 'short')

      const submitButton = screen.getByRole('button', { name: /reset password/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        // Check for the error message specifically (in the error alert)
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
      })
    })

    it('shows error when passwords do not match', async () => {
      render(<ResetPasswordPage />)

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      await userEvent.type(passwordInput, 'password123')
      await userEvent.type(confirmInput, 'differentpassword')

      const submitButton = screen.getByRole('button', { name: /reset password/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
      })
    })
  })

  describe('With Token - Submit Flow', () => {
    beforeEach(() => {
      mockSearchParams.get.mockReturnValue('valid-token-123')
    })

    it('calls resetPassword API with token and password', async () => {
      mockResetPassword.mockResolvedValue({ data: { message: 'Password reset' } })

      render(<ResetPasswordPage />)

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      await userEvent.type(passwordInput, 'newpassword123')
      await userEvent.type(confirmInput, 'newpassword123')

      const submitButton = screen.getByRole('button', { name: /reset password/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith({
          token: 'valid-token-123',
          new_password: 'newpassword123',
        })
      })
    })

    it('shows loading state during submission', async () => {
      mockResetPassword.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<ResetPasswordPage />)

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      await userEvent.type(passwordInput, 'newpassword123')
      await userEvent.type(confirmInput, 'newpassword123')

      const submitButton = screen.getByRole('button', { name: /reset password/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/resetting/i)).toBeInTheDocument()
      })
    })

    it('shows success message after successful reset', async () => {
      mockResetPassword.mockResolvedValue({ data: { message: 'Password reset' } })

      render(<ResetPasswordPage />)

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      await userEvent.type(passwordInput, 'newpassword123')
      await userEvent.type(confirmInput, 'newpassword123')

      const submitButton = screen.getByRole('button', { name: /reset password/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/password reset successful/i)).toBeInTheDocument()
      })
    })

    it('redirects to login after successful reset', async () => {
      mockResetPassword.mockResolvedValue({ data: { message: 'Password reset' } })

      render(<ResetPasswordPage />)

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      await userEvent.type(passwordInput, 'newpassword123')
      await userEvent.type(confirmInput, 'newpassword123')

      const submitButton = screen.getByRole('button', { name: /reset password/i })
      fireEvent.click(submitButton)

      // Wait for the redirect to be triggered (happens after 2 second timeout)
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login?reset=true')
      }, { timeout: 3000 })
    })
  })

  describe('With Token - Error Handling', () => {
    beforeEach(() => {
      mockSearchParams.get.mockReturnValue('valid-token-123')
    })

    it('shows error message on API failure', async () => {
      mockResetPassword.mockRejectedValue({
        response: { data: { detail: 'Invalid or expired token' } },
      })

      render(<ResetPasswordPage />)

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      await userEvent.type(passwordInput, 'newpassword123')
      await userEvent.type(confirmInput, 'newpassword123')

      const submitButton = screen.getByRole('button', { name: /reset password/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Invalid or expired token')).toBeInTheDocument()
      })
    })

    it('shows generic error on network failure', async () => {
      mockResetPassword.mockRejectedValue(new Error('Network error'))

      render(<ResetPasswordPage />)

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)
      await userEvent.type(passwordInput, 'newpassword123')
      await userEvent.type(confirmInput, 'newpassword123')

      const submitButton = screen.getByRole('button', { name: /reset password/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/an error occurred/i)).toBeInTheDocument()
      })
    })
  })
})
