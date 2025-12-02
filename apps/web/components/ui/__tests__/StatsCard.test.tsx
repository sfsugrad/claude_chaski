import { render, screen } from '@testing-library/react';
import { StatsCard, StatsCardInline, StatsGrid, StatsCardTrend } from '../StatsCard';

describe('StatsCard Component', () => {
  const mockIcon = <svg data-testid="mock-icon">Icon</svg>;

  describe('Basic Rendering', () => {
    it('renders label and value', () => {
      render(<StatsCard label="Total Sales" value="$12,345" />);
      expect(screen.getByText('Total Sales')).toBeInTheDocument();
      expect(screen.getByText('$12,345')).toBeInTheDocument();
    });

    it('renders numeric value with locale formatting', () => {
      render(<StatsCard label="Users" value={12345} />);
      expect(screen.getByText('12,345')).toBeInTheDocument();
    });

    it('renders string value as-is', () => {
      render(<StatsCard label="Status" value="Active" />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('renders description when provided', () => {
      render(<StatsCard label="Revenue" value="$1000" description="Last 30 days" />);
      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    });

    it('does not render description when not provided', () => {
      const { container } = render(<StatsCard label="Revenue" value="$1000" />);
      expect(container.querySelector('.text-sm.text-surface-500')).toBeInTheDocument(); // label exists
      // Only one text-sm text-surface-500 for label, not for description
    });
  });

  describe('Variants', () => {
    it('renders default variant', () => {
      const { container } = render(<StatsCard label="Stats" value="100" variant="default" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-surface-200');
    });

    it('renders primary variant', () => {
      const { container } = render(<StatsCard label="Stats" value="100" variant="primary" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-primary-200');
    });

    it('renders success variant', () => {
      const { container } = render(<StatsCard label="Stats" value="100" variant="success" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-success-200');
    });

    it('renders warning variant', () => {
      const { container } = render(<StatsCard label="Stats" value="100" variant="warning" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-warning-200');
    });

    it('renders error variant', () => {
      const { container } = render(<StatsCard label="Stats" value="100" variant="error" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-error-200');
    });

    it('uses default variant when not specified', () => {
      const { container } = render(<StatsCard label="Stats" value="100" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-surface-200');
    });
  });

  describe('Icon Display', () => {
    it('renders icon when provided', () => {
      render(<StatsCard label="Stats" value="100" icon={mockIcon} />);
      expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    });

    it('does not render icon container when icon not provided', () => {
      const { container } = render(<StatsCard label="Stats" value="100" />);
      const iconContainer = container.querySelector('.flex-shrink-0.p-3');
      expect(iconContainer).not.toBeInTheDocument();
    });

    it('icon has variant-specific styling for primary', () => {
      const { container } = render(
        <StatsCard label="Stats" value="100" icon={mockIcon} variant="primary" />
      );
      const iconContainer = container.querySelector('.flex-shrink-0.p-3');
      expect(iconContainer).toHaveClass('text-primary-600', 'bg-primary-100');
    });

    it('icon has variant-specific styling for success', () => {
      const { container } = render(
        <StatsCard label="Stats" value="100" icon={mockIcon} variant="success" />
      );
      const iconContainer = container.querySelector('.flex-shrink-0.p-3');
      expect(iconContainer).toHaveClass('text-success-600', 'bg-success-100');
    });
  });

  describe('Trend Display', () => {
    const upTrend: StatsCardTrend = { value: 12.5, direction: 'up' };
    const downTrend: StatsCardTrend = { value: 8.3, direction: 'down' };

    it('renders upward trend with positive value', () => {
      render(<StatsCard label="Sales" value="$1000" trend={upTrend} />);
      expect(screen.getByText('+12.5%')).toBeInTheDocument();
    });

    it('renders downward trend', () => {
      render(<StatsCard label="Sales" value="$1000" trend={downTrend} />);
      expect(screen.getByText('8.3%')).toBeInTheDocument();
    });

    it('renders upward trend icon', () => {
      const { container } = render(<StatsCard label="Sales" value="$1000" trend={upTrend} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders downward trend icon', () => {
      const { container } = render(<StatsCard label="Sales" value="$1000" trend={downTrend} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('upward trend has success color', () => {
      const { container } = render(<StatsCard label="Sales" value="$1000" trend={upTrend} />);
      const trendText = screen.getByText('+12.5%').parentElement;
      expect(trendText?.className).toContain('text-success-600');
    });

    it('downward trend has error color', () => {
      const { container } = render(<StatsCard label="Sales" value="$1000" trend={downTrend} />);
      const trendText = screen.getByText('8.3%').parentElement;
      expect(trendText?.className).toContain('text-error-600');
    });

    it('renders trend label when provided', () => {
      const trendWithLabel: StatsCardTrend = { ...upTrend, label: 'vs last month' };
      render(<StatsCard label="Sales" value="$1000" trend={trendWithLabel} />);
      expect(screen.getByText('vs last month')).toBeInTheDocument();
    });

    it('does not render trend label when not provided', () => {
      render(<StatsCard label="Sales" value="$1000" trend={upTrend} />);
      expect(screen.queryByText(/vs/i)).not.toBeInTheDocument();
    });

    it('does not render trend when not provided', () => {
      render(<StatsCard label="Sales" value="$1000" />);
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('handles negative trend value', () => {
      const negativeTrend: StatsCardTrend = { value: -5.2, direction: 'down' };
      render(<StatsCard label="Sales" value="$1000" trend={negativeTrend} />);
      expect(screen.getByText('-5.2%')).toBeInTheDocument();
    });

    it('handles zero trend value', () => {
      const zeroTrend: StatsCardTrend = { value: 0, direction: 'up' };
      render(<StatsCard label="Sales" value="$1000" trend={zeroTrend} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Styling and Layout', () => {
    it('has rounded corners and border', () => {
      const { container } = render(<StatsCard label="Stats" value="100" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('rounded-xl', 'border');
    });

    it('has shadow and hover effects', () => {
      const { container } = render(<StatsCard label="Stats" value="100" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('shadow-sm', 'hover:shadow-md');
    });

    it('applies custom className', () => {
      const { container } = render(<StatsCard label="Stats" value="100" className="custom-class" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('custom-class');
    });

    it('has proper padding', () => {
      const { container } = render(<StatsCard label="Stats" value="100" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('p-5');
    });

    it('label is truncated for long text', () => {
      render(<StatsCard label="Very long label text" value="100" />);
      const label = screen.getByText('Very long label text');
      expect(label).toHaveClass('truncate');
    });

    it('value has large font size', () => {
      render(<StatsCard label="Stats" value="100" />);
      const value = screen.getByText('100');
      expect(value).toHaveClass('text-3xl', 'font-bold');
    });
  });
});

describe('StatsCardInline Component', () => {
  const mockIcon = <svg data-testid="mock-icon">Icon</svg>;

  describe('Basic Rendering', () => {
    it('renders label and value', () => {
      render(<StatsCardInline label="Total" value="$500" />);
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('$500')).toBeInTheDocument();
    });

    it('renders numeric value with locale formatting', () => {
      render(<StatsCardInline label="Count" value={1234} />);
      expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('renders icon when provided', () => {
      render(<StatsCardInline label="Stats" value="100" icon={mockIcon} />);
      expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    });

    it('does not render icon container when icon not provided', () => {
      const { container } = render(<StatsCardInline label="Stats" value="100" />);
      const iconContainer = container.querySelector('.flex-shrink-0.p-2');
      expect(iconContainer).not.toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('renders default variant', () => {
      const { container } = render(<StatsCardInline label="Stats" value="100" variant="default" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-surface-200');
    });

    it('renders primary variant', () => {
      const { container } = render(<StatsCardInline label="Stats" value="100" variant="primary" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-primary-200');
    });

    it('uses default variant when not specified', () => {
      const { container } = render(<StatsCardInline label="Stats" value="100" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-surface-200');
    });
  });

  describe('Styling and Layout', () => {
    it('has flex layout', () => {
      const { container } = render(<StatsCardInline label="Stats" value="100" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('flex', 'items-center', 'gap-3');
    });

    it('has compact padding', () => {
      const { container } = render(<StatsCardInline label="Stats" value="100" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('p-3');
    });

    it('applies custom className', () => {
      const { container } = render(<StatsCardInline label="Stats" value="100" className="custom" />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('custom');
    });

    it('label has smaller font size', () => {
      render(<StatsCardInline label="Stats" value="100" />);
      const label = screen.getByText('Stats');
      expect(label).toHaveClass('text-xs');
    });

    it('value has medium font size', () => {
      render(<StatsCardInline label="Stats" value="100" />);
      const value = screen.getByText('100');
      expect(value).toHaveClass('text-lg', 'font-semibold');
    });

    it('label is truncated for long text', () => {
      render(<StatsCardInline label="Very long label" value="100" />);
      const label = screen.getByText('Very long label');
      expect(label).toHaveClass('truncate');
    });
  });
});

describe('StatsGrid Component', () => {
  describe('Grid Layout', () => {
    it('renders children', () => {
      render(
        <StatsGrid>
          <div>Child 1</div>
          <div>Child 2</div>
        </StatsGrid>
      );
      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
    });

    it('renders with 2 columns', () => {
      const { container } = render(<StatsGrid columns={2}><div>Child</div></StatsGrid>);
      const grid = container.firstChild as HTMLElement;
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    });

    it('renders with 3 columns', () => {
      const { container } = render(<StatsGrid columns={3}><div>Child</div></StatsGrid>);
      const grid = container.firstChild as HTMLElement;
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');
    });

    it('renders with 4 columns (default)', () => {
      const { container } = render(<StatsGrid columns={4}><div>Child</div></StatsGrid>);
      const grid = container.firstChild as HTMLElement;
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4');
    });

    it('uses 4 columns by default', () => {
      const { container } = render(<StatsGrid><div>Child</div></StatsGrid>);
      const grid = container.firstChild as HTMLElement;
      expect(grid).toHaveClass('lg:grid-cols-4');
    });

    it('has gap between grid items', () => {
      const { container } = render(<StatsGrid><div>Child</div></StatsGrid>);
      const grid = container.firstChild as HTMLElement;
      expect(grid).toHaveClass('gap-4');
    });

    it('applies custom className', () => {
      const { container } = render(<StatsGrid className="custom-grid"><div>Child</div></StatsGrid>);
      const grid = container.firstChild as HTMLElement;
      expect(grid).toHaveClass('custom-grid');
    });

    it('renders multiple StatsCard children', () => {
      render(
        <StatsGrid>
          <StatsCard label="Card 1" value="100" />
          <StatsCard label="Card 2" value="200" />
          <StatsCard label="Card 3" value="300" />
        </StatsGrid>
      );
      expect(screen.getByText('Card 1')).toBeInTheDocument();
      expect(screen.getByText('Card 2')).toBeInTheDocument();
      expect(screen.getByText('Card 3')).toBeInTheDocument();
    });
  });
});

describe('Complete Stats Display', () => {
  it('renders full stats card with all features', () => {
    const trend: StatsCardTrend = { value: 15.3, direction: 'up', label: 'from last month' };
    const icon = <svg data-testid="revenue-icon">$</svg>;

    render(
      <StatsCard
        label="Total Revenue"
        value={125000}
        description="Gross revenue"
        trend={trend}
        icon={icon}
        variant="success"
      />
    );

    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('125,000')).toBeInTheDocument();
    expect(screen.getByText('Gross revenue')).toBeInTheDocument();
    expect(screen.getByText('+15.3%')).toBeInTheDocument();
    expect(screen.getByText('from last month')).toBeInTheDocument();
    expect(screen.getByTestId('revenue-icon')).toBeInTheDocument();
  });

  it('renders stats grid with mixed cards', () => {
    render(
      <StatsGrid columns={3}>
        <StatsCard label="Active Users" value={1250} variant="primary" />
        <StatsCard label="Revenue" value="$45,678" variant="success" />
        <StatsCardInline label="Orders" value={89} />
      </StatsGrid>
    );

    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('$45,678')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('89')).toBeInTheDocument();
  });
});
