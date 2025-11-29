import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../Modal';

describe('Modal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset body overflow
    document.body.style.overflow = 'unset';
  });

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(
        <Modal {...defaultProps}>
          <div>Modal content</div>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(
        <Modal {...defaultProps} isOpen={false}>
          <div>Modal content</div>
        </Modal>
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders children content', () => {
      render(
        <Modal {...defaultProps}>
          <div>Test content</div>
        </Modal>
      );
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('renders backdrop', () => {
      const { container } = render(
        <Modal {...defaultProps}>
          <div>Content</div>
        </Modal>
      );
      const backdrop = container.querySelector('.backdrop-blur-sm');
      expect(backdrop).toBeInTheDocument();
    });
  });

  describe('Close Button', () => {
    it('shows close button by default', () => {
      render(
        <Modal {...defaultProps}>
          <div>Content</div>
        </Modal>
      );
      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeInTheDocument();
    });

    it('hides close button when showCloseButton is false', () => {
      render(
        <Modal {...defaultProps} showCloseButton={false}>
          <div>Content</div>
        </Modal>
      );
      const closeButton = screen.queryByLabelText('Close modal');
      expect(closeButton).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = jest.fn();
      render(
        <Modal {...defaultProps} onClose={onClose}>
          <div>Content</div>
        </Modal>
      );
      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Overlay Click', () => {
    it('calls onClose when overlay is clicked by default', () => {
      const onClose = jest.fn();
      const { container } = render(
        <Modal {...defaultProps} onClose={onClose}>
          <div>Content</div>
        </Modal>
      );
      const backdrop = container.querySelector('.backdrop-blur-sm');
      fireEvent.click(backdrop!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when overlay is clicked and closeOnOverlayClick is false', () => {
      const onClose = jest.fn();
      const { container } = render(
        <Modal {...defaultProps} onClose={onClose} closeOnOverlayClick={false}>
          <div>Content</div>
        </Modal>
      );
      const backdrop = container.querySelector('.backdrop-blur-sm');
      fireEvent.click(backdrop!);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not close when modal content is clicked', () => {
      const onClose = jest.fn();
      render(
        <Modal {...defaultProps} onClose={onClose}>
          <div>Content</div>
        </Modal>
      );
      const content = screen.getByText('Content');
      fireEvent.click(content);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Escape Key', () => {
    it('calls onClose when Escape key is pressed by default', () => {
      const onClose = jest.fn();
      render(
        <Modal {...defaultProps} onClose={onClose}>
          <div>Content</div>
        </Modal>
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when Escape is pressed and closeOnEscape is false', () => {
      const onClose = jest.fn();
      render(
        <Modal {...defaultProps} onClose={onClose} closeOnEscape={false}>
          <div>Content</div>
        </Modal>
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when other keys are pressed', () => {
      const onClose = jest.fn();
      render(
        <Modal {...defaultProps} onClose={onClose}>
          <div>Content</div>
        </Modal>
      );
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      const { container } = render(
        <Modal {...defaultProps} size="sm">
          <div>Content</div>
        </Modal>
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveClass('max-w-sm');
    });

    it('renders medium size (default)', () => {
      const { container } = render(
        <Modal {...defaultProps} size="md">
          <div>Content</div>
        </Modal>
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveClass('max-w-md');
    });

    it('renders large size', () => {
      const { container } = render(
        <Modal {...defaultProps} size="lg">
          <div>Content</div>
        </Modal>
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveClass('max-w-lg');
    });

    it('renders extra large size', () => {
      const { container } = render(
        <Modal {...defaultProps} size="xl">
          <div>Content</div>
        </Modal>
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveClass('max-w-xl');
    });

    it('renders full size', () => {
      const { container } = render(
        <Modal {...defaultProps} size="full">
          <div>Content</div>
        </Modal>
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveClass('max-w-4xl');
    });
  });

  describe('Body Scroll Lock', () => {
    it('locks body scroll when modal opens', () => {
      render(
        <Modal {...defaultProps}>
          <div>Content</div>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('unlocks body scroll when modal closes', () => {
      const { rerender } = render(
        <Modal {...defaultProps}>
          <div>Content</div>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <Modal {...defaultProps} isOpen={false}>
          <div>Content</div>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('unset');
    });

    it('unlocks body scroll on unmount', () => {
      const { unmount } = render(
        <Modal {...defaultProps}>
          <div>Content</div>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');

      unmount();
      expect(document.body.style.overflow).toBe('unset');
    });
  });

  describe('Custom Classes', () => {
    it('applies custom className to modal', () => {
      const { container } = render(
        <Modal {...defaultProps} className="custom-modal">
          <div>Content</div>
        </Modal>
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveClass('custom-modal');
    });

    it('merges custom className with default classes', () => {
      const { container } = render(
        <Modal {...defaultProps} className="custom-modal">
          <div>Content</div>
        </Modal>
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveClass('custom-modal');
      expect(dialog).toHaveClass('bg-white');
    });
  });

  describe('Accessibility', () => {
    it('has dialog role', () => {
      render(
        <Modal {...defaultProps}>
          <div>Content</div>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      render(
        <Modal {...defaultProps}>
          <div>Content</div>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('close button has aria-label', () => {
      render(
        <Modal {...defaultProps}>
          <div>Content</div>
        </Modal>
      );
      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });
  });
});

describe('Modal.Header Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  it('renders title', () => {
    render(
      <Modal {...defaultProps}>
        <Modal.Header title="Test Title" />
      </Modal>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(
      <Modal {...defaultProps}>
        <Modal.Header description="Test description" />
      </Modal>
    );
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('renders both title and description', () => {
    render(
      <Modal {...defaultProps}>
        <Modal.Header title="Title" description="Description" />
      </Modal>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders custom children instead of title/description', () => {
    render(
      <Modal {...defaultProps}>
        <Modal.Header>
          <div>Custom header content</div>
        </Modal.Header>
      </Modal>
    );
    expect(screen.getByText('Custom header content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <Modal.Header title="Title" className="custom-header" />
      </Modal>
    );
    const header = container.querySelector('.custom-header');
    expect(header).toBeInTheDocument();
  });
});

describe('Modal.Body Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  it('renders children content', () => {
    render(
      <Modal {...defaultProps}>
        <Modal.Body>
          <div>Body content</div>
        </Modal.Body>
      </Modal>
    );
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <Modal.Body className="custom-body">
          <div>Content</div>
        </Modal.Body>
      </Modal>
    );
    const body = container.querySelector('.custom-body');
    expect(body).toBeInTheDocument();
  });

  it('has padding classes', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <Modal.Body>
          <div>Content</div>
        </Modal.Body>
      </Modal>
    );
    const body = container.querySelector('.px-6.py-4');
    expect(body).toBeInTheDocument();
  });
});

describe('Modal.Footer Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  it('renders children content', () => {
    render(
      <Modal {...defaultProps}>
        <Modal.Footer>
          <button>Cancel</button>
          <button>Confirm</button>
        </Modal.Footer>
      </Modal>
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <Modal.Footer className="custom-footer">
          <div>Content</div>
        </Modal.Footer>
      </Modal>
    );
    const footer = container.querySelector('.custom-footer');
    expect(footer).toBeInTheDocument();
  });

  it('has background and border classes', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <Modal.Footer>
          <div>Content</div>
        </Modal.Footer>
      </Modal>
    );
    const footer = container.querySelector('.bg-surface-50.border-t');
    expect(footer).toBeInTheDocument();
  });

  it('has flex layout classes', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <Modal.Footer>
          <div>Content</div>
        </Modal.Footer>
      </Modal>
    );
    const footer = container.querySelector('.flex.justify-end');
    expect(footer).toBeInTheDocument();
  });
});

describe('Modal Complete Example', () => {
  it('renders complete modal with all compound components', () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <Modal.Header title="Confirm Action" description="Are you sure you want to proceed?" />
        <Modal.Body>
          <p>This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={onClose}>Cancel</button>
          <button>Confirm</button>
        </Modal.Footer>
      </Modal>
    );

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });
});
