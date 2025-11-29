import { render, screen, fireEvent } from '@testing-library/react';
import { SignaturePad } from '../SignaturePad';

// Mock Button component
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

describe('SignaturePad Component', () => {
  const mockOnComplete = jest.fn();
  const mockOnClear = jest.fn();

  let mockCanvas: any;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock canvas context
    mockContext = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineCap: '',
      lineJoin: '',
      fillRect: jest.fn(),
      scale: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
    };

    mockCanvas = {
      getContext: jest.fn(() => mockContext),
      toDataURL: jest.fn(() => 'data:image/png;base64,mockSignatureData'),
      getBoundingClientRect: jest.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 200,
      })),
      width: 0,
      height: 0,
      style: {
        width: '',
        height: '',
      },
    };

    // Mock HTMLCanvasElement
    HTMLCanvasElement.prototype.getContext = jest.fn(() => mockContext);
    HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mockSignatureData');
    HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 400,
      height: 200,
      right: 400,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    // Mock window.devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: 1,
    });
  });

  describe('Rendering', () => {
    it('renders canvas element', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('renders Clear button', () => {
      render(<SignaturePad onComplete={mockOnComplete} />);
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });

    it('renders Confirm Signature button', () => {
      render(<SignaturePad onComplete={mockOnComplete} />);
      expect(screen.getByRole('button', { name: 'Confirm Signature' })).toBeInTheDocument();
    });

    it('renders confirmation text', () => {
      render(<SignaturePad onComplete={mockOnComplete} />);
      expect(
        screen.getByText('By signing, you confirm the package was delivered')
      ).toBeInTheDocument();
    });

    it('shows placeholder text when no signature', () => {
      render(<SignaturePad onComplete={mockOnComplete} />);
      expect(screen.getByText('Sign here')).toBeInTheDocument();
    });

    it('Clear button has correct variant and size', () => {
      render(<SignaturePad onComplete={mockOnComplete} />);
      const clearButton = screen.getByRole('button', { name: 'Clear' });
      expect(clearButton).toHaveAttribute('data-variant', 'outline');
      expect(clearButton).toHaveAttribute('data-size', 'sm');
    });

    it('Confirm button has correct variant and size', () => {
      render(<SignaturePad onComplete={mockOnComplete} />);
      const confirmButton = screen.getByRole('button', { name: 'Confirm Signature' });
      expect(confirmButton).toHaveAttribute('data-variant', 'primary');
      expect(confirmButton).toHaveAttribute('data-size', 'sm');
    });
  });

  describe('Canvas Initialization', () => {
    it('initializes canvas with default dimensions', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;

      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(200);
    });

    it('initializes canvas with custom dimensions', () => {
      const { container } = render(
        <SignaturePad onComplete={mockOnComplete} width={600} height={300} />
      );
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;

      expect(canvas.width).toBe(600);
      expect(canvas.height).toBe(300);
    });

    it('accounts for device pixel ratio', () => {
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        configurable: true,
        value: 2,
      });

      const { container } = render(<SignaturePad onComplete={mockOnComplete} width={400} height={200} />);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;

      expect(canvas.width).toBe(800); // 400 * 2
      expect(canvas.height).toBe(400); // 200 * 2
      expect(mockContext.scale).toHaveBeenCalledWith(2, 2);
    });

    it('sets background color', () => {
      render(<SignaturePad onComplete={mockOnComplete} backgroundColor="#f0f0f0" />);
      expect(mockContext.fillStyle).toBe('#f0f0f0');
      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 400, 200);
    });

    it('uses default background color', () => {
      render(<SignaturePad onComplete={mockOnComplete} />);
      expect(mockContext.fillStyle).toBe('#ffffff');
    });

    it('sets pen color', () => {
      render(<SignaturePad onComplete={mockOnComplete} penColor="#0000ff" />);
      expect(mockContext.strokeStyle).toBe('#0000ff');
    });

    it('uses default pen color', () => {
      render(<SignaturePad onComplete={mockOnComplete} />);
      expect(mockContext.strokeStyle).toBe('#000000');
    });

    it('sets drawing styles', () => {
      render(<SignaturePad onComplete={mockOnComplete} />);
      expect(mockContext.lineWidth).toBe(2);
      expect(mockContext.lineCap).toBe('round');
      expect(mockContext.lineJoin).toBe('round');
    });
  });

  describe('Mouse Drawing', () => {
    it('starts drawing on mouse down', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });

      // Should initialize drawing state
      expect(mockContext.beginPath).not.toHaveBeenCalled(); // Only called on move
    });

    it('draws line on mouse move while drawing', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      // Start drawing
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });

      // Move mouse
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalledWith(10, 20);
      expect(mockContext.lineTo).toHaveBeenCalledWith(30, 40);
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    it('does not draw when mouse moves without mouse down', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      expect(mockContext.beginPath).not.toHaveBeenCalled();
    });

    it('stops drawing on mouse up', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });
      fireEvent.mouseUp(canvas);

      // Clear mock calls
      jest.clearAllMocks();

      // Move after mouse up should not draw
      fireEvent.mouseMove(canvas, { clientX: 50, clientY: 60 });
      expect(mockContext.beginPath).not.toHaveBeenCalled();
    });

    it('stops drawing when mouse leaves canvas', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });
      fireEvent.mouseLeave(canvas);

      // Clear mock calls
      jest.clearAllMocks();

      // Move after leaving should not draw
      fireEvent.mouseMove(canvas, { clientX: 50, clientY: 60 });
      expect(mockContext.beginPath).not.toHaveBeenCalled();
    });

    it('hides placeholder text after drawing', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      expect(screen.getByText('Sign here')).toBeInTheDocument();

      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      expect(screen.queryByText('Sign here')).not.toBeInTheDocument();
    });
  });

  describe('Touch Drawing', () => {
    it('starts drawing on touch start', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 10, clientY: 20 }],
      });

      // Should initialize drawing state
      expect(canvas).toBeInTheDocument();
    });

    it('draws line on touch move', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 10, clientY: 20 }],
      });

      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 30, clientY: 40 }],
      });

      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    it('stops drawing on touch end', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 10, clientY: 20 }],
      });
      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 30, clientY: 40 }],
      });
      fireEvent.touchEnd(canvas);

      // Clear mock calls
      jest.clearAllMocks();

      // Move after touch end should not draw
      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 50, clientY: 60 }],
      });
      expect(mockContext.beginPath).not.toHaveBeenCalled();
    });

    it('stops drawing on touch cancel', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 10, clientY: 20 }],
      });
      fireEvent.touchCancel(canvas);

      // Clear mock calls
      jest.clearAllMocks();

      // Move after cancel should not draw
      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 50, clientY: 60 }],
      });
      expect(mockContext.beginPath).not.toHaveBeenCalled();
    });

    it('prevents default on touch events', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [new Touch({ identifier: 0, target: canvas, clientX: 10, clientY: 20 })],
        cancelable: true,
      });

      const preventDefaultSpy = jest.spyOn(touchStartEvent, 'preventDefault');
      canvas.dispatchEvent(touchStartEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Clear Functionality', () => {
    it('Clear button is disabled initially', () => {
      render(<SignaturePad onComplete={mockOnComplete} />);
      const clearButton = screen.getByRole('button', { name: 'Clear' });
      expect(clearButton).toBeDisabled();
    });

    it('Clear button is enabled after drawing', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      const clearButton = screen.getByRole('button', { name: 'Clear' });
      expect(clearButton).not.toBeDisabled();
    });

    it('clears canvas when Clear button is clicked', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} backgroundColor="#ffffff" />);
      const canvas = container.querySelector('canvas')!;

      // Draw something
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      // Clear mock calls
      jest.clearAllMocks();

      const clearButton = screen.getByRole('button', { name: 'Clear' });
      fireEvent.click(clearButton);

      expect(mockContext.fillStyle).toBe('#ffffff');
      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 400, 200);
    });

    it('shows placeholder text after clearing', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      // Draw something
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      expect(screen.queryByText('Sign here')).not.toBeInTheDocument();

      const clearButton = screen.getByRole('button', { name: 'Clear' });
      fireEvent.click(clearButton);

      expect(screen.getByText('Sign here')).toBeInTheDocument();
    });

    it('disables Clear button after clearing', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      // Draw something
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      const clearButton = screen.getByRole('button', { name: 'Clear' });
      fireEvent.click(clearButton);

      expect(clearButton).toBeDisabled();
    });

    it('calls onClear callback when clearing', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} onClear={mockOnClear} />);
      const canvas = container.querySelector('canvas')!;

      // Draw something
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      const clearButton = screen.getByRole('button', { name: 'Clear' });
      fireEvent.click(clearButton);

      expect(mockOnClear).toHaveBeenCalledTimes(1);
    });

    it('does not call onClear if callback is not provided', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      // Draw something
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      const clearButton = screen.getByRole('button', { name: 'Clear' });
      // Should not throw error
      expect(() => fireEvent.click(clearButton)).not.toThrow();
    });
  });

  describe('Confirm Signature Functionality', () => {
    it('Confirm button is disabled initially', () => {
      render(<SignaturePad onComplete={mockOnComplete} />);
      const confirmButton = screen.getByRole('button', { name: 'Confirm Signature' });
      expect(confirmButton).toBeDisabled();
    });

    it('Confirm button is enabled after drawing', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      const confirmButton = screen.getByRole('button', { name: 'Confirm Signature' });
      expect(confirmButton).not.toBeDisabled();
    });

    it('calls onComplete with signature data URL when confirmed', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      // Draw something
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      const confirmButton = screen.getByRole('button', { name: 'Confirm Signature' });
      fireEvent.click(confirmButton);

      expect(mockOnComplete).toHaveBeenCalledWith('data:image/png;base64,mockSignatureData');
    });

    it('does not call onComplete when no signature', () => {
      render(<SignaturePad onComplete={mockOnComplete} />);

      // Confirm button should be disabled, but test clicking anyway
      const confirmButton = screen.getByRole('button', { name: 'Confirm Signature' });
      fireEvent.click(confirmButton);

      expect(mockOnComplete).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('applies disabled styling to canvas border', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} disabled={true} />);
      const canvasContainer = container.querySelector('.border-2');
      expect(canvasContainer?.className).toContain('border-surface-300');
      expect(canvasContainer?.className).toContain('opacity-50');
    });

    it('applies disabled cursor to canvas', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} disabled={true} />);
      const canvas = container.querySelector('canvas');
      expect(canvas?.className).toContain('cursor-not-allowed');
    });

    it('does not start drawing when disabled', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} disabled={true} />);
      const canvas = container.querySelector('canvas')!;

      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      expect(mockContext.beginPath).not.toHaveBeenCalled();
    });

    it('disables Clear button when disabled', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas')!;

      // Draw something first
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 });

      // Now disable the component
      const { container: disabledContainer } = render(
        <SignaturePad onComplete={mockOnComplete} disabled={true} />
      );

      const clearButton = disabledContainer.querySelector('button[data-variant="outline"]');
      expect(clearButton).toBeDisabled();
    });

    it('disables Confirm button when disabled', () => {
      render(<SignaturePad onComplete={mockOnComplete} disabled={true} />);
      const confirmButton = screen.getByRole('button', { name: 'Confirm Signature' });
      expect(confirmButton).toBeDisabled();
    });

    it('shows placeholder text when disabled', () => {
      render(<SignaturePad onComplete={mockOnComplete} disabled={true} />);
      expect(screen.queryByText('Sign here')).toBeInTheDocument();
    });
  });

  describe('Canvas Styling', () => {
    it('applies touch-none class to prevent scrolling', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas');
      expect(canvas?.className).toContain('touch-none');
    });

    it('applies crosshair cursor by default', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas');
      expect(canvas?.className).toContain('cursor-crosshair');
    });

    it('canvas is displayed as block', () => {
      const { container } = render(<SignaturePad onComplete={mockOnComplete} />);
      const canvas = container.querySelector('canvas');
      expect(canvas?.className).toContain('block');
    });
  });
});
