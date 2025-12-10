import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BidHistoryTab from '../BidHistoryTab';
import { bidsAPI, BidWithPackageResponse } from '@/lib/api';

// Mock the dependencies
jest.mock('@/lib/api', () => ({
  bidsAPI: {
    getMyBidsHistory: jest.fn(),
    withdraw: jest.fn(),
  },
}));

jest.mock('next/link', () => {
  return function Link({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock UI components
jest.mock('@/components/ui', () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">
      {children}
    </div>
  ),
  CardBody: ({ children, className }: any) => (
    <div className={className} data-testid="card-body">
      {children}
    </div>
  ),
  Badge: ({ children, variant, size }: any) => (
    <span data-testid="badge" data-variant={variant} data-size={size}>
      {children}
    </span>
  ),
  Button: ({ children, variant, size, onClick, disabled }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
  Alert: ({ children, variant, dismissible, onDismiss }: any) => (
    <div data-testid="alert" data-variant={variant} role="alert">
      {children}
      {dismissible && <button onClick={onDismiss}>Dismiss</button>}
    </div>
  ),
  FadeIn: ({ children }: any) => <div data-testid="fade-in">{children}</div>,
}));

describe('BidHistoryTab Component', () => {
  const mockBid1: BidWithPackageResponse = {
    id: 1,
    package_id: 101,
    courier_id: 1,
    courier_name: 'John Courier',
    courier_rating: 4.5,
    courier_total_ratings: 25,
    proposed_price: 50.0,
    estimated_delivery_hours: 24,
    estimated_pickup_time: null,
    message: 'I can pick up tomorrow morning',
    status: 'pending',
    created_at: '2024-01-15T10:00:00Z',
    selected_at: null,
    package_tracking_id: 'PKG123',
    package_description: 'Electronics package',
    package_status: 'open_for_bids',
    package_pickup_address: '123 Main St, Los Angeles, CA',
    package_dropoff_address: '456 Oak Ave, San Diego, CA',
    package_size: 'medium',
    sender_name: 'Jane Sender',
  };

  const mockBid2: BidWithPackageResponse = {
    ...mockBid1,
    id: 2,
    package_id: 102,
    proposed_price: 45.0,
    status: 'selected',
    message: null,
    selected_at: '2024-01-16T10:00:00Z',
    package_tracking_id: 'PKG456',
    package_description: 'Books delivery',
    package_status: 'bid_selected',
  };

  const mockBid3: BidWithPackageResponse = {
    ...mockBid1,
    id: 3,
    package_id: 103,
    proposed_price: 60.0,
    status: 'rejected',
    message: null,
    package_tracking_id: 'PKG789',
    package_description: 'Furniture',
    package_status: 'in_transit',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.confirm = jest.fn(() => true);
    global.alert = jest.fn();
  });

  describe('Loading State', () => {
    it('shows loading spinner initially', () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<BidHistoryTab />);

      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('hides loading spinner after data loads', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API call fails', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockRejectedValue({
        response: { data: { detail: 'Failed to fetch bids' } },
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch bids')).toBeInTheDocument();
      });
    });

    it('displays generic error when API error has no detail', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockRejectedValue({
        response: { data: {} },
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load bid history')).toBeInTheDocument();
      });
    });

    it('allows dismissing error alert', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockRejectedValue({
        response: { data: { detail: 'Error message' } },
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
      });

      const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByText('Error message')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no bids', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText('No bids found')).toBeInTheDocument();
        expect(
          screen.getByText(
            "You haven't placed any bids yet. Find packages that match your routes and start bidding!"
          )
        ).toBeInTheDocument();
      });
    });

    it('shows Find Packages button in empty state with all filter', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Find Packages' })).toBeInTheDocument();
      });
    });

    it('shows filter-specific message for filtered empty state', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText('No bids found')).toBeInTheDocument();
      });

      // Click on 'Pending' filter
      const pendingFilter = screen.getByRole('button', { name: 'Pending' });
      fireEvent.click(pendingFilter);

      await waitFor(() => {
        expect(screen.getByText('No pending bids found.')).toBeInTheDocument();
      });
    });

    it('does not show Find Packages button when filter is applied', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Find Packages' })).toBeInTheDocument();
      });

      // Click on 'Pending' filter
      const pendingFilter = screen.getByRole('button', { name: 'Pending' });
      fireEvent.click(pendingFilter);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Find Packages' })).not.toBeInTheDocument();
      });
    });
  });

  describe('Stats Summary', () => {
    it('displays stats cards with correct labels', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1, mockBid2, mockBid3],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        // Verify stats label texts exist (in card body context)
        expect(screen.getByText('Total Bids')).toBeInTheDocument();
      });
    });

    it('renders stat cards when data is loaded', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        // Stats cards are rendered (4 cards for stats)
        const statCards = screen.getAllByTestId('card');
        expect(statCards.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('Filter Tabs', () => {
    it('renders all filter options', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'All Bids' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Accepted' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Not Selected' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Withdrawn' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Expired' })).toBeInTheDocument();
      });
    });

    it('calls API with filter when filter is clicked', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(bidsAPI.getMyBidsHistory).toHaveBeenCalledWith(undefined);
      });

      (bidsAPI.getMyBidsHistory as jest.Mock).mockClear();

      const pendingFilter = screen.getByRole('button', { name: 'Pending' });
      fireEvent.click(pendingFilter);

      await waitFor(() => {
        expect(bidsAPI.getMyBidsHistory).toHaveBeenCalledWith('pending');
      });
    });

    it('calls API without filter when All Bids is clicked', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });

      render(<BidHistoryTab />);

      // First click on Pending
      const pendingFilter = screen.getByRole('button', { name: 'Pending' });
      fireEvent.click(pendingFilter);

      await waitFor(() => {
        expect(bidsAPI.getMyBidsHistory).toHaveBeenCalledWith('pending');
      });

      (bidsAPI.getMyBidsHistory as jest.Mock).mockClear();

      // Then click back to All Bids
      const allBidsFilter = screen.getByRole('button', { name: 'All Bids' });
      fireEvent.click(allBidsFilter);

      await waitFor(() => {
        expect(bidsAPI.getMyBidsHistory).toHaveBeenCalledWith(undefined);
      });
    });

    it('applies different filters correctly', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(bidsAPI.getMyBidsHistory).toHaveBeenCalledTimes(1);
      });

      // Test each filter
      const filters = ['selected', 'rejected', 'withdrawn', 'expired'];
      const buttonNames = ['Accepted', 'Not Selected', 'Withdrawn', 'Expired'];

      for (let i = 0; i < filters.length; i++) {
        (bidsAPI.getMyBidsHistory as jest.Mock).mockClear();
        const filterButton = screen.getByRole('button', { name: buttonNames[i] });
        fireEvent.click(filterButton);

        await waitFor(() => {
          expect(bidsAPI.getMyBidsHistory).toHaveBeenCalledWith(filters[i]);
        });
      }
    });
  });

  describe('Bids Display', () => {
    it('renders bid cards for all bids', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1, mockBid2],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText('Electronics package')).toBeInTheDocument();
        expect(screen.getByText('Books delivery')).toBeInTheDocument();
      });
    });

    it('displays package description with link', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: 'Electronics package' });
        expect(link).toHaveAttribute('href', '/packages/PKG123');
      });
    });

    it('displays pickup and dropoff addresses', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText('123 Main St, Los Angeles, CA')).toBeInTheDocument();
        expect(screen.getByText('456 Oak Ave, San Diego, CA')).toBeInTheDocument();
      });
    });

    it('displays sender name', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText('Jane Sender')).toBeInTheDocument();
      });
    });

    it('displays proposed price', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText('$50.00')).toBeInTheDocument();
      });
    });

    it('displays estimated delivery hours when available', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText('24h delivery')).toBeInTheDocument();
      });
    });

    it('displays bid message when available', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText(/"I can pick up tomorrow morning"/)).toBeInTheDocument();
      });
    });

    it('does not display message section when message is null', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid2], // mockBid2 has message: null
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText('Books delivery')).toBeInTheDocument();
      });

      // Message section should not exist
      expect(screen.queryByText(/".*"/)).not.toBeInTheDocument();
    });

    it('displays accepted date for selected bids', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid2], // mockBid2 is selected with selected_at
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText(/Accepted:/)).toBeInTheDocument();
      });
    });
  });

  describe('Bid Status Badges', () => {
    it('displays correct badge for pending bid', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [{ ...mockBid1, status: 'pending' }],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const badges = screen.getAllByTestId('badge');
        const pendingBadge = badges.find((b) => b.textContent === 'Pending');
        expect(pendingBadge).toBeInTheDocument();
      });
    });

    it('displays correct badge for selected bid', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [{ ...mockBid1, status: 'selected' }],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const badges = screen.getAllByTestId('badge');
        const acceptedBadge = badges.find((b) => b.textContent === 'Accepted');
        expect(acceptedBadge).toBeInTheDocument();
      });
    });

    it('displays correct badge for rejected bid', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [{ ...mockBid1, status: 'rejected' }],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const badges = screen.getAllByTestId('badge');
        const rejectedBadge = badges.find((b) => b.textContent === 'Not Selected');
        expect(rejectedBadge).toBeInTheDocument();
      });
    });

    it('displays correct badge for withdrawn bid', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [{ ...mockBid1, status: 'withdrawn' }],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const badges = screen.getAllByTestId('badge');
        const withdrawnBadge = badges.find((b) => b.textContent === 'Withdrawn');
        expect(withdrawnBadge).toBeInTheDocument();
      });
    });

    it('displays correct badge for expired bid', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [{ ...mockBid1, status: 'expired' }],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const badges = screen.getAllByTestId('badge');
        const expiredBadge = badges.find((b) => b.textContent === 'Expired');
        expect(expiredBadge).toBeInTheDocument();
      });
    });
  });

  describe('Package Status Badges', () => {
    it('displays correct badge for open_for_bids package', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [{ ...mockBid1, package_status: 'open_for_bids' }],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const badges = screen.getAllByTestId('badge');
        const statusBadge = badges.find((b) => b.textContent === 'Open for Bids');
        expect(statusBadge).toBeInTheDocument();
      });
    });

    it('displays correct badge for in_transit package', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [{ ...mockBid1, package_status: 'in_transit' }],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const badges = screen.getAllByTestId('badge');
        const statusBadge = badges.find((b) => b.textContent === 'In Transit');
        expect(statusBadge).toBeInTheDocument();
      });
    });

    it('displays correct badge for delivered package', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [{ ...mockBid1, package_status: 'delivered' }],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const badges = screen.getAllByTestId('badge');
        const statusBadge = badges.find((b) => b.textContent === 'Delivered');
        expect(statusBadge).toBeInTheDocument();
      });
    });

    it('displays correct badge for canceled package', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [{ ...mockBid1, package_status: 'canceled' }],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const badges = screen.getAllByTestId('badge');
        const statusBadge = badges.find((b) => b.textContent === 'Canceled');
        expect(statusBadge).toBeInTheDocument();
      });
    });
  });

  describe('Withdraw Functionality', () => {
    it('shows withdraw button only for pending bids', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [
          { ...mockBid1, status: 'pending' },
          { ...mockBid2, status: 'selected' },
        ],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const withdrawButtons = screen.getAllByRole('button', { name: 'Withdraw' });
        expect(withdrawButtons.length).toBe(1);
      });
    });

    it('does not show withdraw button for selected bids', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [{ ...mockBid1, status: 'selected' }],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByText('Electronics package')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument();
    });

    it('asks for confirmation before withdrawing', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });
      (bidsAPI.withdraw as jest.Mock).mockResolvedValue({});

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
      });

      const withdrawButton = screen.getByRole('button', { name: 'Withdraw' });
      fireEvent.click(withdrawButton);

      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to withdraw this bid?'
      );
    });

    it('calls withdraw API when confirmed', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });
      (bidsAPI.withdraw as jest.Mock).mockResolvedValue({});

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
      });

      const withdrawButton = screen.getByRole('button', { name: 'Withdraw' });
      fireEvent.click(withdrawButton);

      await waitFor(() => {
        expect(bidsAPI.withdraw).toHaveBeenCalledWith(1);
      });
    });

    it('does not call withdraw API when cancelled', async () => {
      global.confirm = jest.fn(() => false);

      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
      });

      const withdrawButton = screen.getByRole('button', { name: 'Withdraw' });
      fireEvent.click(withdrawButton);

      expect(bidsAPI.withdraw).not.toHaveBeenCalled();
    });

    it('reloads bids after successful withdrawal', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });
      (bidsAPI.withdraw as jest.Mock).mockResolvedValue({});

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(bidsAPI.getMyBidsHistory).toHaveBeenCalledTimes(1);
      });

      const withdrawButton = screen.getByRole('button', { name: 'Withdraw' });
      fireEvent.click(withdrawButton);

      await waitFor(() => {
        // Should be called twice: initial load + reload after withdraw
        expect(bidsAPI.getMyBidsHistory).toHaveBeenCalledTimes(2);
      });
    });

    it('shows error alert when withdrawal fails', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });
      (bidsAPI.withdraw as jest.Mock).mockRejectedValue({
        response: { data: { detail: 'Cannot withdraw this bid' } },
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
      });

      const withdrawButton = screen.getByRole('button', { name: 'Withdraw' });
      fireEvent.click(withdrawButton);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Cannot withdraw this bid');
      });
    });

    it('shows generic error when withdrawal fails without detail', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });
      (bidsAPI.withdraw as jest.Mock).mockRejectedValue({
        response: { data: {} },
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
      });

      const withdrawButton = screen.getByRole('button', { name: 'Withdraw' });
      fireEvent.click(withdrawButton);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Failed to withdraw bid');
      });
    });

    it('shows withdrawing state during withdrawal', async () => {
      let resolveWithdraw: () => void;
      const withdrawPromise = new Promise<void>((resolve) => {
        resolveWithdraw = resolve;
      });

      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });
      (bidsAPI.withdraw as jest.Mock).mockImplementation(() => withdrawPromise);

      render(<BidHistoryTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
      });

      const withdrawButton = screen.getByRole('button', { name: 'Withdraw' });
      fireEvent.click(withdrawButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Withdrawing...' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Withdrawing...' })).toBeDisabled();
      });

      resolveWithdraw!();
    });
  });

  describe('View Package Button', () => {
    it('renders View Package button for each bid', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1, mockBid2],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const viewButtons = screen.getAllByRole('button', { name: 'View Package' });
        expect(viewButtons.length).toBe(2);
      });
    });

    it('links to correct package page', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [mockBid1],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const viewPackageLinks = screen.getAllByRole('link');
        const packageLink = viewPackageLinks.find((l) =>
          l.getAttribute('href')?.includes('/packages/PKG123')
        );
        expect(packageLink).toBeInTheDocument();
      });
    });
  });

  describe('Selected Bid Display', () => {
    it('displays selected bid with accepted badge', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [{ ...mockBid1, status: 'selected' }],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        // Verify the bid is displayed with Accepted badge
        const badges = screen.getAllByTestId('badge');
        const acceptedBadge = badges.find((b) => b.textContent === 'Accepted');
        expect(acceptedBadge).toBeInTheDocument();
        expect(screen.getByText('Electronics package')).toBeInTheDocument();
      });
    });

    it('displays pending bid with pending badge', async () => {
      (bidsAPI.getMyBidsHistory as jest.Mock).mockResolvedValue({
        data: [{ ...mockBid1, status: 'pending' }],
      });

      render(<BidHistoryTab />);

      await waitFor(() => {
        const badges = screen.getAllByTestId('badge');
        const pendingBadge = badges.find((b) => b.textContent === 'Pending');
        expect(pendingBadge).toBeInTheDocument();
      });
    });
  });
});
