import { render, screen, fireEvent } from '@testing-library/react';
import {
  EmptyState,
  EmptyPackages,
  EmptyRoutes,
  EmptyMessages,
  EmptyNotifications,
  EmptySearchResults,
  ErrorState,
} from '../EmptyState';

// Mock Button component
jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, variant }: any) => (
    <button onClick={onClick} data-variant={variant}>
      {children}
    </button>
  ),
}));

describe('EmptyState Component', () => {
  describe('Basic Rendering', () => {
    it('renders title', () => {
      render(<EmptyState title="No items found" />);
      expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    it('renders description when provided', () => {
      render(<EmptyState title="Empty" description="This is a description" />);
      expect(screen.getByText('This is a description')).toBeInTheDocument();
    });

    it('does not render description when not provided', () => {
      const { container } = render(<EmptyState title="Empty" />);
      expect(container.querySelector('.text-sm.text-surface-500')).not.toBeInTheDocument();
    });

    it('title has correct styling', () => {
      render(<EmptyState title="No data" />);
      const title = screen.getByText('No data');
      expect(title.className).toContain('text-lg');
      expect(title.className).toContain('font-semibold');
      expect(title.className).toContain('text-surface-900');
    });

    it('description has correct styling', () => {
      render(<EmptyState title="Empty" description="Description text" />);
      const description = screen.getByText('Description text');
      expect(description.className).toContain('text-sm');
      expect(description.className).toContain('text-surface-500');
      expect(description.className).toContain('max-w-sm');
    });
  });

  describe('Icon Display', () => {
    it('renders default icon when no variant or custom icon provided', () => {
      const { container } = render(<EmptyState title="Empty" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-12', 'h-12');
    });

    it('renders custom icon when provided', () => {
      const customIcon = <div data-testid="custom-icon">Custom</div>;
      render(<EmptyState title="Empty" icon={customIcon} />);
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('custom icon overrides variant icon', () => {
      const customIcon = <div data-testid="custom-icon">Custom</div>;
      render(<EmptyState title="Empty" variant="packages" icon={customIcon} />);
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('icon container has correct styling', () => {
      const { container } = render(<EmptyState title="Empty" />);
      const iconContainer = container.querySelector('.w-20.h-20');
      expect(iconContainer).toHaveClass('rounded-full', 'bg-surface-100', 'flex', 'items-center', 'justify-center', 'text-surface-400');
    });
  });

  describe('Variant Icons', () => {
    it('renders default variant icon', () => {
      const { container } = render(<EmptyState variant="default" title="Empty" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders packages variant icon', () => {
      const { container } = render(<EmptyState variant="packages" title="No packages" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders routes variant icon', () => {
      const { container } = render(<EmptyState variant="routes" title="No routes" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders messages variant icon', () => {
      const { container } = render(<EmptyState variant="messages" title="No messages" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders notifications variant icon', () => {
      const { container } = render(<EmptyState variant="notifications" title="No notifications" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders search variant icon', () => {
      const { container } = render(<EmptyState variant="search" title="No results" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders error variant icon', () => {
      const { container } = render(<EmptyState variant="error" title="Error" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('renders primary action button when provided', () => {
      const action = { label: 'Create Item', onClick: jest.fn() };
      render(<EmptyState title="Empty" action={action} />);
      expect(screen.getByRole('button', { name: 'Create Item' })).toBeInTheDocument();
    });

    it('does not render action button when not provided', () => {
      render(<EmptyState title="Empty" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('calls action onClick when button is clicked', () => {
      const onClick = jest.fn();
      const action = { label: 'Click me', onClick };
      render(<EmptyState title="Empty" action={action} />);

      const button = screen.getByRole('button', { name: 'Click me' });
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('action button has primary variant', () => {
      const action = { label: 'Action', onClick: jest.fn() };
      render(<EmptyState title="Empty" action={action} />);

      const button = screen.getByRole('button', { name: 'Action' });
      expect(button).toHaveAttribute('data-variant', 'primary');
    });
  });

  describe('Secondary Action Button', () => {
    it('renders secondary action button when provided', () => {
      const secondaryAction = { label: 'Cancel', onClick: jest.fn() };
      render(<EmptyState title="Empty" secondaryAction={secondaryAction} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('calls secondaryAction onClick when button is clicked', () => {
      const onClick = jest.fn();
      const secondaryAction = { label: 'Cancel', onClick };
      render(<EmptyState title="Empty" secondaryAction={secondaryAction} />);

      const button = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('secondary button has outline variant', () => {
      const secondaryAction = { label: 'Cancel', onClick: jest.fn() };
      render(<EmptyState title="Empty" secondaryAction={secondaryAction} />);

      const button = screen.getByRole('button', { name: 'Cancel' });
      expect(button).toHaveAttribute('data-variant', 'outline');
    });

    it('renders both primary and secondary actions', () => {
      const action = { label: 'Create', onClick: jest.fn() };
      const secondaryAction = { label: 'Cancel', onClick: jest.fn() };
      render(<EmptyState title="Empty" action={action} secondaryAction={secondaryAction} />);

      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders only secondary action when primary not provided', () => {
      const secondaryAction = { label: 'Cancel', onClick: jest.fn() };
      render(<EmptyState title="Empty" secondaryAction={secondaryAction} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getAllByRole('button').length).toBe(1);
    });
  });

  describe('Layout and Styling', () => {
    it('uses flex column layout with center alignment', () => {
      const { container } = render(<EmptyState title="Empty" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'text-center');
    });

    it('has proper padding', () => {
      const { container } = render(<EmptyState title="Empty" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('py-12', 'px-6');
    });

    it('applies custom className', () => {
      const { container } = render(<EmptyState title="Empty" className="custom-class" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('action buttons container has flex layout with gap', () => {
      const action = { label: 'Action', onClick: jest.fn() };
      const { container } = render(<EmptyState title="Empty" action={action} />);
      const buttonContainer = container.querySelector('.flex.items-center.gap-3');
      expect(buttonContainer).toBeInTheDocument();
    });
  });
});

describe('EmptyPackages Preset', () => {
  it('renders packages variant', () => {
    const { container } = render(<EmptyPackages />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('displays correct title', () => {
    render(<EmptyPackages />);
    expect(screen.getByText('No packages yet')).toBeInTheDocument();
  });

  it('displays correct description', () => {
    render(<EmptyPackages />);
    expect(screen.getByText(/You haven't created any packages/)).toBeInTheDocument();
  });

  it('renders create button when callback provided', () => {
    const onCreatePackage = jest.fn();
    render(<EmptyPackages onCreatePackage={onCreatePackage} />);
    expect(screen.getByRole('button', { name: 'Create Package' })).toBeInTheDocument();
  });

  it('does not render button when callback not provided', () => {
    render(<EmptyPackages />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onCreatePackage when button clicked', () => {
    const onCreatePackage = jest.fn();
    render(<EmptyPackages onCreatePackage={onCreatePackage} />);

    const button = screen.getByRole('button', { name: 'Create Package' });
    fireEvent.click(button);

    expect(onCreatePackage).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyRoutes Preset', () => {
  it('renders routes variant', () => {
    const { container } = render(<EmptyRoutes />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('displays correct title', () => {
    render(<EmptyRoutes />);
    expect(screen.getByText('No routes found')).toBeInTheDocument();
  });

  it('displays correct description', () => {
    render(<EmptyRoutes />);
    expect(screen.getByText(/You don't have any delivery routes yet/)).toBeInTheDocument();
  });

  it('renders create button when callback provided', () => {
    const onCreateRoute = jest.fn();
    render(<EmptyRoutes onCreateRoute={onCreateRoute} />);
    expect(screen.getByRole('button', { name: 'Create Route' })).toBeInTheDocument();
  });

  it('does not render button when callback not provided', () => {
    render(<EmptyRoutes />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onCreateRoute when button clicked', () => {
    const onCreateRoute = jest.fn();
    render(<EmptyRoutes onCreateRoute={onCreateRoute} />);

    const button = screen.getByRole('button', { name: 'Create Route' });
    fireEvent.click(button);

    expect(onCreateRoute).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyMessages Preset', () => {
  it('renders messages variant', () => {
    const { container } = render(<EmptyMessages />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('displays correct title', () => {
    render(<EmptyMessages />);
    expect(screen.getByText('No messages')).toBeInTheDocument();
  });

  it('displays correct description', () => {
    render(<EmptyMessages />);
    expect(screen.getByText(/You don't have any conversations yet/)).toBeInTheDocument();
  });

  it('does not render action button', () => {
    render(<EmptyMessages />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('EmptyNotifications Preset', () => {
  it('renders notifications variant', () => {
    const { container } = render(<EmptyNotifications />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('displays correct title', () => {
    render(<EmptyNotifications />);
    expect(screen.getByText('All caught up!')).toBeInTheDocument();
  });

  it('displays correct description', () => {
    render(<EmptyNotifications />);
    expect(screen.getByText(/You don't have any notifications right now/)).toBeInTheDocument();
  });

  it('does not render action button', () => {
    render(<EmptyNotifications />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('EmptySearchResults Preset', () => {
  it('renders search variant', () => {
    const { container } = render(<EmptySearchResults query="test" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('displays correct title', () => {
    render(<EmptySearchResults query="test" />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('displays search query in description', () => {
    render(<EmptySearchResults query="laptop" />);
    expect(screen.getByText(/We couldn't find anything matching "laptop"/)).toBeInTheDocument();
  });

  it('renders clear button when callback provided', () => {
    const onClear = jest.fn();
    render(<EmptySearchResults query="test" onClear={onClear} />);
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('does not render button when callback not provided', () => {
    render(<EmptySearchResults query="test" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onClear when button clicked', () => {
    const onClear = jest.fn();
    render(<EmptySearchResults query="test" onClear={onClear} />);

    const button = screen.getByRole('button', { name: 'Clear search' });
    fireEvent.click(button);

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('updates description when query changes', () => {
    const { rerender } = render(<EmptySearchResults query="laptop" />);
    expect(screen.getByText(/matching "laptop"/)).toBeInTheDocument();

    rerender(<EmptySearchResults query="phone" />);
    expect(screen.getByText(/matching "phone"/)).toBeInTheDocument();
  });
});

describe('ErrorState Preset', () => {
  it('renders error variant', () => {
    const { container } = render(<ErrorState />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('displays correct title', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays correct description', () => {
    render(<ErrorState />);
    expect(screen.getByText(/We encountered an error while loading this page/)).toBeInTheDocument();
  });

  it('renders retry button when callback provided', () => {
    const onRetry = jest.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('does not render button when callback not provided', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onRetry when button clicked', () => {
    const onRetry = jest.fn();
    render(<ErrorState onRetry={onRetry} />);

    const button = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(button);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('Preset Accessibility', () => {
  it('EmptyPackages is accessible via EmptyState.Packages', () => {
    expect(EmptyState.Packages).toBe(EmptyPackages);
  });

  it('EmptyRoutes is accessible via EmptyState.Routes', () => {
    expect(EmptyState.Routes).toBe(EmptyRoutes);
  });

  it('EmptyMessages is accessible via EmptyState.Messages', () => {
    expect(EmptyState.Messages).toBe(EmptyMessages);
  });

  it('EmptyNotifications is accessible via EmptyState.Notifications', () => {
    expect(EmptyState.Notifications).toBe(EmptyNotifications);
  });

  it('EmptySearchResults is accessible via EmptyState.SearchResults', () => {
    expect(EmptyState.SearchResults).toBe(EmptySearchResults);
  });

  it('ErrorState is accessible via EmptyState.Error', () => {
    expect(EmptyState.Error).toBe(ErrorState);
  });
});

describe('Complete Empty State Display', () => {
  it('renders full empty state with all features', () => {
    const action = { label: 'Create', onClick: jest.fn() };
    const secondaryAction = { label: 'Learn More', onClick: jest.fn() };

    render(
      <EmptyState
        variant="packages"
        title="No packages"
        description="Start creating packages to begin shipping"
        action={action}
        secondaryAction={secondaryAction}
      />
    );

    expect(screen.getByText('No packages')).toBeInTheDocument();
    expect(screen.getByText('Start creating packages to begin shipping')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Learn More' })).toBeInTheDocument();
  });

  it('renders minimal empty state', () => {
    render(<EmptyState title="Empty" />);

    expect(screen.getByText('Empty')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
