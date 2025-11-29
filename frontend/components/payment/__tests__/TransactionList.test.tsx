import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionList } from '../TransactionList';
import { Transaction } from '@/lib/api';

// Mock Badge component
jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant, size }: { children: React.ReactNode; variant: string; size: string }) => (
    <span data-testid="badge" data-variant={variant} data-size={size}>{children}</span>
  ),
}));

describe('TransactionList Component', () => {
  const mockTransaction: Transaction = {
    id: 1,
    package_id: 123,
    sender_id: 1,
    courier_id: 2,
    amount_cents: 5000, // $50.00
    courier_payout_cents: 4250, // $42.50
    platform_fee_cents: 750, // $7.50
    stripe_payment_intent_id: 'pi_123',
    status: 'succeeded',
    refund_amount_cents: 0,
    created_at: '2024-01-15T10:30:00Z',
  };

  describe('Empty State', () => {
    it('shows empty state when no transactions', () => {
      render(<TransactionList transactions={[]} currentUserId={1} />);
      expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    });

    it('renders empty state icon', () => {
      const { container } = render(<TransactionList transactions={[]} currentUserId={1} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-12', 'h-12');
    });

    it('centers empty state content', () => {
      const { container } = render(<TransactionList transactions={[]} currentUserId={1} />);
      const emptyState = container.querySelector('.text-center');
      expect(emptyState).toBeInTheDocument();
    });
  });

  describe('Transaction Display', () => {
    it('renders transaction items', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      expect(screen.getByText('Package #123')).toBeInTheDocument();
    });

    it('renders multiple transactions', () => {
      const transactions = [
        mockTransaction,
        { ...mockTransaction, id: 2, package_id: 124 },
        { ...mockTransaction, id: 3, package_id: 125 },
      ];
      render(<TransactionList transactions={transactions} currentUserId={1} />);

      expect(screen.getByText('Package #123')).toBeInTheDocument();
      expect(screen.getByText('Package #124')).toBeInTheDocument();
      expect(screen.getByText('Package #125')).toBeInTheDocument();
    });

    it('divides transactions with borders', () => {
      const transactions = [mockTransaction, { ...mockTransaction, id: 2 }];
      const { container } = render(<TransactionList transactions={transactions} currentUserId={1} />);
      const divider = container.querySelector('.divide-y');
      expect(divider).toBeInTheDocument();
    });
  });

  describe('Status Badges', () => {
    it('displays succeeded status as Completed', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('displays processing status', () => {
      const tx = { ...mockTransaction, status: 'processing' };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });

    it('displays pending status', () => {
      const tx = { ...mockTransaction, status: 'pending' };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('displays requires_payment status as Awaiting Payment', () => {
      const tx = { ...mockTransaction, status: 'requires_payment' };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      expect(screen.getByText('Awaiting Payment')).toBeInTheDocument();
    });

    it('displays failed status', () => {
      const tx = { ...mockTransaction, status: 'failed' };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('displays refunded status', () => {
      const tx = { ...mockTransaction, status: 'refunded' };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      expect(screen.getByText('Refunded')).toBeInTheDocument();
    });

    it('uses success variant for succeeded status', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-variant', 'success');
    });

    it('uses warning variant for processing status', () => {
      const tx = { ...mockTransaction, status: 'processing' };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-variant', 'warning');
    });

    it('uses error variant for failed status', () => {
      const tx = { ...mockTransaction, status: 'failed' };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-variant', 'error');
    });

    it('uses small size for badges', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-size', 'sm');
    });

    it('displays unknown status as-is', () => {
      const tx = { ...mockTransaction, status: 'unknown_status' as any };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      expect(screen.getByText('unknown_status')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('displays formatted transaction date', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      const expectedDate = new Date('2024-01-15T10:30:00Z').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
    });
  });

  describe('Amount Display for Sender', () => {
    it('displays amount with minus sign for sender', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      expect(screen.getByText('-$50.00')).toBeInTheDocument();
    });

    it('displays platform fee for sender', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      expect(screen.getByText('Fee: $7.50')).toBeInTheDocument();
    });

    it('does not display platform fee when it is 0', () => {
      const tx = { ...mockTransaction, platform_fee_cents: 0 };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      expect(screen.queryByText(/Fee:/)).not.toBeInTheDocument();
    });

    it('uses default text color for sender amount', () => {
      const { container } = render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      const amount = screen.getByText('-$50.00');
      expect(amount.className).toContain('text-surface-900');
    });
  });

  describe('Amount Display for Courier', () => {
    it('displays payout amount with plus sign for courier', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={2} />);
      expect(screen.getByText('+$42.50')).toBeInTheDocument();
    });

    it('uses secondary color for courier amount', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={2} />);
      const amount = screen.getByText('+$42.50');
      expect(amount.className).toContain('text-secondary-600');
    });

    it('does not display platform fee for courier', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={2} />);
      expect(screen.queryByText(/Fee:/)).not.toBeInTheDocument();
    });
  });

  describe('Refund Display', () => {
    it('displays refund amount when present', () => {
      const tx = { ...mockTransaction, refund_amount_cents: 2000 }; // $20.00
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      expect(screen.getByText('Refunded: $20.00')).toBeInTheDocument();
    });

    it('does not display refund when amount is 0', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      expect(screen.queryByText(/Refunded:/)).not.toBeInTheDocument();
    });

    it('displays refund in error color', () => {
      const tx = { ...mockTransaction, refund_amount_cents: 2000 };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      const refund = screen.getByText('Refunded: $20.00');
      expect(refund.className).toContain('text-error-500');
    });
  });

  describe('Currency Formatting', () => {
    it('formats amounts with dollar sign and decimals', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      expect(screen.getByText('-$50.00')).toBeInTheDocument();
    });

    it('formats large amounts with commas', () => {
      const tx = { ...mockTransaction, amount_cents: 1234567 }; // $12,345.67
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      expect(screen.getByText('-$12,345.67')).toBeInTheDocument();
    });

    it('formats cents correctly', () => {
      const tx = { ...mockTransaction, amount_cents: 10050 }; // $100.50
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      expect(screen.getByText('-$100.50')).toBeInTheDocument();
    });

    it('displays zero amounts correctly', () => {
      const tx = { ...mockTransaction, amount_cents: 0 };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);
      expect(screen.getByText('-$0.00')).toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('calls onViewDetails with transaction id when clicked', () => {
      const onViewDetails = jest.fn();
      render(
        <TransactionList
          transactions={[mockTransaction]}
          currentUserId={1}
          onViewDetails={onViewDetails}
        />
      );

      const transactionRow = screen.getByText('Package #123').closest('div');
      fireEvent.click(transactionRow!);

      expect(onViewDetails).toHaveBeenCalledWith(1);
      expect(onViewDetails).toHaveBeenCalledTimes(1);
    });

    it('does not add click handler when onViewDetails not provided', () => {
      const { container } = render(
        <TransactionList transactions={[mockTransaction]} currentUserId={1} />
      );

      const transactionRow = screen.getByText('Package #123').closest('div');
      expect(transactionRow?.className).not.toContain('cursor-pointer');
    });

    it('adds hover effect when onViewDetails provided', () => {
      const onViewDetails = jest.fn();
      const { container } = render(
        <TransactionList
          transactions={[mockTransaction]}
          currentUserId={1}
          onViewDetails={onViewDetails}
        />
      );

      const transactionRow = screen.getByText('Package #123').closest('div');
      expect(transactionRow?.className).toContain('cursor-pointer');
      expect(transactionRow?.className).toContain('hover:bg-surface-50');
    });

    it('handles clicks on multiple transactions', () => {
      const onViewDetails = jest.fn();
      const transactions = [
        mockTransaction,
        { ...mockTransaction, id: 2, package_id: 124 },
      ];
      render(
        <TransactionList
          transactions={transactions}
          currentUserId={1}
          onViewDetails={onViewDetails}
        />
      );

      const tx1 = screen.getByText('Package #123').closest('div');
      const tx2 = screen.getByText('Package #124').closest('div');

      fireEvent.click(tx1!);
      expect(onViewDetails).toHaveBeenCalledWith(1);

      fireEvent.click(tx2!);
      expect(onViewDetails).toHaveBeenCalledWith(2);

      expect(onViewDetails).toHaveBeenCalledTimes(2);
    });
  });

  describe('Complete Transaction Display', () => {
    it('renders all elements for sender transaction', () => {
      const tx = { ...mockTransaction, platform_fee_cents: 500, refund_amount_cents: 0 };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);

      expect(screen.getByText('Package #123')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('-$50.00')).toBeInTheDocument();
      expect(screen.getByText('Fee: $5.00')).toBeInTheDocument();
    });

    it('renders all elements for courier transaction', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={2} />);

      expect(screen.getByText('Package #123')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('+$42.50')).toBeInTheDocument();
      expect(screen.queryByText(/Fee:/)).not.toBeInTheDocument();
    });

    it('renders transaction with refund', () => {
      const tx = {
        ...mockTransaction,
        status: 'refunded',
        refund_amount_cents: 5000,
      };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);

      expect(screen.getByText('Refunded')).toBeInTheDocument();
      expect(screen.getByText('Refunded: $50.00')).toBeInTheDocument();
    });

    it('renders pending transaction', () => {
      const tx = { ...mockTransaction, status: 'pending' };
      render(<TransactionList transactions={[tx]} currentUserId={1} />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-variant', 'secondary');
    });
  });

  describe('Layout and Styling', () => {
    it('uses flex layout for transaction items', () => {
      const { container } = render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      const flex = container.querySelector('.flex.items-center.justify-between');
      expect(flex).toBeInTheDocument();
    });

    it('applies proper padding to transaction items', () => {
      const { container } = render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      const item = container.querySelector('.py-4');
      expect(item).toBeInTheDocument();
    });

    it('right-aligns amount display', () => {
      const { container } = render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      const amountSection = container.querySelector('.text-right');
      expect(amountSection).toBeInTheDocument();
    });
  });

  describe('User Role Detection', () => {
    it('correctly identifies sender', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={1} />);
      expect(screen.getByText('-$50.00')).toBeInTheDocument(); // Sender sees negative amount
    });

    it('correctly identifies courier', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={2} />);
      expect(screen.getByText('+$42.50')).toBeInTheDocument(); // Courier sees positive payout
    });

    it('handles user who is neither sender nor courier', () => {
      render(<TransactionList transactions={[mockTransaction]} currentUserId={999} />);
      // Should still render but as sender view by default
      expect(screen.getByText('-$50.00')).toBeInTheDocument();
    });
  });
});
