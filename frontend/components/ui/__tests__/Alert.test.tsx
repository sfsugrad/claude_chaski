import { render, screen, fireEvent } from '@testing-library/react';
import { Alert } from '../Alert';

describe('Alert Component', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<Alert>Alert message</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(<Alert>Test alert message</Alert>);
      expect(screen.getByText('Test alert message')).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(<Alert ref={ref}>Alert</Alert>);
      expect(ref).toHaveBeenCalled();
    });

    it('has role="alert" for accessibility', () => {
      render(<Alert>Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('role', 'alert');
    });
  });

  describe('Variants', () => {
    it('renders success variant', () => {
      render(<Alert variant="success">Success alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-success-50', 'text-success-800', 'border-success-200');
    });

    it('renders warning variant', () => {
      render(<Alert variant="warning">Warning alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-warning-50', 'text-warning-800', 'border-warning-200');
    });

    it('renders error variant', () => {
      render(<Alert variant="error">Error alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-error-50', 'text-error-800', 'border-error-200');
    });

    it('renders info variant (default)', () => {
      render(<Alert variant="info">Info alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-info-50', 'text-info-800', 'border-info-200');
    });

    it('uses info variant by default', () => {
      render(<Alert>Default alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-info-50', 'text-info-800', 'border-info-200');
    });
  });

  describe('Title', () => {
    it('does not render title by default', () => {
      const { container } = render(<Alert>Message only</Alert>);
      const title = container.querySelector('.font-medium');
      expect(title).not.toBeInTheDocument();
    });

    it('renders title when provided', () => {
      render(<Alert title="Alert Title">Message</Alert>);
      expect(screen.getByText('Alert Title')).toBeInTheDocument();
    });

    it('title has correct styling', () => {
      render(<Alert title="Alert Title">Message</Alert>);
      const title = screen.getByText('Alert Title');
      expect(title).toHaveClass('font-medium', 'mb-1');
    });

    it('renders both title and children', () => {
      render(<Alert title="Alert Title">Alert message content</Alert>);
      expect(screen.getByText('Alert Title')).toBeInTheDocument();
      expect(screen.getByText('Alert message content')).toBeInTheDocument();
    });

    it('applies opacity to children when title is present', () => {
      const { container } = render(<Alert title="Title">Content</Alert>);
      const contentDiv = screen.getByText('Content').parentElement;
      expect(contentDiv).toHaveClass('opacity-90');
    });

    it('does not apply opacity to children when title is absent', () => {
      const { container } = render(<Alert>Content</Alert>);
      const contentDiv = screen.getByText('Content').parentElement;
      expect(contentDiv).not.toHaveClass('opacity-90');
    });
  });

  describe('Default Icons', () => {
    it('renders default icon for success variant', () => {
      const { container } = render(<Alert variant="success">Success</Alert>);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('text-success-500');
    });

    it('renders default icon for warning variant', () => {
      const { container } = render(<Alert variant="warning">Warning</Alert>);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('text-warning-500');
    });

    it('renders default icon for error variant', () => {
      const { container } = render(<Alert variant="error">Error</Alert>);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('text-error-500');
    });

    it('renders default icon for info variant', () => {
      const { container } = render(<Alert variant="info">Info</Alert>);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('text-info-500');
    });

    it('default icon has correct size', () => {
      const { container } = render(<Alert>Alert</Alert>);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('h-5', 'w-5');
    });
  });

  describe('Custom Icon', () => {
    it('renders custom icon instead of default', () => {
      const CustomIcon = () => <span data-testid="custom-icon">★</span>;
      render(<Alert icon={<CustomIcon />}>Alert with custom icon</Alert>);
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('does not render default icon when custom icon provided', () => {
      const CustomIcon = () => <span data-testid="custom-icon">★</span>;
      const { container } = render(
        <Alert variant="success" icon={<CustomIcon />}>
          Alert
        </Alert>
      );
      const defaultSvg = container.querySelector('.text-success-500');
      expect(defaultSvg).not.toBeInTheDocument();
    });
  });

  describe('Dismissible', () => {
    it('does not show dismiss button by default', () => {
      render(<Alert>Not dismissible</Alert>);
      const dismissButton = screen.queryByLabelText('Dismiss');
      expect(dismissButton).not.toBeInTheDocument();
    });

    it('shows dismiss button when dismissible is true', () => {
      render(<Alert dismissible>Dismissible alert</Alert>);
      const dismissButton = screen.getByLabelText('Dismiss');
      expect(dismissButton).toBeInTheDocument();
    });

    it('dismiss button has correct aria-label', () => {
      render(<Alert dismissible>Dismissible</Alert>);
      const dismissButton = screen.getByLabelText('Dismiss');
      expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss');
    });

    it('calls onDismiss when dismiss button is clicked', () => {
      const onDismiss = jest.fn();
      render(
        <Alert dismissible onDismiss={onDismiss}>
          Dismissible alert
        </Alert>
      );
      const dismissButton = screen.getByLabelText('Dismiss');
      fireEvent.click(dismissButton);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('dismiss button has type="button"', () => {
      render(<Alert dismissible>Alert</Alert>);
      const dismissButton = screen.getByLabelText('Dismiss');
      expect(dismissButton).toHaveAttribute('type', 'button');
    });

    it('dismiss button renders SVG icon', () => {
      const { container } = render(<Alert dismissible>Alert</Alert>);
      const dismissButton = screen.getByLabelText('Dismiss');
      const svg = dismissButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('h-4', 'w-4');
    });
  });

  describe('Base Styling', () => {
    it('has flex layout classes', () => {
      render(<Alert>Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('flex', 'items-start', 'gap-3');
    });

    it('has padding and border classes', () => {
      render(<Alert>Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('p-4', 'rounded-lg', 'border');
    });

    it('has text size class', () => {
      render(<Alert>Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('text-sm');
    });
  });

  describe('Custom Classes', () => {
    it('applies custom className', () => {
      render(<Alert className="custom-alert">Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-alert');
    });

    it('merges custom className with default classes', () => {
      render(<Alert className="custom-alert">Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-alert');
      expect(alert).toHaveClass('flex');
      expect(alert).toHaveClass('rounded-lg');
    });
  });

  describe('HTML Attributes', () => {
    it('accepts and applies data attributes', () => {
      render(<Alert data-testid="custom-alert">Alert</Alert>);
      expect(screen.getByTestId('custom-alert')).toBeInTheDocument();
    });

    it('accepts and applies other HTML attributes', () => {
      render(<Alert id="alert-1">Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('id', 'alert-1');
    });
  });

  describe('Combined Features', () => {
    it('renders alert with all features', () => {
      const onDismiss = jest.fn();
      const CustomIcon = () => <span data-testid="custom-icon">⚠</span>;

      render(
        <Alert
          variant="warning"
          title="Warning Title"
          dismissible
          onDismiss={onDismiss}
          icon={<CustomIcon />}
        >
          This is a warning message with all features enabled.
        </Alert>
      );

      // Check variant
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-warning-50', 'text-warning-800');

      // Check title
      expect(screen.getByText('Warning Title')).toBeInTheDocument();

      // Check content
      expect(
        screen.getByText('This is a warning message with all features enabled.')
      ).toBeInTheDocument();

      // Check custom icon
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();

      // Check dismiss button
      const dismissButton = screen.getByLabelText('Dismiss');
      expect(dismissButton).toBeInTheDocument();

      // Test dismiss functionality
      fireEvent.click(dismissButton);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('renders error alert with title and default icon', () => {
      const { container } = render(
        <Alert variant="error" title="Error Occurred">
          Something went wrong. Please try again.
        </Alert>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-error-50');

      expect(screen.getByText('Error Occurred')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();

      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-error-500');
    });

    it('renders success alert with custom styling', () => {
      render(
        <Alert variant="success" className="custom-success" title="Success!">
          Operation completed successfully.
        </Alert>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-success');
      expect(alert).toHaveClass('bg-success-50');
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });
  });
});
