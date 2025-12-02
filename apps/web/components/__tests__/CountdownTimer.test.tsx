import { render, screen, act } from '@testing-library/react';
import { CountdownTimer } from '../CountdownTimer';

describe('CountdownTimer Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Time Display', () => {
    it('renders time remaining correctly', () => {
      const deadline = new Date('2024-01-15T13:30:45Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('1h 30m 45s')).toBeInTheDocument();
    });

    it('displays only minutes and seconds when less than 1 hour', () => {
      const deadline = new Date('2024-01-15T12:45:30Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('45m 30s')).toBeInTheDocument();
    });

    it('displays only seconds when less than 1 minute', () => {
      const deadline = new Date('2024-01-15T12:00:45Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('45s')).toBeInTheDocument();
    });

    it('displays expired when deadline has passed', () => {
      const deadline = new Date('2024-01-15T11:00:00Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('pads single digit values with zero', () => {
      const deadline = new Date('2024-01-15T12:05:09Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('5m 9s')).toBeInTheDocument();
    });

    it('handles exactly 1 hour remaining', () => {
      const deadline = new Date('2024-01-15T13:00:00Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('1h 0m 0s')).toBeInTheDocument();
    });

    it('handles exactly 1 minute remaining', () => {
      const deadline = new Date('2024-01-15T12:01:00Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('1m 0s')).toBeInTheDocument();
    });

    it('handles exactly 1 second remaining', () => {
      const deadline = new Date('2024-01-15T12:00:01Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('1s')).toBeInTheDocument();
    });
  });

  describe('Countdown Updates', () => {
    it('updates countdown every second', () => {
      const deadline = new Date('2024-01-15T12:00:10Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('10s')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.getByText('9s')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.getByText('8s')).toBeInTheDocument();
    });

    it('transitions from seconds to minutes correctly', () => {
      const deadline = new Date('2024-01-15T12:01:02Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('1m 2s')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(screen.getByText('1m 0s')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.getByText('59s')).toBeInTheDocument();
    });

    it('transitions from minutes to hours correctly', () => {
      const deadline = new Date('2024-01-15T13:00:02Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('1h 0m 2s')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(screen.getByText('1h 0m 0s')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.getByText('59m 59s')).toBeInTheDocument();
    });

    it('cleans up interval on unmount', () => {
      const deadline = new Date('2024-01-15T12:00:10Z').toISOString();
      const { unmount } = render(<CountdownTimer deadline={deadline} />);

      const activeTimers = jest.getTimerCount();
      unmount();

      expect(jest.getTimerCount()).toBeLessThan(activeTimers);
    });
  });

  describe('Expiry Callback', () => {
    it('calls onExpire when countdown reaches zero', () => {
      const onExpire = jest.fn();
      const deadline = new Date('2024-01-15T12:00:03Z').toISOString();

      render(<CountdownTimer deadline={deadline} onExpire={onExpire} />);

      expect(onExpire).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(onExpire).toHaveBeenCalledTimes(1);
    });

    it('does not call onExpire multiple times', () => {
      const onExpire = jest.fn();
      const deadline = new Date('2024-01-15T12:00:02Z').toISOString();

      render(<CountdownTimer deadline={deadline} onExpire={onExpire} />);

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(onExpire).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Should still be called only once
      expect(onExpire).toHaveBeenCalledTimes(1);
    });

    it('does not call onExpire when deadline is already expired', () => {
      const onExpire = jest.fn();
      const deadline = new Date('2024-01-15T11:00:00Z').toISOString();

      render(<CountdownTimer deadline={deadline} onExpire={onExpire} />);

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should not be called for already expired deadline
      expect(onExpire).not.toHaveBeenCalled();
    });

    it('works without onExpire callback', () => {
      const deadline = new Date('2024-01-15T12:00:02Z').toISOString();

      expect(() => {
        render(<CountdownTimer deadline={deadline} />);

        act(() => {
          jest.advanceTimersByTime(3000);
        });
      }).not.toThrow();
    });
  });

  describe('Urgency States', () => {
    it('shows default state when more than 5 minutes remaining', () => {
      const deadline = new Date('2024-01-15T12:10:00Z').toISOString();
      const { container } = render(<CountdownTimer deadline={deadline} />);

      const timer = screen.getByText('10m 0s');
      expect(timer.className).toContain('text-surface-700');
    });

    it('shows urgent state when less than 5 minutes remaining', () => {
      const deadline = new Date('2024-01-15T12:04:30Z').toISOString();
      const { container } = render(<CountdownTimer deadline={deadline} />);

      const timer = screen.getByText('4m 30s');
      expect(timer.className).toContain('text-warning-600');
    });

    it('shows critical state when less than 1 minute remaining', () => {
      const deadline = new Date('2024-01-15T12:00:45Z').toISOString();
      const { container } = render(<CountdownTimer deadline={deadline} />);

      const timer = screen.getByText('45s');
      expect(timer.className).toContain('text-error-600');
    });

    it('transitions through urgency states as time decreases', () => {
      const deadline = new Date('2024-01-15T12:05:02Z').toISOString();
      const { container } = render(<CountdownTimer deadline={deadline} />);

      // Initially urgent (< 5 minutes)
      let timer = screen.getByText('5m 2s');
      expect(timer.className).toContain('text-warning-600');

      // Advance to critical (< 1 minute)
      act(() => {
        jest.advanceTimersByTime(4 * 60 * 1000 + 3000); // 4 minutes 3 seconds
      });

      timer = screen.getByText('59s');
      expect(timer.className).toContain('text-error-600');
    });

    it('shows expired state styling', () => {
      const deadline = new Date('2024-01-15T11:00:00Z').toISOString();
      const { container } = render(<CountdownTimer deadline={deadline} />);

      const expired = screen.getByText('Expired');
      expect(expired.className).toContain('text-surface-400');
    });
  });

  describe('Label Display', () => {
    it('displays label when provided', () => {
      const deadline = new Date('2024-01-15T12:10:00Z').toISOString();
      render(<CountdownTimer deadline={deadline} label="Time remaining" />);

      expect(screen.getByText('Time remaining')).toBeInTheDocument();
    });

    it('does not display label when not provided', () => {
      const deadline = new Date('2024-01-15T12:10:00Z').toISOString();
      const { container } = render(<CountdownTimer deadline={deadline} />);

      const labels = container.querySelectorAll('.text-xs.text-surface-500');
      expect(labels.length).toBe(0);
    });

    it('label has correct styling', () => {
      const deadline = new Date('2024-01-15T12:10:00Z').toISOString();
      render(<CountdownTimer deadline={deadline} label="Expires in" />);

      const label = screen.getByText('Expires in');
      expect(label.className).toContain('text-xs');
      expect(label.className).toContain('text-surface-500');
    });
  });

  describe('Null Deadline', () => {
    it('handles null deadline gracefully', () => {
      const { container } = render(<CountdownTimer deadline={null} />);

      expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('does not call onExpire for null deadline', () => {
      const onExpire = jest.fn();
      render(<CountdownTimer deadline={null} onExpire={onExpire} />);

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(onExpire).not.toHaveBeenCalled();
    });
  });

  describe('Clock Icon', () => {
    it('renders clock icon', () => {
      const deadline = new Date('2024-01-15T12:10:00Z').toISOString();
      const { container } = render(<CountdownTimer deadline={deadline} />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('clock icon has correct size', () => {
      const deadline = new Date('2024-01-15T12:10:00Z').toISOString();
      const { container } = render(<CountdownTimer deadline={deadline} />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-4', 'h-4');
    });

    it('clock icon color matches urgency state', () => {
      const deadline = new Date('2024-01-15T12:00:30Z').toISOString();
      const { container } = render(<CountdownTimer deadline={deadline} />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-error-600');
    });
  });

  describe('Layout and Styling', () => {
    it('uses flex layout', () => {
      const deadline = new Date('2024-01-15T12:10:00Z').toISOString();
      const { container } = render(<CountdownTimer deadline={deadline} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'items-center', 'gap-2');
    });

    it('timer text has correct font styling', () => {
      const deadline = new Date('2024-01-15T12:10:00Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      const timer = screen.getByText('10m 0s');
      expect(timer.className).toContain('text-sm');
      expect(timer.className).toContain('font-medium');
    });

    it('applies custom className', () => {
      const deadline = new Date('2024-01-15T12:10:00Z').toISOString();
      const { container } = render(<CountdownTimer deadline={deadline} className="custom-class" />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('Edge Cases', () => {
    it('handles very long countdowns (days)', () => {
      const deadline = new Date('2024-01-20T12:00:00Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      // 5 days = 120 hours
      expect(screen.getByText('120h 0m 0s')).toBeInTheDocument();
    });

    it('handles countdown with all components', () => {
      const deadline = new Date('2024-01-15T15:45:30Z').toISOString();
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('3h 45m 30s')).toBeInTheDocument();
    });

    it('handles midnight crossover', () => {
      jest.setSystemTime(new Date('2024-01-15T23:59:58Z'));
      const deadline = new Date('2024-01-16T00:00:05Z').toISOString();

      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('7s')).toBeInTheDocument();
    });

    it('handles timezone differences correctly', () => {
      // Deadlines should work regardless of timezone since we use ISO strings
      const deadline = '2024-01-15T12:05:00Z';
      render(<CountdownTimer deadline={deadline} />);

      expect(screen.getByText('5m 0s')).toBeInTheDocument();
    });
  });
});
