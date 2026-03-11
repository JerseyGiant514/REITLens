import React from 'react';
import { captureException } from '../services/errorTracking';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback component to render on error */
  fallback?: React.ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Section label for the error boundary (e.g., "Dashboard", "Valuation") */
  section?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary - Catches render errors in child component trees.
 *
 * Usage:
 *   <ErrorBoundary section="Dashboard">
 *     <Dashboard />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary
 *     section="Charts"
 *     onError={(err) => sentryCapture(err)}
 *     fallback={<CustomFallback />}
 *   >
 *     <ChartComponent />
 *   </ErrorBoundary>
 *
 * Matches the existing dark theme:
 *   bg-obsidian (#010409), text-lightBlue (#48A3CC), etc.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details to console for debugging
    console.error(
      `[ErrorBoundary${this.props.section ? `:${this.props.section}` : ''}] Caught error:`,
      error,
      errorInfo
    );

    // Report to error tracking (graceful no-op if Sentry is not configured)
    captureException(error, {
      extra: { componentStack: errorInfo.componentStack || '' },
      tags: { section: this.props.section || 'unknown' },
    });

    this.setState({ errorInfo });

    // Fire the optional onError callback (for Sentry integration, analytics, etc.)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default styled fallback UI matching the dark theme
      return (
        <div
          style={{
            background: '#010409',
            minHeight: '200px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
            fontFamily: '"Plus Jakarta Sans", sans-serif',
          }}
        >
          {/* Error Container Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(2, 45, 91, 0.5) 0%, rgba(1, 4, 9, 0.8) 100%)',
              border: '1px solid rgba(95, 154, 174, 0.3)',
              borderRadius: '12px',
              padding: '32px',
              maxWidth: '520px',
              width: '100%',
              backdropFilter: 'blur(24px)',
              textAlign: 'center',
            }}
          >
            {/* Warning Icon */}
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(255, 157, 60, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '24px',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FF9D3C"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>

            {/* Title */}
            <h2
              style={{
                color: '#f1f5f9',
                fontSize: '18px',
                fontWeight: 700,
                marginBottom: '8px',
                letterSpacing: '0.5px',
              }}
            >
              Something went wrong
            </h2>

            {/* Section label */}
            {this.props.section && (
              <p
                style={{
                  color: '#5F9AAE',
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  marginBottom: '12px',
                }}
              >
                {this.props.section} module
              </p>
            )}

            {/* Error message */}
            {this.state.error && (
              <div
                style={{
                  background: 'rgba(248, 113, 113, 0.08)',
                  border: '1px solid rgba(248, 113, 113, 0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '20px',
                }}
              >
                <p
                  style={{
                    color: '#f87171',
                    fontSize: '13px',
                    fontFamily: '"JetBrains Mono", monospace',
                    wordBreak: 'break-word',
                    margin: 0,
                  }}
                >
                  {this.state.error.message}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '10px 24px',
                  background: '#48A3CC',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  transition: 'all 0.2s ease',
                  letterSpacing: '0.3px',
                }}
                onMouseOver={e => {
                  (e.target as HTMLButtonElement).style.background = '#3a8cb3';
                }}
                onMouseOut={e => {
                  (e.target as HTMLButtonElement).style.background = '#48A3CC';
                }}
              >
                Retry
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 24px',
                  background: 'transparent',
                  color: '#5F9AAE',
                  border: '1px solid rgba(95, 154, 174, 0.4)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  transition: 'all 0.2s ease',
                  letterSpacing: '0.3px',
                }}
                onMouseOver={e => {
                  (e.target as HTMLButtonElement).style.borderColor = '#48A3CC';
                  (e.target as HTMLButtonElement).style.color = '#48A3CC';
                }}
                onMouseOut={e => {
                  (e.target as HTMLButtonElement).style.borderColor = 'rgba(95, 154, 174, 0.4)';
                  (e.target as HTMLButtonElement).style.color = '#5F9AAE';
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
