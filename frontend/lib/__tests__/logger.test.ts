/**
 * Tests for Frontend Logger utility
 */

import { logger, logError, logWarn, logInfo } from '../logger';

describe('Logger', () => {
  // Mock console methods
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleInfo = console.info;

  let mockConsoleError: jest.Mock;
  let mockConsoleWarn: jest.Mock;
  let mockConsoleInfo: jest.Mock;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    // Mock console methods
    mockConsoleError = jest.fn();
    mockConsoleWarn = jest.fn();
    mockConsoleInfo = jest.fn();
    console.error = mockConsoleError;
    console.warn = mockConsoleWarn;
    console.info = mockConsoleInfo;

    // Mock fetch
    mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.info = originalConsoleInfo;
    jest.resetAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = (logger as any).constructor.getInstance();
      const instance2 = (logger as any).constructor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('error', () => {
    it('should log error to console', () => {
      logger.error('Test error');
      expect(mockConsoleError).toHaveBeenCalledWith('Test error', undefined, undefined);
    });

    it('should log error with Error object to console', () => {
      const error = new Error('Test error object');
      logger.error('Test error', error);
      expect(mockConsoleError).toHaveBeenCalledWith('Test error', error, undefined);
    });

    it('should log error with context to console', () => {
      const context = { userId: 123, action: 'test' };
      logger.error('Test error', undefined, context);
      expect(mockConsoleError).toHaveBeenCalledWith('Test error', undefined, context);
    });

    it('should log error with Error object and context', () => {
      const error = new Error('Test error');
      const context = { packageId: 456 };
      logger.error('Test error', error, context);
      expect(mockConsoleError).toHaveBeenCalledWith('Test error', error, context);
    });
  });

  describe('warn', () => {
    it('should log warning to console', () => {
      logger.warn('Test warning');
      expect(mockConsoleWarn).toHaveBeenCalledWith('Test warning', undefined);
    });

    it('should log warning with context to console', () => {
      const context = { type: 'deprecation' };
      logger.warn('Test warning', context);
      expect(mockConsoleWarn).toHaveBeenCalledWith('Test warning', context);
    });
  });

  describe('info', () => {
    it('should log info to console', () => {
      logger.info('Test info');
      expect(mockConsoleInfo).toHaveBeenCalledWith('Test info', undefined);
    });

    it('should log info with context to console', () => {
      const context = { page: 'dashboard' };
      logger.info('Test info', context);
      expect(mockConsoleInfo).toHaveBeenCalledWith('Test info', context);
    });
  });

  describe('convenience functions', () => {
    it('logError should call logger.error', () => {
      const error = new Error('Test');
      const context = { test: true };
      logError('Test error', error, context);
      expect(mockConsoleError).toHaveBeenCalledWith('Test error', error, context);
    });

    it('logWarn should call logger.warn', () => {
      const context = { test: true };
      logWarn('Test warning', context);
      expect(mockConsoleWarn).toHaveBeenCalledWith('Test warning', context);
    });

    it('logInfo should call logger.info', () => {
      const context = { test: true };
      logInfo('Test info', context);
      expect(mockConsoleInfo).toHaveBeenCalledWith('Test info', context);
    });
  });

  describe('initGlobalHandlers', () => {
    it('should add event listeners for error events', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      logger.initGlobalHandlers();

      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });
  });

  describe('error handling in sendToBackend', () => {
    it('should silently fail if fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // This shouldn't throw even if fetch fails
      expect(() => logger.error('Test error')).not.toThrow();
    });
  });

  describe('error event handler', () => {
    it('should log unhandled errors', () => {
      logger.initGlobalHandlers();

      // Simulate an error event
      const errorEvent = new ErrorEvent('error', {
        message: 'Test unhandled error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
        error: new Error('Test'),
      });

      window.dispatchEvent(errorEvent);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled error'),
        expect.any(Error),
        expect.objectContaining({
          filename: 'test.js',
          lineno: 10,
          colno: 5,
        })
      );
    });
  });

  describe('network event handlers', () => {
    it('should log offline event', () => {
      logger.initGlobalHandlers();

      window.dispatchEvent(new Event('offline'));

      expect(mockConsoleWarn).toHaveBeenCalledWith('Network connection lost', undefined);
    });

    it('should log online event', () => {
      logger.initGlobalHandlers();

      window.dispatchEvent(new Event('online'));

      expect(mockConsoleInfo).toHaveBeenCalledWith('Network connection restored', undefined);
    });
  });
});
