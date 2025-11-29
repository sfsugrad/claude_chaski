import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentMethodCard } from '../PaymentMethodCard';
import { PaymentMethod } from '@/lib/api';

// Mock UI components
jest.mock('@/components/ui/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant, size }: { children: React.ReactNode; variant: string; size: string }) => (
    <span data-testid="badge" data-variant={variant} data-size={size}>{children}</span>
  ),
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}));

describe('PaymentMethodCard Component', () => {
  const mockPaymentMethod: PaymentMethod = {
    id: 1,
    user_id: 1,
    stripe_payment_method_id: 'pm_123',
    card_brand: 'visa',
    card_last_four: '4242',
    card_exp_month: 12,
    card_exp_year: 2025,
    is_default: false,
    created_at: '2024-01-15T10:00:00Z',
  };

  describe('Rendering', () => {
    it('renders the card component', () => {
      render(<PaymentMethodCard paymentMethod={mockPaymentMethod} />);
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('applies custom className to card', () => {
      render(<PaymentMethodCard paymentMethod={mockPaymentMethod} />);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('p-4');
    });
  });

  describe('Card Brand Display', () => {
    it('displays card brand and last four digits', () => {
      render(<PaymentMethodCard paymentMethod={mockPaymentMethod} />);
      expect(screen.getByText('Visa ****4242')).toBeInTheDocument();
    });

    it('capitalizes card brand name', () => {
      const mastercardMethod = { ...mockPaymentMethod, card_brand: 'mastercard' };
      render(<PaymentMethodCard paymentMethod={mastercardMethod} />);
      expect(screen.getByText('Mastercard ****4242')).toBeInTheDocument();
    });

    it('displays uppercase brand abbreviation in icon', () => {
      render(<PaymentMethodCard paymentMethod={mockPaymentMethod} />);
      expect(screen.getByText('VISA')).toBeInTheDocument();
    });

    it('shows only first 4 characters of brand in icon', () => {
      const amexMethod = { ...mockPaymentMethod, card_brand: 'american_express' };
      render(<PaymentMethodCard paymentMethod={amexMethod} />);
      expect(screen.getByText('AMER')).toBeInTheDocument();
    });

    it('shows generic card icon when no brand', () => {
      const noBrandMethod = { ...mockPaymentMethod, card_brand: null };
      const { container } = render(<PaymentMethodCard paymentMethod={noBrandMethod} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-6', 'h-6');
    });

    it('displays "Card" when brand is null', () => {
      const noBrandMethod = { ...mockPaymentMethod, card_brand: null };
      render(<PaymentMethodCard paymentMethod={noBrandMethod} />);
      expect(screen.getByText('Card ****4242')).toBeInTheDocument();
    });
  });

  describe('Expiry Date', () => {
    it('displays formatted expiry date', () => {
      render(<PaymentMethodCard paymentMethod={mockPaymentMethod} />);
      expect(screen.getByText('Expires 12/25')).toBeInTheDocument();
    });

    it('pads single digit month with zero', () => {
      const singleDigitMonth = { ...mockPaymentMethod, card_exp_month: 3 };
      render(<PaymentMethodCard paymentMethod={singleDigitMonth} />);
      expect(screen.getByText('Expires 03/25')).toBeInTheDocument();
    });

    it('displays last two digits of year', () => {
      const futureYear = { ...mockPaymentMethod, card_exp_year: 2030 };
      render(<PaymentMethodCard paymentMethod={futureYear} />);
      expect(screen.getByText('Expires 12/30')).toBeInTheDocument();
    });

    it('does not display expiry when month is missing', () => {
      const noMonth = { ...mockPaymentMethod, card_exp_month: null };
      render(<PaymentMethodCard paymentMethod={noMonth} />);
      expect(screen.queryByText(/Expires/)).not.toBeInTheDocument();
    });

    it('does not display expiry when year is missing', () => {
      const noYear = { ...mockPaymentMethod, card_exp_year: null };
      render(<PaymentMethodCard paymentMethod={noYear} />);
      expect(screen.queryByText(/Expires/)).not.toBeInTheDocument();
    });
  });

  describe('Default Badge', () => {
    it('shows default badge when is_default is true', () => {
      const defaultMethod = { ...mockPaymentMethod, is_default: true };
      render(<PaymentMethodCard paymentMethod={defaultMethod} />);

      const badge = screen.getByTestId('badge');
      expect(badge).toHaveTextContent('Default');
      expect(badge).toHaveAttribute('data-variant', 'primary');
      expect(badge).toHaveAttribute('data-size', 'sm');
    });

    it('does not show default badge when is_default is false', () => {
      render(<PaymentMethodCard paymentMethod={mockPaymentMethod} />);
      const badges = screen.queryAllByTestId('badge');
      const defaultBadge = badges.find(badge => badge.textContent === 'Default');
      expect(defaultBadge).toBeUndefined();
    });
  });

  describe('Set Default Button', () => {
    it('shows Set Default button when not default and callback provided', () => {
      const onSetDefault = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={mockPaymentMethod}
          onSetDefault={onSetDefault}
        />
      );
      expect(screen.getByRole('button', { name: 'Set Default' })).toBeInTheDocument();
    });

    it('does not show Set Default button when is default', () => {
      const defaultMethod = { ...mockPaymentMethod, is_default: true };
      const onSetDefault = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={defaultMethod}
          onSetDefault={onSetDefault}
        />
      );
      expect(screen.queryByRole('button', { name: 'Set Default' })).not.toBeInTheDocument();
    });

    it('does not show Set Default button when callback not provided', () => {
      render(<PaymentMethodCard paymentMethod={mockPaymentMethod} />);
      expect(screen.queryByRole('button', { name: 'Set Default' })).not.toBeInTheDocument();
    });

    it('calls onSetDefault with payment method id when clicked', () => {
      const onSetDefault = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={mockPaymentMethod}
          onSetDefault={onSetDefault}
        />
      );

      const button = screen.getByRole('button', { name: 'Set Default' });
      fireEvent.click(button);

      expect(onSetDefault).toHaveBeenCalledWith(1);
      expect(onSetDefault).toHaveBeenCalledTimes(1);
    });

    it('Set Default button has correct variant and size', () => {
      const onSetDefault = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={mockPaymentMethod}
          onSetDefault={onSetDefault}
        />
      );

      const button = screen.getByRole('button', { name: 'Set Default' });
      expect(button).toHaveAttribute('data-variant', 'outline');
      expect(button).toHaveAttribute('data-size', 'sm');
    });
  });

  describe('Remove Button', () => {
    it('shows Remove button when callback provided', () => {
      const onDelete = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={mockPaymentMethod}
          onDelete={onDelete}
        />
      );
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('does not show Remove button when callback not provided', () => {
      render(<PaymentMethodCard paymentMethod={mockPaymentMethod} />);
      expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    });

    it('calls onDelete with payment method id when clicked', () => {
      const onDelete = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={mockPaymentMethod}
          onDelete={onDelete}
        />
      );

      const button = screen.getByRole('button', { name: 'Remove' });
      fireEvent.click(button);

      expect(onDelete).toHaveBeenCalledWith(1);
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('Remove button has correct variant and size', () => {
      const onDelete = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={mockPaymentMethod}
          onDelete={onDelete}
        />
      );

      const button = screen.getByRole('button', { name: 'Remove' });
      expect(button).toHaveAttribute('data-variant', 'outline');
      expect(button).toHaveAttribute('data-size', 'sm');
    });

    it('Remove button has error styling', () => {
      const onDelete = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={mockPaymentMethod}
          onDelete={onDelete}
        />
      );

      const button = screen.getByRole('button', { name: 'Remove' });
      expect(button.className).toContain('text-error-600');
      expect(button.className).toContain('hover:text-error-700');
    });

    it('disables Remove button when isDeleting is true', () => {
      const onDelete = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={mockPaymentMethod}
          onDelete={onDelete}
          isDeleting={true}
        />
      );

      const button = screen.getByRole('button', { name: 'Removing...' });
      expect(button).toBeDisabled();
    });

    it('shows loading text when deleting', () => {
      const onDelete = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={mockPaymentMethod}
          onDelete={onDelete}
          isDeleting={true}
        />
      );

      expect(screen.getByText('Removing...')).toBeInTheDocument();
      expect(screen.queryByText('Remove')).not.toBeInTheDocument();
    });

    it('does not disable Remove button when isDeleting is false', () => {
      const onDelete = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={mockPaymentMethod}
          onDelete={onDelete}
          isDeleting={false}
        />
      );

      const button = screen.getByRole('button', { name: 'Remove' });
      expect(button).not.toBeDisabled();
    });
  });

  describe('Action Buttons Layout', () => {
    it('shows both buttons when both callbacks provided and not default', () => {
      const onSetDefault = jest.fn();
      const onDelete = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={mockPaymentMethod}
          onSetDefault={onSetDefault}
          onDelete={onDelete}
        />
      );

      expect(screen.getByRole('button', { name: 'Set Default' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('shows only Remove button when default card', () => {
      const defaultMethod = { ...mockPaymentMethod, is_default: true };
      const onSetDefault = jest.fn();
      const onDelete = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={defaultMethod}
          onSetDefault={onSetDefault}
          onDelete={onDelete}
        />
      );

      expect(screen.queryByRole('button', { name: 'Set Default' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('shows no action buttons when no callbacks provided', () => {
      render(<PaymentMethodCard paymentMethod={mockPaymentMethod} />);

      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBe(0);
    });
  });

  describe('Card Icon Container', () => {
    it('renders icon container with correct styling', () => {
      const { container } = render(<PaymentMethodCard paymentMethod={mockPaymentMethod} />);
      const iconContainer = container.querySelector('.w-12.h-8');
      expect(iconContainer).toBeInTheDocument();
      expect(iconContainer).toHaveClass('bg-surface-100', 'rounded');
    });

    it('displays brand abbreviation in icon container', () => {
      render(<PaymentMethodCard paymentMethod={mockPaymentMethod} />);
      const brandText = screen.getByText('VISA');
      expect(brandText.className).toContain('text-xs');
      expect(brandText.className).toContain('font-semibold');
      expect(brandText.className).toContain('uppercase');
    });
  });

  describe('Complete Payment Method Display', () => {
    it('renders all elements for complete payment method', () => {
      const onSetDefault = jest.fn();
      const onDelete = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={mockPaymentMethod}
          onSetDefault={onSetDefault}
          onDelete={onDelete}
        />
      );

      expect(screen.getByText('VISA')).toBeInTheDocument();
      expect(screen.getByText('Visa ****4242')).toBeInTheDocument();
      expect(screen.getByText('Expires 12/25')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Set Default' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('renders default payment method correctly', () => {
      const defaultMethod = { ...mockPaymentMethod, is_default: true };
      const onDelete = jest.fn();
      render(
        <PaymentMethodCard
          paymentMethod={defaultMethod}
          onDelete={onDelete}
        />
      );

      expect(screen.getByText('Visa ****4242')).toBeInTheDocument();
      expect(screen.getByText('Default')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Set Default' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });
  });
});
