import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import BidsList from '../BidsList';
import { bidsAPI, PackageBidsResponse, BidResponse } from '@/lib/api';

// Mock the dependencies
jest.mock('@/lib/api', () => ({
  bidsAPI: {
    getPackageBids: jest.fn(),
    select: jest.fn(),
    withdraw: jest.fn(),
  },
}));

jest.mock('../BidCard', () => {
  return function BidCard({ bid, isSender, onSelect, onWithdraw, isSelecting, isWithdrawing }: any) {
    return (
      <div data-testid={`bid-card-${bid.id}`}>
        <div>{bid.courier_name}</div>
        <div>${bid.proposed_price}</div>
        <div>Status: {bid.status}</div>
        {onSelect && (
          <button onClick={() => onSelect(bid.id)} disabled={isSelecting}>
            {isSelecting ? 'Selecting...' : 'Select'}
          </button>
        )}
        {onWithdraw && (
          <button onClick={() => onWithdraw(bid.id)} disabled={isWithdrawing}>
            {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
          </button>
        )}
      </div>
    );
  };
});

jest.mock('../CountdownTimer', () => {
  return function CountdownTimer({ deadline, onExpire }: { deadline: string; onExpire: () => void }) {
    return (
      <div data-testid="countdown-timer" data-deadline={deadline}>
        Countdown: {deadline}
        <button onClick={onExpire}>Expire</button>
      </div>
    );
  };
});

describe('BidsList Component', () => {
  const mockBid1: BidResponse = {
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
    estimated_pickup_time: null,
    message: null,
  };

  const mockBid2: BidResponse = {
    ...mockBid1,
    id: 2,
    courier_name: 'Jane Courier',
    proposed_price: 45.0,
  };

  const mockBidsResponse: PackageBidsResponse = {
    package_id: 1,
    tracking_id: 'PKG123',
    bid_count: 2,
    bid_deadline: '2024-01-20T10:00:00Z',
    bids: [mockBid1, mockBid2],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Mock window.confirm and window.alert
    global.confirm = jest.fn(() => true);
    global.alert = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Loading State', () => {
    it('shows loading skeleton initially', () => {
      (bidsAPI.getPackageBids as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<BidsList trackingId="PKG123" isSender={true} />);

      const skeletons = document.querySelectorAll('.animate-pulse .h-32');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API call fails', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockRejectedValue({
        response: { data: { detail: 'Package not found' } },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByText('Package not found')).toBeInTheDocument();
      });
    });

    it('displays generic error when API error has no detail', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockRejectedValue({
        response: { data: {} },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load bids')).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockRejectedValue({
        response: { data: { detail: 'Network error' } },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });
    });

    it('retries fetch when retry button is clicked', async () => {
      (bidsAPI.getPackageBids as jest.Mock)
        .mockRejectedValueOnce({ response: { data: { detail: 'Error' } } })
        .mockResolvedValueOnce({ data: mockBidsResponse });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: 'Retry' });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Bids (2)')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no bids', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: { ...mockBidsResponse, bid_count: 0, bids: [] },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByText('No bids yet')).toBeInTheDocument();
      });
    });

    it('shows encouragement text for couriers in empty state', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: { ...mockBidsResponse, bid_count: 0, bids: [] },
      });

      render(<BidsList trackingId="PKG123" isSender={false} />);

      await waitFor(() => {
        expect(screen.getByText('Be the first to place a bid!')).toBeInTheDocument();
      });
    });

    it('does not show encouragement text for senders', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: { ...mockBidsResponse, bid_count: 0, bids: [] },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.queryByText('Be the first to place a bid!')).not.toBeInTheDocument();
      });
    });
  });

  describe('Bids Display', () => {
    it('renders bid cards for all bids', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('bid-card-1')).toBeInTheDocument();
        expect(screen.getByTestId('bid-card-2')).toBeInTheDocument();
      });
    });

    it('displays correct bid count', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByText('Bids (2)')).toBeInTheDocument();
      });
    });

    it('displays pending bids count', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByText('2 pending bids')).toBeInTheDocument();
      });
    });

    it('uses singular form for 1 pending bid', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: { ...mockBidsResponse, bids: [mockBid1] },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByText('1 pending bid')).toBeInTheDocument();
      });
    });
  });

  describe('Countdown Timer', () => {
    it('displays countdown timer when deadline exists and no bid selected', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        const timer = screen.getByTestId('countdown-timer');
        expect(timer).toBeInTheDocument();
        expect(timer).toHaveAttribute('data-deadline', '2024-01-20T10:00:00Z');
      });
    });

    it('does not display countdown when bid is selected', async () => {
      const selectedBid = { ...mockBid1, status: 'SELECTED', selected_at: '2024-01-16T10:00:00Z' };
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: { ...mockBidsResponse, bids: [selectedBid] },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.queryByTestId('countdown-timer')).not.toBeInTheDocument();
      });
    });

    it('refreshes bids when countdown expires', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();
      });

      // Clear the initial calls
      (bidsAPI.getPackageBids as jest.Mock).mockClear();

      const expireButton = screen.getByRole('button', { name: 'Expire' });
      fireEvent.click(expireButton);

      await waitFor(() => {
        expect(bidsAPI.getPackageBids).toHaveBeenCalledWith('PKG123');
      });
    });
  });

  describe('Selected Bid Highlight', () => {
    it('displays selected bid in highlight section', async () => {
      const selectedBid = { ...mockBid1, status: 'SELECTED', selected_at: '2024-01-16T10:00:00Z' };
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: { ...mockBidsResponse, bids: [selectedBid, mockBid2] },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByText('Courier Selected')).toBeInTheDocument();
        expect(screen.getByTestId('bid-card-1')).toBeInTheDocument();
      });
    });

    it('hides pending bids when bid is selected', async () => {
      const selectedBid = { ...mockBid1, status: 'SELECTED', selected_at: '2024-01-16T10:00:00Z' };
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: { ...mockBidsResponse, bids: [selectedBid, mockBid2] },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('bid-card-1')).toBeInTheDocument();
        // Pending bid 2 should not be in main list
        expect(screen.queryByText('2 pending bids')).not.toBeInTheDocument();
      });
    });
  });

  describe('Bid Sorting', () => {
    it('sorts bids with selected first, then pending by price', async () => {
      const selectedBid = { ...mockBid1, id: 3, status: 'SELECTED', proposed_price: 60 };
      const pendingBid1 = { ...mockBid1, id: 1, status: 'PENDING', proposed_price: 50 };
      const pendingBid2 = { ...mockBid1, id: 2, status: 'PENDING', proposed_price: 45 };
      const rejectedBid = { ...mockBid1, id: 4, status: 'REJECTED', proposed_price: 40 };

      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: {
          ...mockBidsResponse,
          bids: [rejectedBid, pendingBid1, selectedBid, pendingBid2],
        },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        // Selected bid should be shown first in highlight
        expect(screen.getByText('Courier Selected')).toBeInTheDocument();
      });
    });
  });

  describe('Bid Selection (Sender)', () => {
    it('shows select buttons for sender on pending bids', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        const selectButtons = screen.getAllByRole('button', { name: 'Select' });
        expect(selectButtons.length).toBe(2);
      });
    });

    it('does not show select buttons for courier', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });

      render(<BidsList trackingId="PKG123" isSender={false} />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
      });
    });

    it('asks for confirmation before selecting bid', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });
      (bidsAPI.select as jest.Mock).mockResolvedValue({});

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Select' }).length).toBeGreaterThan(0);
      });

      const selectButtons = screen.getAllByRole('button', { name: 'Select' });
      fireEvent.click(selectButtons[0]);

      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to select this bid? Other bids will be rejected.'
      );
    });

    it('calls select API when confirmed', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });
      (bidsAPI.select as jest.Mock).mockResolvedValue({});

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Select' }).length).toBeGreaterThan(0);
      });

      const selectButtons = screen.getAllByRole('button', { name: 'Select' });
      fireEvent.click(selectButtons[0]);

      await waitFor(() => {
        expect(bidsAPI.select).toHaveBeenCalledWith(1);
      });
    });

    it('does not call select API when cancelled', async () => {
      global.confirm = jest.fn(() => false);

      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Select' }).length).toBeGreaterThan(0);
      });

      const selectButtons = screen.getAllByRole('button', { name: 'Select' });
      fireEvent.click(selectButtons[0]);

      expect(bidsAPI.select).not.toHaveBeenCalled();
    });

    it('refreshes bids after successful selection', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });
      (bidsAPI.select as jest.Mock).mockResolvedValue({});

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Select' }).length).toBeGreaterThan(0);
      });

      // Clear initial calls
      (bidsAPI.getPackageBids as jest.Mock).mockClear();

      const selectButtons = screen.getAllByRole('button', { name: 'Select' });
      fireEvent.click(selectButtons[0]);

      await waitFor(() => {
        expect(bidsAPI.getPackageBids).toHaveBeenCalledWith('PKG123');
      });
    });

    it('calls onBidSelected callback after selection', async () => {
      const onBidSelected = jest.fn();

      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });
      (bidsAPI.select as jest.Mock).mockResolvedValue({});

      render(
        <BidsList trackingId="PKG123" isSender={true} onBidSelected={onBidSelected} />
      );

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Select' }).length).toBeGreaterThan(0);
      });

      const selectButtons = screen.getAllByRole('button', { name: 'Select' });
      fireEvent.click(selectButtons[0]);

      await waitFor(() => {
        expect(onBidSelected).toHaveBeenCalled();
      });
    });

    it('shows error alert when selection fails', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });
      (bidsAPI.select as jest.Mock).mockRejectedValue({
        response: { data: { detail: 'Bid already selected' } },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Select' }).length).toBeGreaterThan(0);
      });

      const selectButtons = screen.getAllByRole('button', { name: 'Select' });
      fireEvent.click(selectButtons[0]);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Bid already selected');
      });
    });
  });

  describe('Bid Withdrawal (Courier)', () => {
    it('shows withdraw buttons for courier on pending bids', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });

      render(<BidsList trackingId="PKG123" isSender={false} />);

      await waitFor(() => {
        const withdrawButtons = screen.getAllByRole('button', { name: 'Withdraw' });
        expect(withdrawButtons.length).toBe(2);
      });
    });

    it('asks for confirmation before withdrawing bid', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });
      (bidsAPI.withdraw as jest.Mock).mockResolvedValue({});

      render(<BidsList trackingId="PKG123" isSender={false} />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Withdraw' }).length).toBeGreaterThan(0);
      });

      const withdrawButtons = screen.getAllByRole('button', { name: 'Withdraw' });
      fireEvent.click(withdrawButtons[0]);

      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to withdraw your bid?'
      );
    });

    it('calls withdraw API when confirmed', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });
      (bidsAPI.withdraw as jest.Mock).mockResolvedValue({});

      render(<BidsList trackingId="PKG123" isSender={false} />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Withdraw' }).length).toBeGreaterThan(0);
      });

      const withdrawButtons = screen.getAllByRole('button', { name: 'Withdraw' });
      fireEvent.click(withdrawButtons[0]);

      await waitFor(() => {
        expect(bidsAPI.withdraw).toHaveBeenCalledWith(1);
      });
    });

    it('shows error alert when withdrawal fails', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });
      (bidsAPI.withdraw as jest.Mock).mockRejectedValue({
        response: { data: { detail: 'Cannot withdraw selected bid' } },
      });

      render(<BidsList trackingId="PKG123" isSender={false} />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Withdraw' }).length).toBeGreaterThan(0);
      });

      const withdrawButtons = screen.getAllByRole('button', { name: 'Withdraw' });
      fireEvent.click(withdrawButtons[0]);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Cannot withdraw selected bid');
      });
    });
  });

  describe('Other Bids Section', () => {
    it('shows collapsible section for non-pending bids', async () => {
      const pendingBid = { ...mockBid1, status: 'PENDING' };
      const rejectedBid = { ...mockBid2, status: 'REJECTED' };
      const withdrawnBid = { ...mockBid1, id: 3, status: 'WITHDRAWN' };

      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: { ...mockBidsResponse, bids: [pendingBid, rejectedBid, withdrawnBid] },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(screen.getByText('Show other bids (2)')).toBeInTheDocument();
      });
    });

    it('expands to show other bids when clicked', async () => {
      const pendingBid = { ...mockBid1, status: 'PENDING' };
      const rejectedBid = { ...mockBid2, status: 'REJECTED' };

      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: { ...mockBidsResponse, bids: [pendingBid, rejectedBid] },
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        const summary = screen.getByText('Show other bids (1)');
        fireEvent.click(summary);
      });

      await waitFor(() => {
        expect(screen.getByTestId('bid-card-2')).toBeInTheDocument();
      });
    });
  });

  describe('Polling', () => {
    it('polls for bids every 30 seconds', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });

      render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(bidsAPI.getPackageBids).toHaveBeenCalledTimes(1);
      });

      // Advance time by 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(bidsAPI.getPackageBids).toHaveBeenCalledTimes(2);
      });

      // Advance time by another 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(bidsAPI.getPackageBids).toHaveBeenCalledTimes(3);
      });
    });

    it('clears polling interval on unmount', async () => {
      (bidsAPI.getPackageBids as jest.Mock).mockResolvedValue({
        data: mockBidsResponse,
      });

      const { unmount } = render(<BidsList trackingId="PKG123" isSender={true} />);

      await waitFor(() => {
        expect(bidsAPI.getPackageBids).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Advance time - should not trigger more calls
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      expect(bidsAPI.getPackageBids).toHaveBeenCalledTimes(1);
    });
  });
});
