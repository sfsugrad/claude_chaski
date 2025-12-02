import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhotoCapture } from '../PhotoCapture';

// Mock Button component
jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, size }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

describe('PhotoCapture Component', () => {
  const mockOnCapture = jest.fn();
  const mockOnClear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock FileReader
    global.FileReader = jest.fn().mockImplementation(function () {
      return {
        readAsDataURL: jest.fn(function (this: any) {
          this.onloadend?.();
        }),
        result: 'data:image/png;base64,mockImageData',
      };
    }) as any;
  });

  describe('Rendering', () => {
    it('renders upload button by default', () => {
      render(<PhotoCapture onCapture={mockOnCapture} />);
      expect(screen.getByText('Take Photo or Upload')).toBeInTheDocument();
    });

    it('displays max file size hint', () => {
      render(<PhotoCapture onCapture={mockOnCapture} maxSizeMB={5} />);
      expect(screen.getByText('Max 5MB')).toBeInTheDocument();
    });

    it('uses default max size of 10MB', () => {
      render(<PhotoCapture onCapture={mockOnCapture} />);
      expect(screen.getByText('Max 10MB')).toBeInTheDocument();
    });

    it('renders camera icon', () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-12', 'h-12');
    });
  });

  describe('File Input', () => {
    it('renders hidden file input', () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveClass('hidden');
    });

    it('file input accepts images only', () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput.accept).toBe('image/*');
    });

    it('file input has capture attribute for mobile camera', () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput.getAttribute('capture')).toBe('environment');
    });

    it('opens file picker when upload button is clicked', () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click');

      const uploadButton = screen.getByText('Take Photo or Upload').closest('button');
      fireEvent.click(uploadButton!);

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('File Validation', () => {
    it('accepts valid image file', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnCapture).toHaveBeenCalledWith(
          file,
          'data:image/png;base64,mockImageData'
        );
      });
    });

    it('rejects non-image file', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['text'], 'document.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Please select an image file')).toBeInTheDocument();
        expect(mockOnCapture).not.toHaveBeenCalled();
      });
    });

    it('rejects file exceeding max size', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} maxSizeMB={1} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['large image'], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 }); // 2MB

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Image must be smaller than 1MB')).toBeInTheDocument();
        expect(mockOnCapture).not.toHaveBeenCalled();
      });
    });

    it('does nothing when no file is selected', () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [] } });

      expect(mockOnCapture).not.toHaveBeenCalled();
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it('clears previous error when valid file is selected', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // First, trigger an error
      const invalidFile = new File(['text'], 'document.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText('Please select an image file')).toBeInTheDocument();
      });

      // Then, select a valid file
      const validFile = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(validFile, 'size', { value: 1024 * 1024 });
      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(screen.queryByText('Please select an image file')).not.toBeInTheDocument();
      });
    });
  });

  describe('Preview Display', () => {
    it('shows preview after capturing photo', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        const preview = screen.getByAlt('Captured proof');
        expect(preview).toBeInTheDocument();
        expect(preview).toHaveAttribute('src', 'data:image/png;base64,mockImageData');
      });
    });

    it('hides upload button when preview is shown', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.queryByText('Take Photo or Upload')).not.toBeInTheDocument();
      });
    });

    it('shows Retake button in preview mode', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Retake')).toBeInTheDocument();
      });
    });

    it('shows Clear button in preview mode', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument();
      });
    });

    it('Retake button has correct variant and size', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        const retakeButton = screen.getByText('Retake');
        expect(retakeButton).toHaveAttribute('data-variant', 'secondary');
        expect(retakeButton).toHaveAttribute('data-size', 'sm');
      });
    });

    it('Clear button has correct variant and size', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        const clearButton = screen.getByText('Clear');
        expect(clearButton).toHaveAttribute('data-variant', 'outline');
        expect(clearButton).toHaveAttribute('data-size', 'sm');
      });
    });
  });

  describe('Retake Functionality', () => {
    it('opens file picker when Retake button is clicked', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // First capture
      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Retake')).toBeInTheDocument();
      });

      const clickSpy = jest.spyOn(fileInput, 'click');
      const retakeButton = screen.getByText('Retake');
      fireEvent.click(retakeButton);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('allows capturing new photo when retaking', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // First capture
      const file1 = new File(['image1'], 'photo1.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file1, 'size', { value: 1024 * 1024 });
      fireEvent.change(fileInput, { target: { files: [file1] } });

      await waitFor(() => {
        expect(mockOnCapture).toHaveBeenCalledTimes(1);
      });

      // Retake
      const retakeButton = screen.getByText('Retake');
      fireEvent.click(retakeButton);

      const file2 = new File(['image2'], 'photo2.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file2, 'size', { value: 1024 * 1024 });
      fireEvent.change(fileInput, { target: { files: [file2] } });

      await waitFor(() => {
        expect(mockOnCapture).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Clear Functionality', () => {
    it('clears preview when Clear button is clicked', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} onClear={mockOnClear} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Capture photo
      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByAlt('Captured proof')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);

      expect(screen.queryByAlt('Captured proof')).not.toBeInTheDocument();
      expect(screen.getByText('Take Photo or Upload')).toBeInTheDocument();
    });

    it('calls onClear callback when clearing', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} onClear={mockOnClear} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Capture photo
      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);

      expect(mockOnClear).toHaveBeenCalledTimes(1);
    });

    it('does not call onClear if callback is not provided', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Capture photo
      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('Clear');
      // Should not throw error
      expect(() => fireEvent.click(clearButton)).not.toThrow();
    });

    it('resets file input value when clearing', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Capture photo
      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);

      expect(fileInput.value).toBe('');
    });

    it('clears error when clearing', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Trigger error
      const invalidFile = new File(['text'], 'document.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText('Please select an image file')).toBeInTheDocument();
      });

      // Capture valid photo
      const validFile = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(validFile, 'size', { value: 1024 * 1024 });
      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);

      expect(screen.queryByText('Please select an image file')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('disables file input when disabled prop is true', () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} disabled={true} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeDisabled();
    });

    it('disables upload button when disabled', () => {
      render(<PhotoCapture onCapture={mockOnCapture} disabled={true} />);
      const uploadButton = screen.getByText('Take Photo or Upload').closest('button');
      expect(uploadButton).toBeDisabled();
    });

    it('applies disabled styling to upload button', () => {
      render(<PhotoCapture onCapture={mockOnCapture} disabled={true} />);
      const uploadButton = screen.getByText('Take Photo or Upload').closest('button');
      expect(uploadButton?.className).toContain('cursor-not-allowed');
      expect(uploadButton?.className).toContain('bg-surface-100');
    });

    it('disables Retake button when disabled in preview mode', async () => {
      const { container, rerender } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Capture photo
      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Retake')).toBeInTheDocument();
      });

      // Set disabled
      rerender(<PhotoCapture onCapture={mockOnCapture} disabled={true} />);

      const retakeButton = screen.getByText('Retake');
      expect(retakeButton).toBeDisabled();
    });

    it('disables Clear button when disabled in preview mode', async () => {
      const { container, rerender } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Capture photo
      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument();
      });

      // Set disabled
      rerender(<PhotoCapture onCapture={mockOnCapture} disabled={true} />);

      const clearButton = screen.getByText('Clear');
      expect(clearButton).toBeDisabled();
    });
  });

  describe('Error Display', () => {
    it('displays error message below upload area', async () => {
      const { container } = render(<PhotoCapture onCapture={mockOnCapture} />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      const invalidFile = new File(['text'], 'document.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        const errorText = screen.getByText('Please select an image file');
        expect(errorText).toBeInTheDocument();
        expect(errorText.className).toContain('text-error-600');
      });
    });

    it('does not show error initially', () => {
      render(<PhotoCapture onCapture={mockOnCapture} />);
      const errorElement = document.querySelector('.text-error-600');
      expect(errorElement).not.toBeInTheDocument();
    });
  });
});
