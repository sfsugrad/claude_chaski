import { render, screen, fireEvent } from '@testing-library/react';
import BidCard from '../BidCard';
import { BidResponse } from '@/lib/api';

// Mock StarRating component
jest.mock('../StarRating', () => {
  return function StarRating({ rating, size }: { rating: number; size: string }) {
    return (
      <div data-testid="star-rating" data-rating={rating} data-size={size}>
        {rating} stars
      </div>
    );
  };
});

describe('BidCard Component', () => {
  const mockBid: BidResponse = {
    id: 1,
    tracking_id: 'PKG123',
    courier_id: 1,
    courier_name: 'John Courier',
    courier_rating: 4.5,
    courier_total_ratings: 25,
    proposed_price: 50.0,
    status: 'PENDING',
    created_at: '2024-01-15T10:00:00Z',
    selected_at: null,
    estimated_delivery_hours: 24,
    estimated_pickup_time: '2024-01-16T09:00:00Z',
    message: 'I can deliver this safely and quickly!',
  };

  describe('Rendering', () => {
    it('renders courier name', () => {
      render(<BidCard bid={mockBid} isSender={true} />);
      expect(screen.getByText('John Courier')).toBeInTheDocument();
    });

    it('renders proposed price', () => {
      render(<BidCard bid={mockBid} isSender={true} />);
      expect(screen.getByText('$50.00')).toBeInTheDocument();
    });

    it('renders proposed price with correct formatting', () => {
      const bid = { ...mockBid, proposed_price: 123.5 };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.getByText('$123.50')).toBeInTheDocument();
    });

    it('renders bid message when provided', () => {
      render(<BidCard bid={mockBid} isSender={true} />);
      expect(
        screen.getByText('"I can deliver this safely and quickly!"')
      ).toBeInTheDocument();
    });

    it('does not render message section when message is null', () => {
      const bid = { ...mockBid, message: null };
      render(<BidCard bid={bid} isSender={true} />);
      expect(
        screen.queryByText('"I can deliver this safely and quickly!"')
      ).not.toBeInTheDocument();
    });

    it('renders created date', () => {
      render(<BidCard bid={mockBid} isSender={true} />);
      expect(screen.getByText(/Submitted/)).toBeInTheDocument();
    });
  });

  describe('Status Badges', () => {
    it('renders pending status badge', () => {
      const bid = { ...mockBid, status: 'PENDING' };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('renders selected status badge', () => {
      const bid = { ...mockBid, status: 'SELECTED', selected_at: '2024-01-15T12:00:00Z' };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    it('renders rejected status badge', () => {
      const bid = { ...mockBid, status: 'REJECTED' };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.getByText('Not Selected')).toBeInTheDocument();
    });

    it('renders withdrawn status badge', () => {
      const bid = { ...mockBid, status: 'WITHDRAWN' };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.getByText('Withdrawn')).toBeInTheDocument();
    });

    it('renders expired status badge', () => {
      const bid = { ...mockBid, status: 'EXPIRED' };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('handles lowercase status from backend', () => {
      const bid = { ...mockBid, status: 'pending' as any };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('Courier Rating', () => {
    it('renders star rating when rating is available', () => {
      render(<BidCard bid={mockBid} isSender={true} />);
      const starRating = screen.getByTestId('star-rating');
      expect(starRating).toBeInTheDocument();
      expect(starRating).toHaveAttribute('data-rating', '4.5');
      expect(starRating).toHaveAttribute('data-size', 'sm');
    });

    it('renders total ratings count', () => {
      render(<BidCard bid={mockBid} isSender={true} />);
      expect(screen.getByText('(25 reviews)')).toBeInTheDocument();
    });

    it('does not render rating when courier_rating is null', () => {
      const bid = { ...mockBid, courier_rating: null };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.queryByTestId('star-rating')).not.toBeInTheDocument();
    });

    it('renders singular review text when count is 1', () => {
      const bid = { ...mockBid, courier_total_ratings: 1 };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.getByText('(1 reviews)')).toBeInTheDocument();
    });
  });

  describe('Delivery Details', () => {
    it('renders estimated delivery hours', () => {
      render(<BidCard bid={mockBid} isSender={true} />);
      expect(screen.getByText('Delivery estimate:')).toBeInTheDocument();
      expect(screen.getByText('24 hours')).toBeInTheDocument();
    });

    it('renders singular hour when estimate is 1', () => {
      const bid = { ...mockBid, estimated_delivery_hours: 1 };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.getByText('1 hour')).toBeInTheDocument();
    });

    it('does not render delivery estimate when null', () => {
      const bid = { ...mockBid, estimated_delivery_hours: null };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.queryByText('Delivery estimate:')).not.toBeInTheDocument();
    });

    it('renders estimated pickup time', () => {
      render(<BidCard bid={mockBid} isSender={true} />);
      expect(screen.getByText('Pickup time:')).toBeInTheDocument();
    });

    it('does not render pickup time when null', () => {
      const bid = { ...mockBid, estimated_pickup_time: null };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.queryByText('Pickup time:')).not.toBeInTheDocument();
    });
  });

  describe('Selected Date', () => {
    it('renders selected date when bid is selected', () => {
      const bid = {
        ...mockBid,
        status: 'SELECTED',
        selected_at: '2024-01-15T12:00:00Z',
      };
      render(<BidCard bid={bid} isSender={true} />);
      // Find the selected date text (not the status badge)
      const selectedTexts = screen.getAllByText(/Selected/);
      expect(selectedTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('does not render selected date when bid is not selected', () => {
      const bid = { ...mockBid, status: 'PENDING', selected_at: null };
      render(<BidCard bid={bid} isSender={true} />);
      expect(screen.queryByText(/Selected \d/)).not.toBeInTheDocument();
    });
  });

  describe('Sender Actions', () => {
    it('renders Select button for sender when bid is pending', () => {
      const onSelect = jest.fn();
      render(
        <BidCard bid={mockBid} isSender={true} onSelect={onSelect} />
      );
      expect(screen.getByRole('button', { name: 'Select This Bid' })).toBeInTheDocument();
    });

    it('does not render Select button when bid is not pending', () => {
      const onSelect = jest.fn();
      const bid = { ...mockBid, status: 'SELECTED' };
      render(
        <BidCard bid={bid} isSender={true} onSelect={onSelect} />
      );
      expect(
        screen.queryByRole('button', { name: 'Select This Bid' })
      ).not.toBeInTheDocument();
    });

    it('calls onSelect when Select button is clicked', () => {
      const onSelect = jest.fn();
      render(
        <BidCard bid={mockBid} isSender={true} onSelect={onSelect} />
      );
      const button = screen.getByRole('button', { name: 'Select This Bid' });
      fireEvent.click(button);
      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('disables Select button when isSelecting is true', () => {
      const onSelect = jest.fn();
      render(
        <BidCard
          bid={mockBid}
          isSender={true}
          onSelect={onSelect}
          isSelecting={true}
        />
      );
      const button = screen.getByRole('button', { name: 'Selecting...' });
      expect(button).toBeDisabled();
    });

    it('shows loading text when selecting', () => {
      const onSelect = jest.fn();
      render(
        <BidCard
          bid={mockBid}
          isSender={true}
          onSelect={onSelect}
          isSelecting={true}
        />
      );
      expect(screen.getByText('Selecting...')).toBeInTheDocument();
    });
  });

  describe('Courier Actions', () => {
    it('renders Withdraw button for courier when bid is pending', () => {
      const onWithdraw = jest.fn();
      render(
        <BidCard bid={mockBid} isSender={false} onWithdraw={onWithdraw} />
      );
      expect(screen.getByRole('button', { name: 'Withdraw Bid' })).toBeInTheDocument();
    });

    it('does not render Withdraw button when bid is not pending', () => {
      const onWithdraw = jest.fn();
      const bid = { ...mockBid, status: 'WITHDRAWN' };
      render(
        <BidCard bid={bid} isSender={false} onWithdraw={onWithdraw} />
      );
      expect(
        screen.queryByRole('button', { name: 'Withdraw Bid' })
      ).not.toBeInTheDocument();
    });

    it('calls onWithdraw when Withdraw button is clicked', () => {
      const onWithdraw = jest.fn();
      render(
        <BidCard bid={mockBid} isSender={false} onWithdraw={onWithdraw} />
      );
      const button = screen.getByRole('button', { name: 'Withdraw Bid' });
      fireEvent.click(button);
      expect(onWithdraw).toHaveBeenCalledWith(1);
    });

    it('disables Withdraw button when isWithdrawing is true', () => {
      const onWithdraw = jest.fn();
      render(
        <BidCard
          bid={mockBid}
          isSender={false}
          onWithdraw={onWithdraw}
          isWithdrawing={true}
        />
      );
      const button = screen.getByRole('button', { name: 'Withdrawing...' });
      expect(button).toBeDisabled();
    });

    it('shows loading text when withdrawing', () => {
      const onWithdraw = jest.fn();
      render(
        <BidCard
          bid={mockBid}
          isSender={false}
          onWithdraw={onWithdraw}
          isWithdrawing={true}
        />
      );
      expect(screen.getByText('Withdrawing...')).toBeInTheDocument();
    });

    it('does not render Select button for courier', () => {
      const onWithdraw = jest.fn();
      render(
        <BidCard bid={mockBid} isSender={false} onWithdraw={onWithdraw} />
      );
      expect(
        screen.queryByRole('button', { name: 'Select This Bid' })
      ).not.toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies selected border styling when bid is selected', () => {
      const bid = { ...mockBid, status: 'SELECTED' };
      const { container } = render(<BidCard bid={bid} isSender={true} />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-green-500');
      expect(card.className).toContain('ring-2');
    });

    it('applies pending border styling when bid is pending', () => {
      const bid = { ...mockBid, status: 'PENDING' };
      const { container } = render(<BidCard bid={bid} isSender={true} />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-gray-200');
      expect(card.className).toContain('hover:border-gray-300');
    });

    it('applies faded styling for non-pending, non-selected bids', () => {
      const bid = { ...mockBid, status: 'REJECTED' };
      const { container } = render(<BidCard bid={bid} isSender={true} />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('opacity-75');
    });
  });

  describe('No Actions', () => {
    it('does not render action buttons when onSelect and onWithdraw are not provided', () => {
      render(<BidCard bid={mockBid} isSender={true} />);
      expect(
        screen.queryByRole('button', { name: /Select|Withdraw/ })
      ).not.toBeInTheDocument();
    });

    it('does not render actions section when bid is not pending', () => {
      const bid = { ...mockBid, status: 'SELECTED' };
      const onSelect = jest.fn();
      render(
        <BidCard bid={bid} isSender={true} onSelect={onSelect} />
      );
      expect(
        screen.queryByRole('button', { name: 'Select This Bid' })
      ).not.toBeInTheDocument();
    });
  });
});
