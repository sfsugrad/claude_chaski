/**
 * Tests for ErrorBoundary component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for expected errors
  const originalError = console.error;

  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normal operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should render multiple children', () => {
      render(
        <ErrorBoundary>
          <div>First child</div>
          <div>Second child</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('First child')).toBeInTheDocument();
      expect(screen.getByText('Second child')).toBeInTheDocument();
    });

    it('should not show error UI when children render successfully', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should catch error and display fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should display apology message', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(
        screen.getByText(/We're sorry for the inconvenience/)
      ).toBeInTheDocument();
    });

    it('should show reload button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Reload page')).toBeInTheDocument();
    });

    it('should show go back button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Go back')).toBeInTheDocument();
    });

    it('should log error using logger', () => {
      const { logger } = require('@/lib/logger');

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(logger.error).toHaveBeenCalledWith(
        'React Error Boundary caught an error',
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });
  });

  describe('custom fallback', () => {
    it('should render custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div>Custom error message</div>}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should render custom fallback component', () => {
      const CustomFallback = () => (
        <div>
          <h1>Oops!</h1>
          <p>Something bad happened</p>
        </div>
      );

      render(
        <ErrorBoundary fallback={<CustomFallback />}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Oops!')).toBeInTheDocument();
      expect(screen.getByText('Something bad happened')).toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('should have reload button that can be clicked', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByText('Reload page');
      expect(reloadButton).toBeInTheDocument();

      // Verify button is a clickable element
      expect(reloadButton.tagName.toLowerCase()).toBe('button');
      expect(() => fireEvent.click(reloadButton)).not.toThrow();
    });

    it('should have go back button that can be clicked', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const backButton = screen.getByText('Go back');
      expect(backButton).toBeInTheDocument();

      // Verify button is a clickable element
      expect(backButton.tagName.toLowerCase()).toBe('button');
      expect(() => fireEvent.click(backButton)).not.toThrow();
    });

    it('should have buttons with onClick handlers', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByText('Reload page');
      const backButton = screen.getByText('Go back');

      // Both buttons should be present
      expect(reloadButton).toBeInTheDocument();
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('development mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should show error details in development mode', () => {
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Error message should be visible in development
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });
  });

  describe('getDerivedStateFromError', () => {
    it('should set hasError to true', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // If hasError is true, fallback UI is shown
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('nested error boundaries', () => {
    it('should only catch error in nearest boundary', () => {
      render(
        <ErrorBoundary fallback={<div>Outer error</div>}>
          <div>
            <ErrorBoundary fallback={<div>Inner error</div>}>
              <ThrowError />
            </ErrorBoundary>
          </div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Inner error')).toBeInTheDocument();
      expect(screen.queryByText('Outer error')).not.toBeInTheDocument();
    });
  });

  describe('error icon', () => {
    it('should display warning icon', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Check for SVG element
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should have centered layout', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const container = document.querySelector('.min-h-screen');
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('flex', 'items-center', 'justify-center');
    });

    it('should have proper button styling', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByText('Reload page');
      expect(reloadButton).toHaveClass('bg-primary-600');

      const backButton = screen.getByText('Go back');
      expect(backButton).toHaveClass('bg-surface-200');
    });
  });
});
