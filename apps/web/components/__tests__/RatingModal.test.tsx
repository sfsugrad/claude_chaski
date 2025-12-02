import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import RatingModal from '../RatingModal'
import { ratingsAPI } from '@/lib/api'

// Mock the API
jest.mock('@/lib/api', () => ({
  ratingsAPI: {
    create: jest.fn(),
  },
}))

const mockPendingRating = {
  package_id: 1,
  package_description: 'Test Package',
  delivery_time: '2024-01-15T10:00:00Z',
  user_to_rate_id: 2,
  user_to_rate_name: 'John Doe',
  user_to_rate_role: 'courier' as const,
}

describe('RatingModal', () => {
  const mockOnClose = jest.fn()
  const mockOnRatingSubmitted = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not render when isOpen is false', () => {
    render(
      <RatingModal
        isOpen={false}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    expect(screen.queryByText('Rate Your Experience')).not.toBeInTheDocument()
  })

  it('renders when isOpen is true', () => {
    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    expect(screen.getByText('Rate Your Experience')).toBeInTheDocument()
  })

  it('displays the user to rate info', () => {
    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText(/as a courier/i)).toBeInTheDocument()
  })

  it('displays the package description', () => {
    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    expect(screen.getByText('Package: Test Package')).toBeInTheDocument()
  })

  it('has disabled submit button preventing submission without rating', () => {
    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    // Submit button is disabled when no rating selected
    const submitButton = screen.getByText('Submit Rating')
    expect(submitButton).toBeDisabled()
  })

  it('calls onClose when Skip button is clicked', async () => {
    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByText('Skip'))
    })

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('calls onClose when X button is clicked', async () => {
    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Close'))
    })

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('submits rating successfully', async () => {
    (ratingsAPI.create as jest.Mock).mockResolvedValueOnce({ data: { id: 1 } })

    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    // Select 5 stars
    const stars = screen.getAllByRole('button').filter(btn => btn.getAttribute('aria-label')?.includes('star'))
    await act(async () => {
      fireEvent.click(stars[4]) // Click 5th star
    })

    // Add comment
    const commentInput = screen.getByPlaceholderText('Share your experience...')
    await act(async () => {
      fireEvent.change(commentInput, { target: { value: 'Great service!' } })
    })

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByText('Submit Rating'))
    })

    await waitFor(() => {
      expect(ratingsAPI.create).toHaveBeenCalledWith({
        package_id: 1,
        score: 5,
        comment: 'Great service!',
      })
      expect(mockOnRatingSubmitted).toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('submits rating without comment', async () => {
    (ratingsAPI.create as jest.Mock).mockResolvedValueOnce({ data: { id: 1 } })

    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    // Select 4 stars
    const stars = screen.getAllByRole('button').filter(btn => btn.getAttribute('aria-label')?.includes('star'))
    await act(async () => {
      fireEvent.click(stars[3]) // Click 4th star
    })

    // Submit without comment
    await act(async () => {
      fireEvent.click(screen.getByText('Submit Rating'))
    })

    await waitFor(() => {
      expect(ratingsAPI.create).toHaveBeenCalledWith({
        package_id: 1,
        score: 4,
        comment: undefined,
      })
    })
  })

  it('shows error message on API failure', async () => {
    (ratingsAPI.create as jest.Mock).mockRejectedValueOnce({
      response: { data: { detail: 'Rating failed' } },
    })

    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    // Select a rating
    const stars = screen.getAllByRole('button').filter(btn => btn.getAttribute('aria-label')?.includes('star'))
    await act(async () => {
      fireEvent.click(stars[2]) // Click 3rd star
    })

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByText('Submit Rating'))
    })

    await waitFor(() => {
      expect(screen.getByText('Rating failed')).toBeInTheDocument()
    })
  })

  it('shows generic error on API failure without detail', async () => {
    (ratingsAPI.create as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    // Select a rating
    const stars = screen.getAllByRole('button').filter(btn => btn.getAttribute('aria-label')?.includes('star'))
    await act(async () => {
      fireEvent.click(stars[2])
    })

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByText('Submit Rating'))
    })

    await waitFor(() => {
      expect(screen.getByText('Failed to submit rating')).toBeInTheDocument()
    })
  })

  it('displays character count for comment', async () => {
    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    const commentInput = screen.getByPlaceholderText('Share your experience...')
    await act(async () => {
      fireEvent.change(commentInput, { target: { value: 'Hello' } })
    })

    expect(screen.getByText('5/1000')).toBeInTheDocument()
  })

  it('works with sender role', () => {
    const senderPending = {
      ...mockPendingRating,
      user_to_rate_role: 'sender' as const,
    }

    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={senderPending}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    expect(screen.getByText(/as a sender/i)).toBeInTheDocument()
  })

  it('enables submit button when rating is selected', async () => {
    render(
      <RatingModal
        isOpen={true}
        onClose={mockOnClose}
        pendingRating={mockPendingRating}
        onRatingSubmitted={mockOnRatingSubmitted}
      />
    )

    const stars = screen.getAllByRole('button').filter(btn => btn.getAttribute('aria-label')?.includes('star'))
    await act(async () => {
      fireEvent.click(stars[2])
    })

    const submitButton = screen.getByText('Submit Rating')
    expect(submitButton).not.toBeDisabled()
  })
})
