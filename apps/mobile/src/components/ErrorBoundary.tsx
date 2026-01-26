'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';

// ============================================
// Types
// ============================================

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ============================================
// Component
// ============================================

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center px-6 py-12">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-error" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Ceva nu a mers bine</h2>
          <p className="text-sm text-text-secondary text-center mb-6 max-w-sm">
            A apărut o eroare neașteptată. Încearcă să reîncarci pagina.
          </p>
          <Button onClick={this.handleRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Încearcă din nou
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================
// Inline Error Component (for non-boundary errors)
// ============================================

interface InlineErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function InlineError({ message = 'A apărut o eroare', onRetry }: InlineErrorProps) {
  return (
    <div className="py-8 px-4 text-center">
      <AlertTriangle className="w-8 h-8 text-error mx-auto mb-3" />
      <p className="text-sm text-text-secondary mb-4">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Încearcă din nou
        </Button>
      )}
    </div>
  );
}
