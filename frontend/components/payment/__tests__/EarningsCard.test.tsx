import { render, screen, fireEvent } from '@testing-library/react';
import { EarningsCard } from '../EarningsCard';
import { EarningsSummary, CourierBalance } from '@/lib/api';

// Mock UI components
jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, loading, variant, className }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-loading={loading}
      data-variant={variant}
      className={className}
    >
      {children}
    </button>
  ),
}));

describe('EarningsCard Component', () => {
  const mockEarnings: EarningsSummary = {
    total_earnings_cents: 50000, // $500.00
    total_deliveries: 25,
    pending_payout_cents: 15000, // $150.00
    last_payout_at: '2024-01-10T10:00:00Z',
  };

  const mockBalance: CourierBalance = {
    pending_cents: 15000,
    available_cents: 35000, // $350.00
  };

  describe('Rendering', () => {
    it('renders the card component', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('renders card header with title', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(screen.getByTestId('card-header')).toBeInTheDocument();
      expect(screen.getByText('Earnings')).toBeInTheDocument();
    });

    it('renders card content', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(screen.getByTestId('card-content')).toBeInTheDocument();
    });
  });

  describe('Total Earnings Display', () => {
    it('displays total earnings formatted as currency', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(screen.getByText('$500.00')).toBeInTheDocument();
    });

    it('displays total deliveries count', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(screen.getByText('25 deliveries')).toBeInTheDocument();
    });

    it('formats cents to dollars correctly', () => {
      const earnings = { ...mockEarnings, total_earnings_cents: 123456 }; // $1,234.56
      render(<EarningsCard earnings={earnings} />);
      expect(screen.getByText('$1,234.56')).toBeInTheDocument();
    });

    it('displays zero earnings correctly', () => {
      const earnings = { ...mockEarnings, total_earnings_cents: 0 };
      render(<EarningsCard earnings={earnings} />);
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('shows "Total Earnings" label', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(screen.getByText('Total Earnings')).toBeInTheDocument();
    });

    it('singular delivery text for 1 delivery', () => {
      const earnings = { ...mockEarnings, total_deliveries: 1 };
      render(<EarningsCard earnings={earnings} />);
      expect(screen.getByText('1 deliveries')).toBeInTheDocument();
      // Note: Component uses "deliveries" for all counts. Could be enhanced to use singular/plural
    });
  });

  describe('Pending Balance Display', () => {
    it('displays pending amount from earnings when no balance provided', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(screen.getByText('$150.00')).toBeInTheDocument();
    });

    it('displays pending amount from balance when provided', () => {
      const balance = { ...mockBalance, pending_cents: 20000 };
      render(<EarningsCard earnings={mockEarnings} balance={balance} />);
      // Should show balance.pending_cents ($200) instead of earnings.pending_payout_cents
      const pendingSections = screen.getAllByText(/\$\d+\.\d{2}/);
      expect(pendingSections.some(el => el.textContent === '$200.00')).toBeTruthy();
    });

    it('shows "Pending" label', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('shows "Ready for payout" helper text', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(screen.getByText('Ready for payout')).toBeInTheDocument();
    });
  });

  describe('Available Balance Display', () => {
    it('displays available balance when balance provided', () => {
      render(<EarningsCard earnings={mockEarnings} balance={mockBalance} />);
      expect(screen.getByText('$350.00')).toBeInTheDocument();
    });

    it('does not display available balance when balance not provided', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(screen.queryByText('Available')).not.toBeInTheDocument();
    });

    it('shows "Available" label when balance provided', () => {
      render(<EarningsCard earnings={mockEarnings} balance={mockBalance} />);
      expect(screen.getByText('Available')).toBeInTheDocument();
    });

    it('shows "In your account" helper text', () => {
      render(<EarningsCard earnings={mockEarnings} balance={mockBalance} />);
      expect(screen.getByText('In your account')).toBeInTheDocument();
    });
  });

  describe('Last Payout Date', () => {
    it('displays formatted last payout date', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      const expectedDate = new Date('2024-01-10T10:00:00Z').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
    });

    it('displays "Never" when last payout is null', () => {
      const earnings = { ...mockEarnings, last_payout_at: null };
      render(<EarningsCard earnings={earnings} />);
      expect(screen.getByText('Never')).toBeInTheDocument();
    });

    it('shows "Last payout" label', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(screen.getByText('Last payout')).toBeInTheDocument();
    });
  });

  describe('Request Payout Button', () => {
    it('shows button when callback provided and pending amount > 0', () => {
      const onRequestPayout = jest.fn();
      render(
        <EarningsCard
          earnings={mockEarnings}
          onRequestPayout={onRequestPayout}
        />
      );
      expect(screen.getByRole('button', { name: /Request Payout/ })).toBeInTheDocument();
    });

    it('does not show button when callback not provided', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(screen.queryByRole('button', { name: /Request Payout/ })).not.toBeInTheDocument();
    });

    it('does not show button when pending amount is 0', () => {
      const earnings = { ...mockEarnings, pending_payout_cents: 0 };
      const onRequestPayout = jest.fn();
      render(
        <EarningsCard
          earnings={earnings}
          onRequestPayout={onRequestPayout}
        />
      );
      expect(screen.queryByRole('button', { name: /Request Payout/ })).not.toBeInTheDocument();
    });

    it('displays pending amount in button text', () => {
      const onRequestPayout = jest.fn();
      render(
        <EarningsCard
          earnings={mockEarnings}
          onRequestPayout={onRequestPayout}
        />
      );
      expect(screen.getByRole('button', { name: 'Request Payout ($150.00)' })).toBeInTheDocument();
    });

    it('calls onRequestPayout when clicked', () => {
      const onRequestPayout = jest.fn();
      render(
        <EarningsCard
          earnings={mockEarnings}
          onRequestPayout={onRequestPayout}
        />
      );

      const button = screen.getByRole('button', { name: /Request Payout/ });
      fireEvent.click(button);

      expect(onRequestPayout).toHaveBeenCalledTimes(1);
    });

    it('button has primary variant', () => {
      const onRequestPayout = jest.fn();
      render(
        <EarningsCard
          earnings={mockEarnings}
          onRequestPayout={onRequestPayout}
        />
      );

      const button = screen.getByRole('button', { name: /Request Payout/ });
      expect(button).toHaveAttribute('data-variant', 'primary');
    });

    it('button is full width', () => {
      const onRequestPayout = jest.fn();
      render(
        <EarningsCard
          earnings={mockEarnings}
          onRequestPayout={onRequestPayout}
        />
      );

      const button = screen.getByRole('button', { name: /Request Payout/ });
      expect(button.className).toContain('w-full');
    });

    it('disables button when isPayoutLoading is true', () => {
      const onRequestPayout = jest.fn();
      render(
        <EarningsCard
          earnings={mockEarnings}
          onRequestPayout={onRequestPayout}
          isPayoutLoading={true}
        />
      );

      const button = screen.getByRole('button', { name: 'Processing...' });
      expect(button).toBeDisabled();
    });

    it('shows loading state when isPayoutLoading is true', () => {
      const onRequestPayout = jest.fn();
      render(
        <EarningsCard
          earnings={mockEarnings}
          onRequestPayout={onRequestPayout}
          isPayoutLoading={true}
        />
      );

      const button = screen.getByRole('button', { name: 'Processing...' });
      expect(button).toHaveAttribute('data-loading', 'true');
    });

    it('shows processing text when loading', () => {
      const onRequestPayout = jest.fn();
      render(
        <EarningsCard
          earnings={mockEarnings}
          onRequestPayout={onRequestPayout}
          isPayoutLoading={true}
        />
      );

      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(screen.queryByText(/Request Payout/)).not.toBeInTheDocument();
    });

    it('disables button when pending amount is 0', () => {
      const earnings = { ...mockEarnings, pending_payout_cents: 1 };
      const balance = { ...mockBalance, pending_cents: 0 };
      const onRequestPayout = jest.fn();
      render(
        <EarningsCard
          earnings={earnings}
          balance={balance}
          onRequestPayout={onRequestPayout}
        />
      );

      // Button should not be shown when pending is 0
      expect(screen.queryByRole('button', { name: /Request Payout/ })).not.toBeInTheDocument();
    });
  });

  describe('Empty State Message', () => {
    it('shows message when pending amount is 0', () => {
      const earnings = { ...mockEarnings, pending_payout_cents: 0 };
      render(<EarningsCard earnings={earnings} />);
      expect(screen.getByText('Complete more deliveries to earn payouts')).toBeInTheDocument();
    });

    it('does not show message when pending amount > 0', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      expect(
        screen.queryByText('Complete more deliveries to earn payouts')
      ).not.toBeInTheDocument();
    });

    it('shows message when balance pending is 0', () => {
      const earnings = { ...mockEarnings, pending_payout_cents: 100 };
      const balance = { ...mockBalance, pending_cents: 0 };
      render(<EarningsCard earnings={earnings} balance={balance} />);
      expect(screen.getByText('Complete more deliveries to earn payouts')).toBeInTheDocument();
    });
  });

  describe('Currency Formatting', () => {
    it('formats large amounts with commas', () => {
      const earnings = { ...mockEarnings, total_earnings_cents: 1234567 }; // $12,345.67
      render(<EarningsCard earnings={earnings} />);
      expect(screen.getByText('$12,345.67')).toBeInTheDocument();
    });

    it('formats amounts with two decimal places', () => {
      const earnings = { ...mockEarnings, total_earnings_cents: 10050 }; // $100.50
      render(<EarningsCard earnings={earnings} />);
      expect(screen.getByText('$100.50')).toBeInTheDocument();
    });

    it('uses USD currency symbol', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      const amounts = screen.getAllByText(/\$/);
      expect(amounts.length).toBeGreaterThan(0);
    });
  });

  describe('Complete Earnings Display', () => {
    it('renders all sections when all data provided', () => {
      const onRequestPayout = jest.fn();
      render(
        <EarningsCard
          earnings={mockEarnings}
          balance={mockBalance}
          onRequestPayout={onRequestPayout}
        />
      );

      expect(screen.getByText('Earnings')).toBeInTheDocument();
      expect(screen.getByText('Total Earnings')).toBeInTheDocument();
      expect(screen.getByText('$500.00')).toBeInTheDocument();
      expect(screen.getByText('25 deliveries')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.getByText('$350.00')).toBeInTheDocument();
      expect(screen.getByText('Last payout')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Request Payout/ })).toBeInTheDocument();
    });

    it('renders minimal earnings without balance', () => {
      render(<EarningsCard earnings={mockEarnings} />);

      expect(screen.getByText('Total Earnings')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.queryByText('Available')).not.toBeInTheDocument();
      expect(screen.getByText('Last payout')).toBeInTheDocument();
    });

    it('renders zero state correctly', () => {
      const earnings = {
        total_earnings_cents: 0,
        total_deliveries: 0,
        pending_payout_cents: 0,
        last_payout_at: null,
      };
      render(<EarningsCard earnings={earnings} />);

      expect(screen.getByText('$0.00')).toBeInTheDocument();
      expect(screen.getByText('0 deliveries')).toBeInTheDocument();
      expect(screen.getByText('Never')).toBeInTheDocument();
      expect(screen.getByText('Complete more deliveries to earn payouts')).toBeInTheDocument();
    });
  });

  describe('Layout and Styling', () => {
    it('uses grid layout for balance sections', () => {
      const { container } = render(<EarningsCard earnings={mockEarnings} balance={mockBalance} />);
      const grid = container.querySelector('.grid.grid-cols-2');
      expect(grid).toBeInTheDocument();
    });

    it('applies proper spacing between sections', () => {
      render(<EarningsCard earnings={mockEarnings} />);
      const content = screen.getByTestId('card-content');
      expect(content.className).toContain('space-y-6');
    });

    it('total earnings section has primary styling', () => {
      const { container } = render(<EarningsCard earnings={mockEarnings} />);
      const totalSection = container.querySelector('.bg-primary-50');
      expect(totalSection).toBeInTheDocument();
    });

    it('pending and available sections have surface styling', () => {
      const { container } = render(<EarningsCard earnings={mockEarnings} balance={mockBalance} />);
      const balanceSections = container.querySelectorAll('.bg-surface-50');
      expect(balanceSections.length).toBeGreaterThan(0);
    });
  });
});
