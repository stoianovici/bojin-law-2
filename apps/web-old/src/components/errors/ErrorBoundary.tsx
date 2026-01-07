/**
 * Error Boundary Component
 * Catches and handles React component errors gracefully
 * Used to prevent entire app crashes when component errors occur
 * Uses Linear design system for consistent dark-mode styling
 */

'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Error callback for logging */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Use compact inline error instead of full page */
  inline?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of the
 * component tree that crashed.
 *
 * Note: Error boundaries do NOT catch errors for:
 * - Event handlers
 * - Asynchronous code (e.g., setTimeout or requestAnimationFrame callbacks)
 * - Server-side rendering
 * - Errors thrown in the error boundary itself
 *
 * @example
 * // Wrap a page or section
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * // Inline error for widgets
 * <ErrorBoundary inline>
 *   <Widget />
 * </ErrorBoundary>
 *
 * // Custom fallback
 * <ErrorBoundary fallback={<CustomError />}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error Boundary caught an error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, log to error reporting service
    // Example: logErrorToService(error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleBack = () => {
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Inline error (compact, for widgets/sections)
      if (this.props.inline) {
        return (
          <div
            role="alert"
            className="flex flex-col items-center justify-center py-8 px-4 text-center"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-linear-text-primary mb-1">Eroare la încărcare</p>
            <p className="text-xs text-linear-text-tertiary mb-4">A apărut o eroare neașteptată.</p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md bg-linear-bg-tertiary text-linear-text-primary border border-linear-border hover:bg-linear-bg-hover transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reîncearcă
            </button>
          </div>
        );
      }

      // Full page error
      return (
        <div
          role="alert"
          className="min-h-screen flex items-center justify-center bg-linear-bg-primary p-6"
        >
          <div className="max-w-md w-full">
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 text-red-500 mb-5">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <h2 className="text-lg font-semibold text-linear-text-primary mb-2">
                A apărut o eroare
              </h2>
              <p className="text-[13px] text-linear-text-secondary leading-relaxed mb-6">
                Ne pare rău, dar ceva nu a mers bine. Vă rugăm să reîncărcați pagina sau să
                încercați din nou mai târziu.
              </p>

              {this.state.error && (
                <details className="w-full mb-6 text-left">
                  <summary className="cursor-pointer text-xs text-linear-text-tertiary hover:text-linear-text-secondary transition-colors">
                    Detalii tehnice
                  </summary>
                  <pre className="mt-2 text-xs bg-linear-bg-secondary p-3 rounded-md overflow-x-auto border border-linear-border text-linear-text-secondary">
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={this.handleReload}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-linear-accent text-white hover:bg-linear-accent-hover transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reîncarcă pagina
                </button>
                <button
                  onClick={this.handleBack}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-linear-bg-tertiary text-linear-text-primary border border-linear-border hover:bg-linear-bg-hover transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Înapoi
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
