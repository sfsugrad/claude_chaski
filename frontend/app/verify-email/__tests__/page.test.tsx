import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { useRouter, useSearchParams } from 'next/navigation'
import VerifyEmailPage from '../page'
import axios from 'axios'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))

// Mock axios
jest.mock('axios')

describe('VerifyEmailPage', () => {
  const mockPush = jest.fn()
  const mockGet = jest.fn()
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
    jest.useFakeTimers()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouterReturn)
    ;(axios.get as jest.Mock) = mockGet
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('Page Rendering', () => {
    it('renders the email verification page', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-token'),
      })

      render(<VerifyEmailPage />)

      expect(screen.getByText('Email Verification')).toBeInTheDocument()
    })

    it('shows loading state initially', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-token'),
      })
      mockGet.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { container } = render(<VerifyEmailPage />)

      expect(screen.getByText('Verifying your email...')).toBeInTheDocument()
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveClass('rounded-full', 'h-12', 'w-12', 'border-b-2', 'border-blue-600')
    })
  })

  describe('Token Validation', () => {
    it('shows error when token is missing', async () => {
      ;(useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue(null),
      })

      render(<VerifyEmailPage />)

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument()
        expect(screen.getByText('Invalid verification link')).toBeInTheDocument()
      })

      expect(mockGet).not.toHaveBeenCalled()
    })

    it('calls API with correct token', async () => {
      const testToken = 'test-verification-token-123'
      ;(useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue(testToken),
      })
      mockGet.mockResolvedValue({ data: { message: 'Email verified' } })

      render(<VerifyEmailPage />)

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          `http://localhost:8000/api/auth/verify-email/${testToken}`
        )
      })
    })
  })

  describe('Verification Success Flow', () => {
    beforeEach(() => {
      ;(useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('valid-token'),
      })
    })

    it('shows success message on successful verification', async () => {
      mockGet.mockResolvedValue({ data: { message: 'Email verified' } })

      render(<VerifyEmailPage />)

      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument()
        expect(
          screen.getByText('Your email has been verified successfully!')
        ).toBeInTheDocument()
      })
    })

    it('shows success icon on successful verification', async () => {
      mockGet.mockResolvedValue({ data: { message: 'Email verified' } })

      const { container } = render(<VerifyEmailPage />)

      await waitFor(() => {
        const successIconContainer = container.querySelector('.bg-green-100')
        expect(successIconContainer).toBeInTheDocument()
        expect(successIconContainer).toHaveClass('rounded-full', 'h-12', 'w-12')
      })
    })

    it('redirects to login page after 3 seconds', async () => {
      mockGet.mockResolvedValue({ data: { message: 'Email verified' } })

      render(<VerifyEmailPage />)

      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument()
      })

      expect(mockPush).not.toHaveBeenCalled()

      // Fast-forward 3 seconds
      jest.advanceTimersByTime(3000)

      expect(mockPush).toHaveBeenCalledWith('/login?verified=true')
    })

    it('shows redirect message during countdown', async () => {
      mockGet.mockResolvedValue({ data: { message: 'Email verified' } })

      render(<VerifyEmailPage />)

      await waitFor(() => {
        expect(
          screen.getByText('Redirecting to login page...')
        ).toBeInTheDocument()
      })
    })
  })

  describe('Verification Error Flow', () => {
    beforeEach(() => {
      ;(useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('invalid-token'),
      })
    })

    it('shows error message when API returns error with detail', async () => {
      const errorMessage = 'Invalid or expired verification token'
      mockGet.mockRejectedValue({
        response: {
          data: {
            detail: errorMessage,
          },
        },
      })

      render(<VerifyEmailPage />)

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument()
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('shows generic error message when API returns error without detail', async () => {
      mockGet.mockRejectedValue(new Error('Network error'))

      render(<VerifyEmailPage />)

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument()
        expect(
          screen.getByText(
            'Email verification failed. The link may be invalid or expired.'
          )
        ).toBeInTheDocument()
      })
    })

    it('shows error icon on failed verification', async () => {
      mockGet.mockRejectedValue(new Error('Network error'))

      const { container } = render(<VerifyEmailPage />)

      await waitFor(() => {
        const errorIconContainer = container.querySelector('.bg-red-100')
        expect(errorIconContainer).toBeInTheDocument()
        expect(errorIconContainer).toHaveClass('rounded-full', 'h-12', 'w-12')
      })
    })

    it('shows links to login and register on error', async () => {
      mockGet.mockRejectedValue(new Error('Network error'))

      render(<VerifyEmailPage />)

      await waitFor(() => {
        const loginLink = screen.getByText('Go to Login')
        const registerLink = screen.getByText('Register Again')

        expect(loginLink).toBeInTheDocument()
        expect(loginLink.closest('a')).toHaveAttribute('href', '/login')

        expect(registerLink).toBeInTheDocument()
        expect(registerLink.closest('a')).toHaveAttribute('href', '/register')
      })
    })

    it('does not redirect on error', async () => {
      mockGet.mockRejectedValue(new Error('Network error'))

      render(<VerifyEmailPage />)

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument()
      })

      jest.advanceTimersByTime(5000)

      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Prevent Double API Call (StrictMode)', () => {
    it('calls verification API only once despite StrictMode double render', async () => {
      ;(useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-token'),
      })
      mockGet.mockResolvedValue({ data: { message: 'Email verified' } })

      // Simulate StrictMode by rendering twice
      const { rerender } = render(<VerifyEmailPage />)
      rerender(<VerifyEmailPage />)

      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument()
      })

      // Verify API was called exactly once
      expect(mockGet).toHaveBeenCalledTimes(1)
    })

    it('prevents duplicate API calls with useRef guard', async () => {
      const testToken = 'test-token-123'
      ;(useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue(testToken),
      })

      let callCount = 0
      mockGet.mockImplementation(() => {
        callCount++
        return Promise.resolve({ data: { message: 'Email verified' } })
      })

      render(<VerifyEmailPage />)

      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument()
      })

      // Ensure only one API call was made
      expect(callCount).toBe(1)
      expect(mockGet).toHaveBeenCalledTimes(1)
    })
  })

  describe('API Response Handling', () => {
    beforeEach(() => {
      ;(useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-token'),
      })
    })

    it('handles 400 Bad Request error', async () => {
      mockGet.mockRejectedValue({
        response: {
          status: 400,
          data: {
            detail: 'Email already verified',
          },
        },
      })

      render(<VerifyEmailPage />)

      await waitFor(() => {
        expect(screen.getByText('Email already verified')).toBeInTheDocument()
      })
    })

    it('handles 404 Not Found error', async () => {
      mockGet.mockRejectedValue({
        response: {
          status: 404,
          data: {
            detail: 'Verification token not found',
          },
        },
      })

      render(<VerifyEmailPage />)

      await waitFor(() => {
        expect(
          screen.getByText('Verification token not found')
        ).toBeInTheDocument()
      })
    })

    it('handles network timeout', async () => {
      mockGet.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      })

      render(<VerifyEmailPage />)

      await waitFor(() => {
        expect(
          screen.getByText(
            'Email verification failed. The link may be invalid or expired.'
          )
        ).toBeInTheDocument()
      })
    })
  })

  describe('Loading State Management', () => {
    it('transitions from loading to success', async () => {
      ;(useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-token'),
      })
      mockGet.mockResolvedValue({ data: { message: 'Email verified' } })

      render(<VerifyEmailPage />)

      expect(screen.getByText('Verifying your email...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument()
        expect(
          screen.queryByText('Verifying your email...')
        ).not.toBeInTheDocument()
      })
    })

    it('transitions from loading to error', async () => {
      ;(useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-token'),
      })
      mockGet.mockRejectedValue(new Error('Network error'))

      render(<VerifyEmailPage />)

      expect(screen.getByText('Verifying your email...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument()
        expect(
          screen.queryByText('Verifying your email...')
        ).not.toBeInTheDocument()
      })
    })
  })
})
