/**
 * Frontend error tracking and logging utility
 */

interface ErrorLog {
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  timestamp: string;
  url: string;
  userAgent: string;
  context?: Record<string, any>;
}

class Logger {
  private static instance: Logger;
  private isProduction: boolean;
  private apiUrl: string;

  private constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log an error
   */
  error(message: string, error?: Error, context?: Record<string, any>) {
    const errorLog: ErrorLog = {
      level: 'error',
      message,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
      context,
    };

    // Always log to console
    console.error(message, error, context);

    // Send to backend in production
    if (this.isProduction) {
      this.sendToBackend(errorLog);
    }
  }

  /**
   * Log a warning
   */
  warn(message: string, context?: Record<string, any>) {
    const errorLog: ErrorLog = {
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
      context,
    };

    // Always log to console
    console.warn(message, context);

    // Send to backend in production
    if (this.isProduction) {
      this.sendToBackend(errorLog);
    }
  }

  /**
   * Log info
   */
  info(message: string, context?: Record<string, any>) {
    const errorLog: ErrorLog = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
      context,
    };

    // Always log to console
    console.info(message, context);

    // Only send errors and warnings to backend
    // Don't send info logs to avoid too much traffic
  }

  /**
   * Send log to backend
   */
  private async sendToBackend(log: ErrorLog) {
    try {
      await fetch(`${this.apiUrl}/api/logs/frontend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log),
        credentials: 'include',
      });
    } catch (error) {
      // Silently fail - don't want logging to break the app
      console.error('Failed to send log to backend:', error);
    }
  }

  /**
   * Initialize global error handlers
   */
  initGlobalHandlers() {
    if (typeof window === 'undefined') return;

    // Handle unhandled errors
    window.addEventListener('error', (event) => {
      this.error(
        `Unhandled error: ${event.message}`,
        event.error,
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }
      );
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error(
        `Unhandled promise rejection: ${event.reason}`,
        event.reason instanceof Error ? event.reason : undefined,
        {
          promise: event.promise,
        }
      );
    });

    // Handle network errors
    window.addEventListener('offline', () => {
      this.warn('Network connection lost');
    });

    window.addEventListener('online', () => {
      this.info('Network connection restored');
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience functions
export const logError = (message: string, error?: Error, context?: Record<string, any>) => {
  logger.error(message, error, context);
};

export const logWarn = (message: string, context?: Record<string, any>) => {
  logger.warn(message, context);
};

export const logInfo = (message: string, context?: Record<string, any>) => {
  logger.info(message, context);
};
