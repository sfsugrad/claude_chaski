import { render, screen, fireEvent } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge Component', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<Badge>Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(<Badge>Test Badge</Badge>);
      expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(<Badge ref={ref}>Badge</Badge>);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Variants', () => {
    it('renders primary variant', () => {
      render(<Badge variant="primary">Primary</Badge>);
      const badge = screen.getByText('Primary');
      expect(badge).toHaveClass('bg-primary-100', 'text-primary-700');
    });

    it('renders secondary variant', () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      const badge = screen.getByText('Secondary');
      expect(badge).toHaveClass('bg-secondary-100', 'text-secondary-700');
    });

    it('renders success variant', () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText('Success');
      expect(badge).toHaveClass('bg-success-100', 'text-success-700');
    });

    it('renders warning variant', () => {
      render(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText('Warning');
      expect(badge).toHaveClass('bg-warning-100', 'text-warning-700');
    });

    it('renders error variant', () => {
      render(<Badge variant="error">Error</Badge>);
      const badge = screen.getByText('Error');
      expect(badge).toHaveClass('bg-error-100', 'text-error-700');
    });

    it('renders info variant', () => {
      render(<Badge variant="info">Info</Badge>);
      const badge = screen.getByText('Info');
      expect(badge).toHaveClass('bg-info-100', 'text-info-700');
    });

    it('renders neutral variant (default)', () => {
      render(<Badge variant="neutral">Neutral</Badge>);
      const badge = screen.getByText('Neutral');
      expect(badge).toHaveClass('bg-surface-100', 'text-surface-700');
    });

    it('uses neutral variant by default', () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge).toHaveClass('bg-surface-100', 'text-surface-700');
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      render(<Badge size="sm">Small</Badge>);
      const badge = screen.getByText('Small');
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
    });

    it('renders medium size (default)', () => {
      render(<Badge size="md">Medium</Badge>);
      const badge = screen.getByText('Medium');
      expect(badge).toHaveClass('px-2.5', 'py-0.5', 'text-xs');
    });

    it('uses medium size by default', () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge).toHaveClass('px-2.5');
    });
  });

  describe('Dot Indicator', () => {
    it('does not show dot by default', () => {
      const { container } = render(<Badge>No Dot</Badge>);
      const dot = container.querySelector('.w-1\\.5.h-1\\.5');
      expect(dot).not.toBeInTheDocument();
    });

    it('shows dot when dot prop is true', () => {
      const { container } = render(<Badge dot>With Dot</Badge>);
      const dot = container.querySelector('.w-1\\.5.h-1\\.5');
      expect(dot).toBeInTheDocument();
    });

    it('dot has aria-hidden attribute', () => {
      const { container } = render(<Badge dot>Dot Badge</Badge>);
      const dot = container.querySelector('.w-1\\.5.h-1\\.5');
      expect(dot).toHaveAttribute('aria-hidden', 'true');
    });

    it('dot has correct color for primary variant', () => {
      const { container } = render(
        <Badge variant="primary" dot>
          Primary
        </Badge>
      );
      const dot = container.querySelector('.w-1\\.5.h-1\\.5');
      expect(dot).toHaveClass('bg-primary-500');
    });

    it('dot has correct color for success variant', () => {
      const { container } = render(
        <Badge variant="success" dot>
          Success
        </Badge>
      );
      const dot = container.querySelector('.w-1\\.5.h-1\\.5');
      expect(dot).toHaveClass('bg-success-500');
    });

    it('dot has correct color for error variant', () => {
      const { container } = render(
        <Badge variant="error" dot>
          Error
        </Badge>
      );
      const dot = container.querySelector('.w-1\\.5.h-1\\.5');
      expect(dot).toHaveClass('bg-error-500');
    });
  });

  describe('Removable Badge', () => {
    it('does not show remove button by default', () => {
      render(<Badge>Not Removable</Badge>);
      const removeButton = screen.queryByLabelText('Remove');
      expect(removeButton).not.toBeInTheDocument();
    });

    it('shows remove button when removable is true', () => {
      render(<Badge removable>Removable</Badge>);
      const removeButton = screen.getByLabelText('Remove');
      expect(removeButton).toBeInTheDocument();
    });

    it('remove button has correct aria-label', () => {
      render(<Badge removable>Removable</Badge>);
      const removeButton = screen.getByLabelText('Remove');
      expect(removeButton).toHaveAttribute('aria-label', 'Remove');
    });

    it('calls onRemove when remove button is clicked', () => {
      const onRemove = jest.fn();
      render(
        <Badge removable onRemove={onRemove}>
          Removable
        </Badge>
      );
      const removeButton = screen.getByLabelText('Remove');
      fireEvent.click(removeButton);
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('remove button renders SVG icon', () => {
      const { container } = render(<Badge removable>Removable</Badge>);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('h-3', 'w-3');
    });

    it('remove button has type="button"', () => {
      render(<Badge removable>Removable</Badge>);
      const removeButton = screen.getByLabelText('Remove');
      expect(removeButton).toHaveAttribute('type', 'button');
    });
  });

  describe('Custom Classes', () => {
    it('applies custom className', () => {
      render(<Badge className="custom-badge">Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('custom-badge');
    });

    it('merges custom className with default classes', () => {
      render(<Badge className="custom-badge">Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('custom-badge');
      expect(badge).toHaveClass('font-medium');
      expect(badge).toHaveClass('rounded-full');
    });
  });

  describe('Base Styling', () => {
    it('has inline-flex display', () => {
      render(<Badge>Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('inline-flex');
    });

    it('has items-center class', () => {
      render(<Badge>Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('items-center');
    });

    it('has gap-1 class', () => {
      render(<Badge>Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('gap-1');
    });

    it('has font-medium class', () => {
      render(<Badge>Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('font-medium');
    });

    it('has rounded-full class', () => {
      render(<Badge>Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('rounded-full');
    });
  });

  describe('HTML Attributes', () => {
    it('accepts and applies data attributes', () => {
      render(<Badge data-testid="custom-badge">Badge</Badge>);
      expect(screen.getByTestId('custom-badge')).toBeInTheDocument();
    });

    it('accepts and applies other HTML attributes', () => {
      render(<Badge title="Badge title">Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveAttribute('title', 'Badge title');
    });
  });

  describe('Combined Features', () => {
    it('renders badge with dot and removable', () => {
      const onRemove = jest.fn();
      const { container } = render(
        <Badge variant="success" dot removable onRemove={onRemove}>
          Active
        </Badge>
      );

      expect(screen.getByText('Active')).toBeInTheDocument();

      // Check dot
      const dot = container.querySelector('.w-1\\.5.h-1\\.5');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass('bg-success-500');

      // Check remove button
      const removeButton = screen.getByLabelText('Remove');
      expect(removeButton).toBeInTheDocument();

      // Test remove functionality
      fireEvent.click(removeButton);
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('renders small badge with all features', () => {
      const { container } = render(
        <Badge variant="primary" size="sm" dot removable>
          Complete
        </Badge>
      );

      const badge = screen.getByText('Complete');
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
      expect(badge).toHaveClass('bg-primary-100', 'text-primary-700');

      const dot = container.querySelector('.w-1\\.5.h-1\\.5');
      expect(dot).toBeInTheDocument();

      const removeButton = screen.getByLabelText('Remove');
      expect(removeButton).toBeInTheDocument();
    });
  });
});
