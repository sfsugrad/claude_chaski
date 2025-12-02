import { render, screen, fireEvent } from '@testing-library/react'
import StarRating from '../StarRating'

describe('StarRating', () => {
  describe('Display mode (non-interactive)', () => {
    it('renders with default props', () => {
      render(<StarRating />)
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(5)
    })

    it('displays the correct number of filled stars for rating', () => {
      const { container } = render(<StarRating rating={3} />)
      const filledStars = container.querySelectorAll('.fill-yellow-400')
      expect(filledStars).toHaveLength(3)
    })

    it('displays rating value when showValue is true', () => {
      render(<StarRating rating={4.5} showValue />)
      expect(screen.getByText('4.5')).toBeInTheDocument()
    })

    it('displays total ratings count when provided', () => {
      render(<StarRating rating={4.5} showValue totalRatings={10} />)
      expect(screen.getByText('(10)')).toBeInTheDocument()
    })

    it('shows "No ratings" when rating is 0 and showValue is true', () => {
      render(<StarRating rating={0} showValue />)
      expect(screen.getByText('No ratings')).toBeInTheDocument()
    })

    it('renders correct number of stars for custom maxRating', () => {
      render(<StarRating maxRating={10} />)
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(10)
    })

    it('applies correct size classes for sm size', () => {
      const { container } = render(<StarRating size="sm" />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('w-4', 'h-4')
    })

    it('applies correct size classes for md size', () => {
      const { container } = render(<StarRating size="md" />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('w-6', 'h-6')
    })

    it('applies correct size classes for lg size', () => {
      const { container } = render(<StarRating size="lg" />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('w-8', 'h-8')
    })

    it('buttons are disabled when not interactive', () => {
      render(<StarRating rating={3} />)
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })
  })

  describe('Interactive mode', () => {
    it('buttons are enabled when interactive', () => {
      render(<StarRating interactive />)
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).not.toBeDisabled()
      })
    })

    it('calls onRatingChange when star is clicked', () => {
      const mockOnChange = jest.fn()
      render(<StarRating interactive onRatingChange={mockOnChange} />)

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[3]) // Click 4th star

      expect(mockOnChange).toHaveBeenCalledWith(4)
    })

    it('updates display on hover', () => {
      const { container } = render(<StarRating interactive />)
      const buttons = screen.getAllByRole('button')

      fireEvent.mouseEnter(buttons[4]) // Hover 5th star

      const filledStars = container.querySelectorAll('.fill-yellow-400')
      expect(filledStars).toHaveLength(5)
    })

    it('resets display on mouse leave', () => {
      const { container } = render(<StarRating interactive rating={2} />)
      const buttons = screen.getAllByRole('button')

      // Hover over 5th star
      fireEvent.mouseEnter(buttons[4])
      let filledStars = container.querySelectorAll('.fill-yellow-400')
      expect(filledStars).toHaveLength(5)

      // Leave hover
      fireEvent.mouseLeave(buttons[4])
      filledStars = container.querySelectorAll('.fill-yellow-400')
      expect(filledStars).toHaveLength(2)
    })

    it('maintains selected rating after clicking', () => {
      const { container } = render(<StarRating interactive />)
      const buttons = screen.getAllByRole('button')

      fireEvent.click(buttons[2]) // Click 3rd star

      const filledStars = container.querySelectorAll('.fill-yellow-400')
      expect(filledStars).toHaveLength(3)
    })
  })

  describe('Accessibility', () => {
    it('has correct aria-labels for each star', () => {
      render(<StarRating />)

      expect(screen.getByLabelText('1 star')).toBeInTheDocument()
      expect(screen.getByLabelText('2 stars')).toBeInTheDocument()
      expect(screen.getByLabelText('3 stars')).toBeInTheDocument()
      expect(screen.getByLabelText('4 stars')).toBeInTheDocument()
      expect(screen.getByLabelText('5 stars')).toBeInTheDocument()
    })
  })
})
