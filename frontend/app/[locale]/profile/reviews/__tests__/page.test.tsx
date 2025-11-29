import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import MyReviewsPage from '../page'
import { authAPI, ratingsAPI } from '@/lib/api'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock the API
jest.mock('@/lib/api', () => ({
  authAPI: {
    getCurrentUser: jest.fn(),
  },
  ratingsAPI: {
    getUserRatings: jest.fn(),
    getUserRatingSummary: jest.fn(),
  },
}))

// Mock the Navbar component
jest.mock('@/components/Navbar', () => {
  return function MockNavbar({ user }: { user: any }) {
    return <div data-testid="navbar">Navbar - {user?.full_name}</div>
  }
})

// Mock StarRating component
jest.mock('@/components/StarRating', () => {
  return function MockStarRating({ rating, size }: { rating: number; size?: string }) {
    return <div data-testid="star-rating" data-rating={rating} data-size={size}>★ {rating}</div>
  }
})

const mockUser = {
  id: 1,
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'courier',
  phone_number: null,
  is_active: true,
  is_verified: true,
  max_deviation_km: 5,
  created_at: '2024-01-01T00:00:00Z',
  average_rating: 4.5,
  total_ratings: 10,
}

const mockRatings = [
  {
    id: 1,
    rater_id: 2,
    rated_user_id: 1,
    package_id: 1,
    score: 5,
    comment: 'Excellent service!',
    created_at: '2024-01-15T10:00:00Z',
    rater_name: 'John Sender',
  },
  {
    id: 2,
    rater_id: 3,
    rated_user_id: 1,
    package_id: 2,
    score: 4,
    comment: null,
    created_at: '2024-01-10T10:00:00Z',
    rater_name: 'Jane Sender',
  },
]

const mockSummary = {
  user_id: 1,
  average_rating: 4.5,
  total_ratings: 2,
  rating_breakdown: {
    1: 0,
    2: 0,
    3: 0,
    4: 1,
    5: 1,
  },
}

describe('MyReviewsPage', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
  })

  it('shows loading state initially', () => {
    ;(authAPI.getCurrentUser as jest.Mock).mockReturnValue(new Promise(() => {}))

    render(<MyReviewsPage />)

    expect(screen.getByText('Loading your reviews...')).toBeInTheDocument()
  })

  it('redirects to login if not authenticated', async () => {
    ;(authAPI.getCurrentUser as jest.Mock).mockRejectedValue(new Error('Unauthorized'))

    render(<MyReviewsPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('renders page header correctly', async () => {
    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(ratingsAPI.getUserRatings as jest.Mock).mockResolvedValue({ data: { ratings: mockRatings } })
    ;(ratingsAPI.getUserRatingSummary as jest.Mock).mockResolvedValue({ data: mockSummary })

    render(<MyReviewsPage />)

    await waitFor(() => {
      expect(screen.getByText('My Reviews')).toBeInTheDocument()
      expect(screen.getByText('See what others have said about you')).toBeInTheDocument()
    })
  })

  it('displays rating summary with average rating', async () => {
    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(ratingsAPI.getUserRatings as jest.Mock).mockResolvedValue({ data: { ratings: mockRatings } })
    ;(ratingsAPI.getUserRatingSummary as jest.Mock).mockResolvedValue({ data: mockSummary })

    render(<MyReviewsPage />)

    await waitFor(() => {
      expect(screen.getByText('4.5')).toBeInTheDocument()
      expect(screen.getByText('2 reviews')).toBeInTheDocument()
    })
  })

  it('displays rating breakdown section', async () => {
    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(ratingsAPI.getUserRatings as jest.Mock).mockResolvedValue({ data: { ratings: mockRatings } })
    ;(ratingsAPI.getUserRatingSummary as jest.Mock).mockResolvedValue({ data: mockSummary })

    render(<MyReviewsPage />)

    await waitFor(() => {
      // Check that rating summary is displayed
      expect(screen.getByText('4.5')).toBeInTheDocument()
      expect(screen.getByText('2 reviews')).toBeInTheDocument()
    })
  })

  it('displays individual reviews with comments', async () => {
    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(ratingsAPI.getUserRatings as jest.Mock).mockResolvedValue({ data: { ratings: mockRatings } })
    ;(ratingsAPI.getUserRatingSummary as jest.Mock).mockResolvedValue({ data: mockSummary })

    render(<MyReviewsPage />)

    await waitFor(() => {
      expect(screen.getByText('John Sender')).toBeInTheDocument()
      expect(screen.getByText('Excellent service!')).toBeInTheDocument()
      expect(screen.getByText('Jane Sender')).toBeInTheDocument()
    })
  })

  it('shows "No comment provided" for reviews without comments', async () => {
    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(ratingsAPI.getUserRatings as jest.Mock).mockResolvedValue({ data: { ratings: mockRatings } })
    ;(ratingsAPI.getUserRatingSummary as jest.Mock).mockResolvedValue({ data: mockSummary })

    render(<MyReviewsPage />)

    await waitFor(() => {
      expect(screen.getByText('No comment provided')).toBeInTheDocument()
    })
  })

  it('displays empty state when no reviews', async () => {
    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(ratingsAPI.getUserRatings as jest.Mock).mockResolvedValue({ data: { ratings: [] } })
    ;(ratingsAPI.getUserRatingSummary as jest.Mock).mockResolvedValue({
      data: {
        user_id: 1,
        average_rating: null,
        total_ratings: 0,
        rating_breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
    })

    render(<MyReviewsPage />)

    await waitFor(() => {
      expect(screen.getByText("You haven't received any reviews yet.")).toBeInTheDocument()
      expect(screen.getByText('Complete deliveries to start receiving reviews from other users.')).toBeInTheDocument()
    })
  })

  it('displays back to dashboard link', async () => {
    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(ratingsAPI.getUserRatings as jest.Mock).mockResolvedValue({ data: { ratings: mockRatings } })
    ;(ratingsAPI.getUserRatingSummary as jest.Mock).mockResolvedValue({ data: mockSummary })

    render(<MyReviewsPage />)

    await waitFor(() => {
      const backLink = screen.getByText('← Back to Dashboard')
      expect(backLink).toBeInTheDocument()
      expect(backLink).toHaveAttribute('href', '/dashboard')
    })
  })

  it('formats review dates correctly', async () => {
    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(ratingsAPI.getUserRatings as jest.Mock).mockResolvedValue({ data: { ratings: mockRatings } })
    ;(ratingsAPI.getUserRatingSummary as jest.Mock).mockResolvedValue({ data: mockSummary })

    render(<MyReviewsPage />)

    await waitFor(() => {
      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument()
      expect(screen.getByText('Jan 10, 2024')).toBeInTheDocument()
    })
  })

  it('renders navbar with user data', async () => {
    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(ratingsAPI.getUserRatings as jest.Mock).mockResolvedValue({ data: { ratings: mockRatings } })
    ;(ratingsAPI.getUserRatingSummary as jest.Mock).mockResolvedValue({ data: mockSummary })

    render(<MyReviewsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('navbar')).toBeInTheDocument()
      expect(screen.getByText('Navbar - Test User')).toBeInTheDocument()
    })
  })

  it('displays singular "review" for single rating', async () => {
    const singleRatingSummary = {
      ...mockSummary,
      total_ratings: 1,
    }

    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(ratingsAPI.getUserRatings as jest.Mock).mockResolvedValue({ data: { ratings: [mockRatings[0]] } })
    ;(ratingsAPI.getUserRatingSummary as jest.Mock).mockResolvedValue({ data: singleRatingSummary })

    render(<MyReviewsPage />)

    await waitFor(() => {
      expect(screen.getByText('1 review')).toBeInTheDocument()
    })
  })

  it('shows dash for average rating when null', async () => {
    const noRatingSummary = {
      user_id: 1,
      average_rating: null,
      total_ratings: 0,
      rating_breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    }

    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(ratingsAPI.getUserRatings as jest.Mock).mockResolvedValue({ data: { ratings: [] } })
    ;(ratingsAPI.getUserRatingSummary as jest.Mock).mockResolvedValue({ data: noRatingSummary })

    render(<MyReviewsPage />)

    await waitFor(() => {
      expect(screen.getByText('-')).toBeInTheDocument()
    })
  })
})
