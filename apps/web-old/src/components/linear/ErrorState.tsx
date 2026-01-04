/**
 * ErrorState Component
 * Displays error states with retry actions
 * Uses Linear design system for consistent styling
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  AlertTriangle,
  XCircle,
  ShieldOff,
  Server,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';

// ====================================================================
// Types
// ====================================================================

type ErrorStateVariant = 'page' | 'section' | 'inline';
type ErrorCode = 403 | 404 | 500 | 'network' | 'unknown';

interface ErrorStateProps {
  /** Error variant determines layout and styling */
  variant?: ErrorStateVariant;
  /** HTTP error code or error type */
  code?: ErrorCode;
  /** Custom title (overrides code-based title) */
  title?: string;
  /** Custom description (overrides code-based description) */
  description?: string;
  /** Custom icon */
  icon?: React.ReactNode;
  /** Show retry button */
  onRetry?: () => void;
  /** Retry button label */
  retryLabel?: string;
  /** Show go back button */
  onBack?: () => void;
  /** Back button label */
  backLabel?: string;
  /** Show home link */
  homeHref?: string;
  /** Additional help text/link */
  helpText?: React.ReactNode;
  /** Is retry in progress */
  isRetrying?: boolean;
  className?: string;
}

// ====================================================================
// Error Code Configurations
// ====================================================================

const ERROR_CONFIG: Record<
  ErrorCode,
  {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }
> = {
  403: {
    icon: ShieldOff,
    title: 'Acces Interzis',
    description: 'Nu aveți permisiunea de a accesa această resursă.',
  },
  404: {
    icon: XCircle,
    title: 'Pagină negăsită',
    description: 'Pagina pe care o căutați nu există sau a fost mutată.',
  },
  500: {
    icon: Server,
    title: 'Eroare server',
    description: 'A apărut o eroare. Echipa noastră a fost notificată.',
  },
  network: {
    icon: AlertTriangle,
    title: 'Eroare de conexiune',
    description: 'Verificați conexiunea la internet și încercați din nou.',
  },
  unknown: {
    icon: AlertCircle,
    title: 'Eroare la încărcare',
    description: 'Nu am putut încărca datele. Verificați conexiunea și încercați din nou.',
  },
};

// ====================================================================
// Component
// ====================================================================

/**
 * ErrorState component for displaying errors with retry actions
 *
 * @example
 * // Page 404 error
 * <ErrorState code={404} onBack={() => router.back()} />
 *
 * // Section error with retry
 * <ErrorState
 *   variant="section"
 *   onRetry={refetch}
 *   isRetrying={isLoading}
 * />
 *
 * // Inline error
 * <ErrorState
 *   variant="inline"
 *   title="Eroare la salvare"
 *   description="Nu am putut salva modificările."
 * />
 *
 * // Custom error
 * <ErrorState
 *   icon={<CustomIcon />}
 *   title="Sesiune expirată"
 *   description="Vă rugăm să vă autentificați din nou."
 *   onRetry={reauth}
 *   retryLabel="Autentificare"
 * />
 */
export function ErrorState({
  variant = 'section',
  code = 'unknown',
  title,
  description,
  icon,
  onRetry,
  retryLabel = 'Reîncearcă',
  onBack,
  backLabel = 'Înapoi',
  homeHref = '/',
  helpText,
  isRetrying = false,
  className,
}: ErrorStateProps) {
  // Get error config
  const config = ERROR_CONFIG[code];
  const ErrorIcon = config.icon;

  // Determine final values
  const finalTitle = title || config.title;
  const finalDescription = description || config.description;
  const IconElement = icon || <ErrorIcon className="w-7 h-7" />;

  // Inline variant
  if (variant === 'inline') {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-start gap-2 p-3 rounded-lg',
          'bg-red-500/10 border border-red-500/20',
          className
        )}
      >
        <div className="flex-shrink-0 w-[18px] h-[18px] text-red-500 mt-0.5">{IconElement}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-linear-text-primary">{finalTitle}</p>
          {finalDescription && (
            <p className="text-[12px] text-linear-text-secondary mt-0.5">{finalDescription}</p>
          )}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-linear-accent hover:text-linear-accent-hover disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3 h-3', isRetrying && 'animate-spin')} />
            {isRetrying ? 'Se încearcă...' : retryLabel}
          </button>
        )}
      </div>
    );
  }

  // Section variant
  if (variant === 'section') {
    return (
      <div
        role="alert"
        className={cn(
          'flex flex-col items-center justify-center py-12 px-6 text-center',
          className
        )}
      >
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 mb-4">
          {IconElement}
        </div>
        <h3 className="text-[15px] font-semibold text-linear-text-primary mb-2">{finalTitle}</h3>
        <p className="text-[13px] text-linear-text-secondary max-w-[280px] mb-5">
          {finalDescription}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              'bg-linear-bg-tertiary text-linear-text-primary border border-linear-border',
              'hover:bg-linear-bg-hover disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isRetrying && 'animate-spin')} />
            {isRetrying ? 'Se încarcă...' : retryLabel}
          </button>
        )}
      </div>
    );
  }

  // Page variant (full page error like 404, 403, 500)
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center min-h-[400px] py-16 px-6 text-center',
        className
      )}
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 text-red-500 mb-5">
        {IconElement}
      </div>

      {typeof code === 'number' && (
        <p className="text-5xl font-bold text-linear-text-primary tracking-tight mb-2">{code}</p>
      )}

      <h1 className="text-lg font-semibold text-linear-text-primary mb-2">{finalTitle}</h1>
      <p className="text-[13px] text-linear-text-secondary max-w-[320px] leading-relaxed mb-6">
        {finalDescription}
      </p>

      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              'bg-linear-accent text-white hover:bg-linear-accent-hover'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </button>
        )}

        {homeHref && !onBack && (
          <a
            href={homeHref}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              'bg-linear-accent text-white hover:bg-linear-accent-hover'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Înapoi acasă
          </a>
        )}

        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              'bg-linear-bg-tertiary text-linear-text-primary border border-linear-border',
              'hover:bg-linear-bg-hover disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isRetrying && 'animate-spin')} />
            {isRetrying ? 'Se încarcă...' : retryLabel}
          </button>
        )}
      </div>

      {helpText && <p className="text-xs text-linear-text-tertiary mt-4">{helpText}</p>}
    </div>
  );
}

// ====================================================================
// Shorthand Components
// ====================================================================

interface PageErrorProps {
  code: 403 | 404 | 500;
  onBack?: () => void;
}

/**
 * Pre-configured page error for HTTP error codes
 */
export function PageError({ code, onBack }: PageErrorProps) {
  return (
    <ErrorState
      variant="page"
      code={code}
      onBack={onBack}
      homeHref="/"
      helpText="Aveți nevoie de ajutor?"
    />
  );
}

interface SectionErrorProps {
  onRetry: () => void;
  isRetrying?: boolean;
  title?: string;
  description?: string;
}

/**
 * Pre-configured section error with retry
 */
export function SectionError({ onRetry, isRetrying, title, description }: SectionErrorProps) {
  return (
    <ErrorState
      variant="section"
      title={title}
      description={description}
      onRetry={onRetry}
      isRetrying={isRetrying}
    />
  );
}

interface InlineErrorProps {
  title: string;
  description?: string;
  onRetry?: () => void;
}

/**
 * Pre-configured inline error
 */
export function InlineError({ title, description, onRetry }: InlineErrorProps) {
  return <ErrorState variant="inline" title={title} description={description} onRetry={onRetry} />;
}

export type { ErrorStateProps, ErrorStateVariant, ErrorCode };
