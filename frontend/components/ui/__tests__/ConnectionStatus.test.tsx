import { render, screen } from '@testing-library/react';
import { ConnectionStatus, ConnectionStatusBadge } from '../ConnectionStatus';
import { ConnectionStatus as ConnectionStatusType } from '@/hooks/useWebSocket';

describe('ConnectionStatus Component', () => {
  describe('Basic Rendering', () => {
    it('renders connected status', () => {
      render(<ConnectionStatus status="connected" />);
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });

    it('renders connecting status', () => {
      render(<ConnectionStatus status="connecting" />);
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });

    it('renders disconnected status', () => {
      render(<ConnectionStatus status="disconnected" />);
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });

    it('renders error status', () => {
      render(<ConnectionStatus status="error" />);
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });

    it('has role="status" attribute', () => {
      render(<ConnectionStatus status="connected" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('ARIA Labels', () => {
    it('has correct aria-label for connected status', () => {
      render(<ConnectionStatus status="connected" />);
      expect(screen.getByLabelText('Connection status: Connected')).toBeInTheDocument();
    });

    it('has correct aria-label for connecting status', () => {
      render(<ConnectionStatus status="connecting" />);
      expect(screen.getByLabelText('Connection status: Connecting')).toBeInTheDocument();
    });

    it('has correct aria-label for disconnected status', () => {
      render(<ConnectionStatus status="disconnected" />);
      expect(screen.getByLabelText('Connection status: Offline')).toBeInTheDocument();
    });

    it('has correct aria-label for error status', () => {
      render(<ConnectionStatus status="error" />);
      expect(screen.getByLabelText('Connection status: Error')).toBeInTheDocument();
    });
  });

  describe('Tooltips', () => {
    it('shows connected description in title', () => {
      const { container } = render(<ConnectionStatus status="connected" />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('title', 'Real-time updates active');
    });

    it('shows connecting description in title', () => {
      const { container } = render(<ConnectionStatus status="connecting" />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('title', 'Establishing connection...');
    });

    it('shows disconnected description in title', () => {
      const { container } = render(<ConnectionStatus status="disconnected" />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('title', 'Real-time updates paused');
    });

    it('shows error description in title', () => {
      const { container } = render(<ConnectionStatus status="error" />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('title', 'Connection failed');
    });
  });

  describe('Status Dot Colors', () => {
    it('connected status has success color', () => {
      const { container } = render(<ConnectionStatus status="connected" />);
      const dot = container.querySelector('.bg-success-500');
      expect(dot).toBeInTheDocument();
    });

    it('connecting status has warning color', () => {
      const { container } = render(<ConnectionStatus status="connecting" />);
      const dot = container.querySelector('.bg-warning-500');
      expect(dot).toBeInTheDocument();
    });

    it('disconnected status has surface color', () => {
      const { container } = render(<ConnectionStatus status="disconnected" />);
      const dot = container.querySelector('.bg-surface-400');
      expect(dot).toBeInTheDocument();
    });

    it('error status has error color', () => {
      const { container } = render(<ConnectionStatus status="error" />);
      const dot = container.querySelector('.bg-error-500');
      expect(dot).toBeInTheDocument();
    });
  });

  describe('Pulse Animation', () => {
    it('shows pulse animation for connected status', () => {
      const { container } = render(<ConnectionStatus status="connected" />);
      const pulse = container.querySelector('.animate-ping');
      expect(pulse).toBeInTheDocument();
      expect(pulse).toHaveClass('bg-success-400');
    });

    it('shows pulse animation for connecting status', () => {
      const { container } = render(<ConnectionStatus status="connecting" />);
      const pulse = container.querySelector('.animate-ping');
      expect(pulse).toBeInTheDocument();
      expect(pulse).toHaveClass('bg-warning-400');
    });

    it('does not show pulse animation for disconnected status', () => {
      const { container } = render(<ConnectionStatus status="disconnected" />);
      const pulse = container.querySelector('.animate-ping');
      expect(pulse).not.toBeInTheDocument();
    });

    it('does not show pulse animation for error status', () => {
      const { container } = render(<ConnectionStatus status="error" />);
      const pulse = container.querySelector('.animate-ping');
      expect(pulse).not.toBeInTheDocument();
    });

    it('pulse has correct styling', () => {
      const { container } = render(<ConnectionStatus status="connected" />);
      const pulse = container.querySelector('.animate-ping');
      expect(pulse).toHaveClass('absolute', 'inline-flex', 'rounded-full', 'opacity-75');
    });
  });

  describe('Label Display', () => {
    it('shows label when showLabel is true', () => {
      render(<ConnectionStatus status="connected" showLabel={true} />);
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('does not show label when showLabel is false', () => {
      render(<ConnectionStatus status="connected" showLabel={false} />);
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    });

    it('does not show label by default', () => {
      render(<ConnectionStatus status="connected" />);
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    });

    it('displays "Connected" label for connected status', () => {
      render(<ConnectionStatus status="connected" showLabel />);
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('displays "Connecting" label for connecting status', () => {
      render(<ConnectionStatus status="connecting" showLabel />);
      expect(screen.getByText('Connecting')).toBeInTheDocument();
    });

    it('displays "Offline" label for disconnected status', () => {
      render(<ConnectionStatus status="disconnected" showLabel />);
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('displays "Error" label for error status', () => {
      render(<ConnectionStatus status="error" showLabel />);
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('label has correct text color', () => {
      render(<ConnectionStatus status="connected" showLabel />);
      const label = screen.getByText('Connected');
      expect(label.className).toContain('text-surface-600');
    });
  });

  describe('Size Variants', () => {
    it('renders small size by default', () => {
      const { container } = render(<ConnectionStatus status="connected" />);
      const dot = container.querySelector('.w-2.h-2');
      expect(dot).toBeInTheDocument();
    });

    it('renders small size', () => {
      const { container } = render(<ConnectionStatus status="connected" size="sm" />);
      const dot = container.querySelector('.w-2.h-2');
      expect(dot).toBeInTheDocument();
    });

    it('renders medium size', () => {
      const { container } = render(<ConnectionStatus status="connected" size="md" />);
      const dot = container.querySelector('.w-2\\.5.h-2\\.5');
      expect(dot).toBeInTheDocument();
    });

    it('renders large size', () => {
      const { container } = render(<ConnectionStatus status="connected" size="lg" />);
      const dot = container.querySelector('.w-3.h-3');
      expect(dot).toBeInTheDocument();
    });

    it('small size has xs text', () => {
      render(<ConnectionStatus status="connected" size="sm" showLabel />);
      const label = screen.getByText('Connected');
      expect(label.className).toContain('text-xs');
    });

    it('medium size has sm text', () => {
      render(<ConnectionStatus status="connected" size="md" showLabel />);
      const label = screen.getByText('Connected');
      expect(label.className).toContain('text-sm');
    });

    it('large size has base text', () => {
      render(<ConnectionStatus status="connected" size="lg" showLabel />);
      const label = screen.getByText('Connected');
      expect(label.className).toContain('text-base');
    });
  });

  describe('Layout and Styling', () => {
    it('uses flex layout', () => {
      const { container } = render(<ConnectionStatus status="connected" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'items-center');
    });

    it('applies custom className', () => {
      const { container } = render(<ConnectionStatus status="connected" className="custom-class" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('dot is rounded full', () => {
      const { container } = render(<ConnectionStatus status="connected" />);
      const dot = container.querySelector('.rounded-full');
      expect(dot).toBeInTheDocument();
    });

    it('has correct gap for small size', () => {
      const { container } = render(<ConnectionStatus status="connected" size="sm" showLabel />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('gap-1.5');
    });

    it('has correct gap for medium size', () => {
      const { container } = render(<ConnectionStatus status="connected" size="md" showLabel />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('gap-2');
    });
  });
});

describe('ConnectionStatusBadge Component', () => {
  describe('Basic Rendering', () => {
    it('renders connected badge', () => {
      render(<ConnectionStatusBadge status="connected" />);
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('renders connecting badge', () => {
      render(<ConnectionStatusBadge status="connecting" />);
      expect(screen.getByText('Connecting')).toBeInTheDocument();
    });

    it('renders disconnected badge', () => {
      render(<ConnectionStatusBadge status="disconnected" />);
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('renders error badge', () => {
      render(<ConnectionStatusBadge status="error" />);
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('has role="status" attribute', () => {
      render(<ConnectionStatusBadge status="connected" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('ARIA Labels', () => {
    it('has correct aria-label for connected', () => {
      render(<ConnectionStatusBadge status="connected" />);
      expect(screen.getByLabelText('Connection status: Connected')).toBeInTheDocument();
    });

    it('has correct aria-label for connecting', () => {
      render(<ConnectionStatusBadge status="connecting" />);
      expect(screen.getByLabelText('Connection status: Connecting')).toBeInTheDocument();
    });

    it('has correct aria-label for disconnected', () => {
      render(<ConnectionStatusBadge status="disconnected" />);
      expect(screen.getByLabelText('Connection status: Offline')).toBeInTheDocument();
    });

    it('has correct aria-label for error', () => {
      render(<ConnectionStatusBadge status="error" />);
      expect(screen.getByLabelText('Connection status: Error')).toBeInTheDocument();
    });
  });

  describe('Badge Colors', () => {
    it('connected badge has success colors', () => {
      const { container } = render(<ConnectionStatusBadge status="connected" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('bg-success-50', 'text-success-700');
    });

    it('connecting badge has warning colors', () => {
      const { container } = render(<ConnectionStatusBadge status="connecting" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('bg-warning-50', 'text-warning-700');
    });

    it('disconnected badge has surface colors', () => {
      const { container } = render(<ConnectionStatusBadge status="disconnected" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('bg-surface-100', 'text-surface-600');
    });

    it('error badge has error colors', () => {
      const { container } = render(<ConnectionStatusBadge status="error" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('bg-error-50', 'text-error-700');
    });
  });

  describe('Dot Display', () => {
    it('renders status dot', () => {
      const { container } = render(<ConnectionStatusBadge status="connected" />);
      const dot = container.querySelector('.w-1\\.5.h-1\\.5.rounded-full');
      expect(dot).toBeInTheDocument();
    });

    it('connected dot has success color', () => {
      const { container } = render(<ConnectionStatusBadge status="connected" />);
      const dot = container.querySelector('.bg-success-500');
      expect(dot).toBeInTheDocument();
    });

    it('connecting dot has warning color', () => {
      const { container } = render(<ConnectionStatusBadge status="connecting" />);
      const dot = container.querySelector('.bg-warning-500');
      expect(dot).toBeInTheDocument();
    });

    it('disconnected dot has surface color', () => {
      const { container } = render(<ConnectionStatusBadge status="disconnected" />);
      const dot = container.querySelector('.bg-surface-400');
      expect(dot).toBeInTheDocument();
    });

    it('error dot has error color', () => {
      const { container } = render(<ConnectionStatusBadge status="error" />);
      const dot = container.querySelector('.bg-error-500');
      expect(dot).toBeInTheDocument();
    });
  });

  describe('Layout and Styling', () => {
    it('is inline-flex', () => {
      const { container } = render(<ConnectionStatusBadge status="connected" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('inline-flex', 'items-center');
    });

    it('has rounded-full shape', () => {
      const { container } = render(<ConnectionStatusBadge status="connected" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('rounded-full');
    });

    it('has correct padding', () => {
      const { container } = render(<ConnectionStatusBadge status="connected" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('px-2', 'py-1');
    });

    it('has correct gap', () => {
      const { container } = render(<ConnectionStatusBadge status="connected" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('gap-1.5');
    });

    it('has correct text size', () => {
      const { container } = render(<ConnectionStatusBadge status="connected" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('text-xs', 'font-medium');
    });

    it('applies custom className', () => {
      const { container } = render(<ConnectionStatusBadge status="connected" className="custom-badge" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('custom-badge');
    });
  });
});

describe('Status Transitions', () => {
  it('transitions from connecting to connected', () => {
    const { rerender } = render(<ConnectionStatus status="connecting" showLabel />);
    expect(screen.getByText('Connecting')).toBeInTheDocument();

    rerender(<ConnectionStatus status="connected" showLabel />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.queryByText('Connecting')).not.toBeInTheDocument();
  });

  it('transitions from connected to disconnected', () => {
    const { rerender } = render(<ConnectionStatus status="connected" showLabel />);
    expect(screen.getByText('Connected')).toBeInTheDocument();

    rerender(<ConnectionStatus status="disconnected" showLabel />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });

  it('transitions from disconnected to error', () => {
    const { rerender } = render(<ConnectionStatus status="disconnected" showLabel />);
    expect(screen.getByText('Offline')).toBeInTheDocument();

    rerender(<ConnectionStatus status="error" showLabel />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });

  it('badge transitions update colors', () => {
    const { rerender, container } = render(<ConnectionStatusBadge status="connected" />);
    let badge = screen.getByRole('status');
    expect(badge).toHaveClass('bg-success-50');

    rerender(<ConnectionStatusBadge status="error" />);
    badge = screen.getByRole('status');
    expect(badge).toHaveClass('bg-error-50');
    expect(badge).not.toHaveClass('bg-success-50');
  });
});

describe('Complete Status Display', () => {
  it('renders full connection status with label and large size', () => {
    render(<ConnectionStatus status="connected" showLabel size="lg" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Connection status: Connected')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('renders complete badge', () => {
    const { container } = render(<ConnectionStatusBadge status="connecting" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(container.querySelector('.bg-warning-500')).toBeInTheDocument();
  });
});
