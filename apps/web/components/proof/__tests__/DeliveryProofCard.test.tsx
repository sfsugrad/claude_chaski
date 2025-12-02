import { render, screen, fireEvent } from '@testing-library/react';
import { DeliveryProofCard } from '../DeliveryProofCard';
import { DeliveryProofResponse } from '@/lib/api';

// Mock UI components
jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ variant, children }: { variant: string; children: React.ReactNode }) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

jest.mock('@/components/ui/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) =>
    isOpen ? (
      <div data-testid="modal" data-title={title}>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

describe('DeliveryProofCard Component', () => {
  const mockProof: DeliveryProofResponse = {
    id: 1,
    package_id: 1,
    tracking_id: 'PKG123',
    proof_type: 'both',
    photo_url: 'https://example.com/photo.jpg',
    signature_url: 'https://example.com/signature.png',
    recipient_name: 'John Doe',
    recipient_relationship: 'self',
    notes: 'Package delivered to front door',
    latitude: 37.7749,
    longitude: -122.4194,
    distance_from_dropoff_meters: 15.5,
    captured_at: '2024-01-15T10:00:00Z',
    created_at: '2024-01-15T10:05:00Z',
    is_verified: true,
  };

  describe('Rendering', () => {
    it('renders the delivery proof card', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByText('Delivery Proof')).toBeInTheDocument();
    });

    it('renders card header and content', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      expect(screen.getByTestId('card-header')).toBeInTheDocument();
      expect(screen.getByTestId('card-content')).toBeInTheDocument();
    });
  });

  describe('Verification Badge', () => {
    it('shows verified badge when proof is verified', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      const badges = screen.getAllByTestId('badge');
      const verificationBadge = badges.find(badge => badge.textContent === 'Verified');
      expect(verificationBadge).toBeInTheDocument();
      expect(verificationBadge).toHaveAttribute('data-variant', 'success');
    });

    it('shows pending verification badge when proof is not verified', () => {
      const unverifiedProof = { ...mockProof, is_verified: false };
      render(<DeliveryProofCard proof={unverifiedProof} />);
      const badges = screen.getAllByTestId('badge');
      const verificationBadge = badges.find(badge => badge.textContent === 'Pending Verification');
      expect(verificationBadge).toBeInTheDocument();
      expect(verificationBadge).toHaveAttribute('data-variant', 'warning');
    });
  });

  describe('Proof Type Badge', () => {
    it('displays "Photo + Signature" for both type', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      expect(screen.getByText('Photo + Signature')).toBeInTheDocument();
    });

    it('displays "Photo Only" for photo type', () => {
      const photoProof = { ...mockProof, proof_type: 'photo' as const };
      render(<DeliveryProofCard proof={photoProof} />);
      expect(screen.getByText('Photo Only')).toBeInTheDocument();
    });

    it('displays "Signature Only" for signature type', () => {
      const signatureProof = { ...mockProof, proof_type: 'signature' as const };
      render(<DeliveryProofCard proof={signatureProof} />);
      expect(screen.getByText('Signature Only')).toBeInTheDocument();
    });

    it('displays "None" for unknown type', () => {
      const noneProof = { ...mockProof, proof_type: 'none' as any };
      render(<DeliveryProofCard proof={noneProof} />);
      expect(screen.getByText('None')).toBeInTheDocument();
    });
  });

  describe('Photo Display', () => {
    it('renders photo when photo_url is provided', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      const img = screen.getByAlt('Delivery proof');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    });

    it('does not render photo section when photo_url is null', () => {
      const noPhotoProof = { ...mockProof, photo_url: null };
      render(<DeliveryProofCard proof={noPhotoProof} />);
      expect(screen.queryByAlt('Delivery proof')).not.toBeInTheDocument();
    });

    it('opens photo modal when photo is clicked', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      const photoButton = screen.getByAlt('Delivery proof').closest('button');
      fireEvent.click(photoButton!);

      const modal = screen.getByTestId('modal');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('data-title', 'Delivery Photo');
    });

    it('closes photo modal when close button is clicked', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      const photoButton = screen.getByAlt('Delivery proof').closest('button');
      fireEvent.click(photoButton!);

      expect(screen.getByTestId('modal')).toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  describe('Signature Display', () => {
    it('renders signature when signature_url is provided', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      const img = screen.getByAlt('Recipient signature');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/signature.png');
    });

    it('does not render signature section when signature_url is null', () => {
      const noSignatureProof = { ...mockProof, signature_url: null };
      render(<DeliveryProofCard proof={noSignatureProof} />);
      expect(screen.queryByAlt('Recipient signature')).not.toBeInTheDocument();
    });

    it('opens signature modal when signature is clicked', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      const signatureButton = screen.getByAlt('Recipient signature').closest('button');
      fireEvent.click(signatureButton!);

      const modal = screen.getByTestId('modal');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('data-title', 'Recipient Signature');
    });
  });

  describe('Recipient Information', () => {
    it('displays recipient name when provided', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('displays recipient relationship when provided', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      expect(screen.getByText('(self)')).toBeInTheDocument();
    });

    it('capitalizes relationship text', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      const relationship = screen.getByText('(self)');
      expect(relationship.className).toContain('capitalize');
    });

    it('does not render recipient section when both name and relationship are null', () => {
      const noRecipientProof = {
        ...mockProof,
        recipient_name: null,
        recipient_relationship: null,
      };
      render(<DeliveryProofCard proof={noRecipientProof} />);
      expect(screen.queryByText('Recipient')).not.toBeInTheDocument();
    });

    it('renders recipient section with only name', () => {
      const nameOnlyProof = { ...mockProof, recipient_relationship: null };
      render(<DeliveryProofCard proof={nameOnlyProof} />);
      expect(screen.getByText('Recipient')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('renders recipient section with only relationship', () => {
      const relationshipOnlyProof = { ...mockProof, recipient_name: null };
      render(<DeliveryProofCard proof={relationshipOnlyProof} />);
      expect(screen.getByText('Recipient')).toBeInTheDocument();
      expect(screen.getByText('(self)')).toBeInTheDocument();
    });
  });

  describe('Notes', () => {
    it('displays notes when provided', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Package delivered to front door')).toBeInTheDocument();
    });

    it('does not render notes section when notes is null', () => {
      const noNotesProof = { ...mockProof, notes: null };
      render(<DeliveryProofCard proof={noNotesProof} />);
      expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    });
  });

  describe('Location Information', () => {
    it('displays distance from dropoff in meters when less than 1000m', () => {
      const closeProof = { ...mockProof, distance_from_dropoff_meters: 500 };
      render(<DeliveryProofCard proof={closeProof} />);
      expect(screen.getByText('Distance from dropoff')).toBeInTheDocument();
      expect(screen.getByText('500m')).toBeInTheDocument();
    });

    it('displays distance from dropoff in kilometers when 1000m or more', () => {
      const farProof = { ...mockProof, distance_from_dropoff_meters: 1500 };
      render(<DeliveryProofCard proof={farProof} />);
      expect(screen.getByText('1.50km')).toBeInTheDocument();
    });

    it('displays "Unknown" when distance is null', () => {
      const unknownDistanceProof = { ...mockProof, distance_from_dropoff_meters: null };
      render(<DeliveryProofCard proof={unknownDistanceProof} />);
      // Location info section won't render if both distance and coords are null
      const noLocationProof = {
        ...unknownDistanceProof,
        latitude: null,
        longitude: null,
      };
      render(<DeliveryProofCard proof={noLocationProof} />);
      expect(screen.queryByText('Distance from dropoff')).not.toBeInTheDocument();
    });

    it('displays coordinates when provided', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      expect(screen.getByText('Coordinates')).toBeInTheDocument();
      expect(screen.getByText('37.774900, -122.419400')).toBeInTheDocument();
    });

    it('formats coordinates to 6 decimal places', () => {
      const preciseProof = { ...mockProof, latitude: 37.77489123, longitude: -122.41940045 };
      render(<DeliveryProofCard proof={preciseProof} />);
      expect(screen.getByText('37.774891, -122.419400')).toBeInTheDocument();
    });

    it('does not render location section when all location data is null', () => {
      const noLocationProof = {
        ...mockProof,
        latitude: null,
        longitude: null,
        distance_from_dropoff_meters: null,
      };
      render(<DeliveryProofCard proof={noLocationProof} />);
      expect(screen.queryByText('Distance from dropoff')).not.toBeInTheDocument();
      expect(screen.queryByText('Coordinates')).not.toBeInTheDocument();
    });
  });

  describe('Timestamps', () => {
    it('displays captured timestamp', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      expect(screen.getByText('Captured')).toBeInTheDocument();
    });

    it('displays submitted timestamp', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });

    it('formats dates as locale strings', () => {
      render(<DeliveryProofCard proof={mockProof} />);
      const expectedCaptured = new Date('2024-01-15T10:00:00Z').toLocaleString();
      const expectedSubmitted = new Date('2024-01-15T10:05:00Z').toLocaleString();
      expect(screen.getByText(expectedCaptured)).toBeInTheDocument();
      expect(screen.getByText(expectedSubmitted)).toBeInTheDocument();
    });
  });

  describe('Complete Proof Display', () => {
    it('renders all sections when all data is provided', () => {
      render(<DeliveryProofCard proof={mockProof} />);

      // Check all sections are present
      expect(screen.getByText('Delivery Proof')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.getByText('Photo + Signature')).toBeInTheDocument();
      expect(screen.getByAlt('Delivery proof')).toBeInTheDocument();
      expect(screen.getByAlt('Recipient signature')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Package delivered to front door')).toBeInTheDocument();
      expect(screen.getByText('16m')).toBeInTheDocument();
      expect(screen.getByText('37.774900, -122.419400')).toBeInTheDocument();
    });

    it('renders minimal proof with only required fields', () => {
      const minimalProof: DeliveryProofResponse = {
        id: 1,
        package_id: 1,
        tracking_id: 'PKG123',
        proof_type: 'none',
        photo_url: null,
        signature_url: null,
        recipient_name: null,
        recipient_relationship: null,
        notes: null,
        latitude: null,
        longitude: null,
        distance_from_dropoff_meters: null,
        captured_at: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:05:00Z',
        is_verified: false,
      };

      render(<DeliveryProofCard proof={minimalProof} />);

      expect(screen.getByText('Delivery Proof')).toBeInTheDocument();
      expect(screen.getByText('Pending Verification')).toBeInTheDocument();
      expect(screen.getByText('None')).toBeInTheDocument();
      // No optional sections should render
      expect(screen.queryByAlt('Delivery proof')).not.toBeInTheDocument();
      expect(screen.queryByText('Recipient')).not.toBeInTheDocument();
      expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    });
  });
});
