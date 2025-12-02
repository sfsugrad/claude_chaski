import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BidModal from '../BidModal';
import { bidsAPI } from '@/lib/api';

// Mock the bidsAPI
jest.mock('@/lib/api', () => ({
  bidsAPI: {
    create: jest.fn(),
  },
}));

describe('BidModal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    trackingId: 'PKG123',
    packageDescription: 'Electronics - Laptop',
    suggestedPrice: 50.0,
    routeId: 1,
    onBidPlaced: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders modal when isOpen is true', () => {
      render(<BidModal {...defaultProps} />);
      expect(screen.getByText('Place a Bid')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<BidModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Place a Bid')).not.toBeInTheDocument();
    });

    it('renders package description', () => {
      render(<BidModal {...defaultProps} />);
      expect(screen.getByText('Bidding on:')).toBeInTheDocument();
      expect(screen.getByText('Electronics - Laptop')).toBeInTheDocument();
    });

    it('truncates long package description', () => {
      const longDescription = 'Very long package description that should be truncated';
      const { container } = render(
        <BidModal {...defaultProps} packageDescription={longDescription} />
      );
      const descElement = screen.getByText(longDescription);
      expect(descElement.className).toContain('truncate');
    });
  });

  describe('Form Fields', () => {
    it('renders price input field', () => {
      render(<BidModal {...defaultProps} />);
      expect(screen.getByLabelText('Your Price *')).toBeInTheDocument();
    });

    it('pre-fills price with suggested price', () => {
      render(<BidModal {...defaultProps} />);
      const priceInput = screen.getByLabelText('Your Price *') as HTMLInputElement;
      expect(priceInput.value).toBe('50');
    });

    it('displays suggested price hint', () => {
      render(<BidModal {...defaultProps} />);
      expect(screen.getByText("Sender's budget: $50.00")).toBeInTheDocument();
    });

    it('does not show suggested price hint when null', () => {
      render(<BidModal {...defaultProps} suggestedPrice={null} />);
      expect(screen.queryByText(/Sender's budget/)).not.toBeInTheDocument();
    });

    it('renders estimated delivery hours field', () => {
      render(<BidModal {...defaultProps} />);
      expect(
        screen.getByLabelText('Estimated Delivery Time (hours)')
      ).toBeInTheDocument();
    });

    it('renders estimated pickup time field', () => {
      render(<BidModal {...defaultProps} />);
      expect(screen.getByLabelText('Estimated Pickup Time')).toBeInTheDocument();
    });

    it('renders message textarea', () => {
      render(<BidModal {...defaultProps} />);
      expect(screen.getByLabelText('Message to Sender')).toBeInTheDocument();
    });

    it('shows character count for message', () => {
      render(<BidModal {...defaultProps} />);
      expect(screen.getByText('0/500')).toBeInTheDocument();
    });

    it('updates character count as user types', () => {
      render(<BidModal {...defaultProps} />);
      const textarea = screen.getByLabelText('Message to Sender');
      fireEvent.change(textarea, { target: { value: 'Hello sender!' } });
      expect(screen.getByText('13/500')).toBeInTheDocument();
    });

    it('enforces 500 character limit on message', () => {
      render(<BidModal {...defaultProps} />);
      const textarea = screen.getByLabelText(
        'Message to Sender'
      ) as HTMLTextAreaElement;
      expect(textarea.maxLength).toBe(500);
    });
  });

  describe('Form Input', () => {
    it('allows user to change price', () => {
      render(<BidModal {...defaultProps} />);
      const priceInput = screen.getByLabelText('Your Price *') as HTMLInputElement;
      fireEvent.change(priceInput, { target: { value: '75.50' } });
      expect(priceInput.value).toBe('75.50');
    });

    it('allows user to enter delivery hours', () => {
      render(<BidModal {...defaultProps} />);
      const hoursInput = screen.getByLabelText(
        'Estimated Delivery Time (hours)'
      ) as HTMLInputElement;
      fireEvent.change(hoursInput, { target: { value: '24' } });
      expect(hoursInput.value).toBe('24');
    });

    it('allows user to set pickup time', () => {
      render(<BidModal {...defaultProps} />);
      const pickupInput = screen.getByLabelText(
        'Estimated Pickup Time'
      ) as HTMLInputElement;
      fireEvent.change(pickupInput, {
        target: { value: '2024-01-20T10:00' },
      });
      expect(pickupInput.value).toBe('2024-01-20T10:00');
    });

    it('allows user to enter message', () => {
      render(<BidModal {...defaultProps} />);
      const messageInput = screen.getByLabelText(
        'Message to Sender'
      ) as HTMLTextAreaElement;
      fireEvent.change(messageInput, {
        target: { value: 'I can deliver this safely!' },
      });
      expect(messageInput.value).toBe('I can deliver this safely!');
    });
  });

  describe('Form Validation', () => {
    it('shows error when submitting with empty price', async () => {
      render(<BidModal {...defaultProps} suggestedPrice={null} />);
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid price')).toBeInTheDocument();
      });
    });

    it('shows error when submitting with zero price', async () => {
      render(<BidModal {...defaultProps} />);
      const priceInput = screen.getByLabelText('Your Price *');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '0' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid price')).toBeInTheDocument();
      });
    });

    it('shows error when submitting with negative price', async () => {
      render(<BidModal {...defaultProps} />);
      const priceInput = screen.getByLabelText('Your Price *');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '-10' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid price')).toBeInTheDocument();
      });
    });

    it('price field has correct input constraints', () => {
      render(<BidModal {...defaultProps} />);
      const priceInput = screen.getByLabelText('Your Price *') as HTMLInputElement;
      expect(priceInput.type).toBe('number');
      expect(priceInput.step).toBe('0.01');
      expect(priceInput.min).toBe('0.01');
      expect(priceInput.required).toBe(true);
    });

    it('delivery hours field has minimum value of 1', () => {
      render(<BidModal {...defaultProps} />);
      const hoursInput = screen.getByLabelText(
        'Estimated Delivery Time (hours)'
      ) as HTMLInputElement;
      expect(hoursInput.type).toBe('number');
      expect(hoursInput.min).toBe('1');
    });
  });

  describe('Form Submission', () => {
    it('calls bidsAPI.create with correct data', async () => {
      (bidsAPI.create as jest.Mock).mockResolvedValue({ id: 1 });

      render(<BidModal {...defaultProps} />);

      const priceInput = screen.getByLabelText('Your Price *');
      const hoursInput = screen.getByLabelText('Estimated Delivery Time (hours)');
      const pickupInput = screen.getByLabelText('Estimated Pickup Time');
      const messageInput = screen.getByLabelText('Message to Sender');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '75.00' } });
      fireEvent.change(hoursInput, { target: { value: '24' } });
      fireEvent.change(pickupInput, { target: { value: '2024-01-20T10:00' } });
      fireEvent.change(messageInput, { target: { value: 'I can deliver this!' } });

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(bidsAPI.create).toHaveBeenCalledWith({
          tracking_id: 'PKG123',
          proposed_price: 75.0,
          route_id: 1,
          estimated_delivery_hours: 24,
          estimated_pickup_time: expect.any(String),
          message: 'I can deliver this!',
        });
      });
    });

    it('trims whitespace from message before submitting', async () => {
      (bidsAPI.create as jest.Mock).mockResolvedValue({ id: 1 });

      render(<BidModal {...defaultProps} />);

      const priceInput = screen.getByLabelText('Your Price *');
      const messageInput = screen.getByLabelText('Message to Sender');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '50' } });
      fireEvent.change(messageInput, { target: { value: '  Message with spaces  ' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(bidsAPI.create).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Message with spaces',
          })
        );
      });
    });

    it('does not include message if empty after trimming', async () => {
      (bidsAPI.create as jest.Mock).mockResolvedValue({ id: 1 });

      render(<BidModal {...defaultProps} />);

      const priceInput = screen.getByLabelText('Your Price *');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '50' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const callArgs = (bidsAPI.create as jest.Mock).mock.calls[0][0];
        expect(callArgs.message).toBeUndefined();
      });
    });

    it('does not include optional fields if not provided', async () => {
      (bidsAPI.create as jest.Mock).mockResolvedValue({ id: 1 });

      render(<BidModal {...defaultProps} />);

      const priceInput = screen.getByLabelText('Your Price *');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '50' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const callArgs = (bidsAPI.create as jest.Mock).mock.calls[0][0];
        expect(callArgs.estimated_delivery_hours).toBeUndefined();
        expect(callArgs.estimated_pickup_time).toBeUndefined();
        expect(callArgs.message).toBeUndefined();
      });
    });

    it('calls onBidPlaced after successful submission', async () => {
      (bidsAPI.create as jest.Mock).mockResolvedValue({ id: 1 });

      render(<BidModal {...defaultProps} />);

      const priceInput = screen.getByLabelText('Your Price *');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '50' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onBidPlaced).toHaveBeenCalled();
      });
    });

    it('calls onClose after successful submission', async () => {
      (bidsAPI.create as jest.Mock).mockResolvedValue({ id: 1 });

      render(<BidModal {...defaultProps} />);

      const priceInput = screen.getByLabelText('Your Price *');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '50' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API call fails', async () => {
      (bidsAPI.create as jest.Mock).mockRejectedValue({
        response: { data: { detail: 'Bid already exists' } },
      });

      render(<BidModal {...defaultProps} />);

      const priceInput = screen.getByLabelText('Your Price *');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '50' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Bid already exists')).toBeInTheDocument();
      });
    });

    it('displays generic error when API error has no detail', async () => {
      (bidsAPI.create as jest.Mock).mockRejectedValue({
        response: { data: {} },
      });

      render(<BidModal {...defaultProps} />);

      const priceInput = screen.getByLabelText('Your Price *');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '50' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to place bid')).toBeInTheDocument();
      });
    });

    it('clears previous error when resubmitting', async () => {
      (bidsAPI.create as jest.Mock).mockRejectedValue({
        response: { data: { detail: 'First error' } },
      });

      render(<BidModal {...defaultProps} />);

      const priceInput = screen.getByLabelText('Your Price *');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '50' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument();
      });

      // Fix the error and try again
      (bidsAPI.create as jest.Mock).mockResolvedValue({ id: 1 });
      fireEvent.change(priceInput, { target: { value: '60' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('disables submit button while submitting', async () => {
      (bidsAPI.create as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<BidModal {...defaultProps} />);

      const priceInput = screen.getByLabelText('Your Price *');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '50' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: 'Placing Bid...' });
        expect(button).toBeDisabled();
      });
    });

    it('shows loading text while submitting', async () => {
      (bidsAPI.create as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<BidModal {...defaultProps} />);

      const priceInput = screen.getByLabelText('Your Price *');
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });

      fireEvent.change(priceInput, { target: { value: '50' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Placing Bid...')).toBeInTheDocument();
      });
    });
  });

  describe('Modal Close', () => {
    it('calls onClose when close button is clicked', () => {
      render(<BidModal {...defaultProps} />);
      const closeButton = screen.getByRole('button', { name: '' }); // SVG close button
      fireEvent.click(closeButton);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when Cancel button is clicked', () => {
      render(<BidModal {...defaultProps} />);
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop is clicked', () => {
      const { container } = render(<BidModal {...defaultProps} />);
      const backdrop = container.querySelector('.bg-black.bg-opacity-50');
      fireEvent.click(backdrop!);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('resets form fields when closed', () => {
      const { rerender } = render(<BidModal {...defaultProps} />);

      // Fill form
      const priceInput = screen.getByLabelText('Your Price *') as HTMLInputElement;
      const messageInput = screen.getByLabelText('Message to Sender') as HTMLTextAreaElement;

      fireEvent.change(priceInput, { target: { value: '75' } });
      fireEvent.change(messageInput, { target: { value: 'Test message' } });

      expect(priceInput.value).toBe('75');
      expect(messageInput.value).toBe('Test message');

      // Close modal
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      // Reopen modal
      rerender(<BidModal {...defaultProps} isOpen={false} />);
      rerender(<BidModal {...defaultProps} isOpen={true} />);

      // Fields should be reset
      const newPriceInput = screen.getByLabelText('Your Price *') as HTMLInputElement;
      const newMessageInput = screen.getByLabelText('Message to Sender') as HTMLTextAreaElement;

      expect(newPriceInput.value).toBe('50');
      expect(newMessageInput.value).toBe('');
    });

    it('clears error when closed', () => {
      const { rerender } = render(<BidModal {...defaultProps} />);

      // Create validation error
      const submitButton = screen.getByRole('button', { name: 'Place Bid' });
      const priceInput = screen.getByLabelText('Your Price *');
      fireEvent.change(priceInput, { target: { value: '0' } });
      fireEvent.click(submitButton);

      // Close and reopen
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      rerender(<BidModal {...defaultProps} isOpen={false} />);
      rerender(<BidModal {...defaultProps} isOpen={true} />);

      // Error should be cleared
      expect(
        screen.queryByText('Please enter a valid price')
      ).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('form can be submitted with Enter key', async () => {
      (bidsAPI.create as jest.Mock).mockResolvedValue({ id: 1 });

      render(<BidModal {...defaultProps} />);

      const priceInput = screen.getByLabelText('Your Price *');
      const form = priceInput.closest('form');

      fireEvent.change(priceInput, { target: { value: '50' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(bidsAPI.create).toHaveBeenCalled();
      });
    });

    it('all form fields have labels', () => {
      render(<BidModal {...defaultProps} />);
      expect(screen.getByLabelText('Your Price *')).toBeInTheDocument();
      expect(
        screen.getByLabelText('Estimated Delivery Time (hours)')
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Estimated Pickup Time')).toBeInTheDocument();
      expect(screen.getByLabelText('Message to Sender')).toBeInTheDocument();
    });
  });
});
