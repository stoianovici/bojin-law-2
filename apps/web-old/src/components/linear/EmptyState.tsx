/**
 * EmptyState Component
 * Displays when content is unavailable or empty
 * Uses Linear design system for consistent styling
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  FileText,
  ClipboardCheck,
  Search,
  MessageCircle,
  Mail,
  Calendar,
  Folder,
  Users,
  Euro,
  CheckCircle,
} from 'lucide-react';

// ====================================================================
// Types
// ====================================================================

type EmptyStateVariant = 'page' | 'widget' | 'inline' | 'search';

type EmptyStatePreset =
  | 'cases'
  | 'tasks'
  | 'documents'
  | 'emails'
  | 'events'
  | 'comments'
  | 'search'
  | 'clients'
  | 'billing'
  | 'all-done';

interface EmptyStateProps {
  /** Preset for common empty states with pre-configured icon, title, description */
  preset?: EmptyStatePreset;
  /** Display variant */
  variant?: EmptyStateVariant;
  /** Custom icon (overrides preset) */
  icon?: React.ReactNode;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Call-to-action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  /** Secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Search query for search variant */
  query?: string;
  /** Use neutral (gray) styling instead of accent */
  neutral?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// ====================================================================
// Presets
// ====================================================================

const PRESET_CONFIG: Record<
  EmptyStatePreset,
  {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }
> = {
  cases: {
    icon: Folder,
    title: 'Niciun caz încă',
    description: 'Nu aveți dosare înregistrate. Creați primul dosar pentru a începe.',
  },
  tasks: {
    icon: ClipboardCheck,
    title: 'Nicio sarcină',
    description: 'Nu există sarcini în această perioadă.',
  },
  documents: {
    icon: FileText,
    title: 'Niciun document',
    description: 'Nu ați adăugat încă documente la acest dosar.',
  },
  emails: {
    icon: Mail,
    title: 'Niciun mesaj',
    description: 'Nu există mesaje de afișat.',
  },
  events: {
    icon: Calendar,
    title: 'Niciun eveniment',
    description: 'Nu există evenimente programate.',
  },
  comments: {
    icon: MessageCircle,
    title: 'Niciun comentariu',
    description: 'Fii primul care adaugă un comentariu.',
  },
  search: {
    icon: Search,
    title: 'Niciun rezultat',
    description: 'Nu am găsit rezultate pentru căutarea dvs.',
  },
  clients: {
    icon: Users,
    title: 'Niciun client',
    description: 'Nu aveți clienți înregistrați.',
  },
  billing: {
    icon: Euro,
    title: 'Nicio înregistrare',
    description: 'Nu există înregistrări de facturare.',
  },
  'all-done': {
    icon: CheckCircle,
    title: 'Totul e la zi!',
    description: 'Nu aveți sarcini restante.',
  },
};

// ====================================================================
// Component
// ====================================================================

/**
 * EmptyState component for displaying when content is unavailable
 *
 * @example
 * // Using preset
 * <EmptyState preset="documents" />
 *
 * // With action
 * <EmptyState
 *   preset="cases"
 *   action={{ label: 'Creează dosar', onClick: () => {} }}
 * />
 *
 * // Search empty state
 * <EmptyState
 *   preset="search"
 *   variant="search"
 *   query="contract vânzare"
 *   secondaryAction={{ label: 'Șterge căutarea', onClick: clearSearch }}
 * />
 *
 * // Inline variant
 * <EmptyState variant="inline" preset="comments" />
 *
 * // Custom content
 * <EmptyState
 *   icon={<CustomIcon />}
 *   title="Custom Title"
 *   description="Custom description text"
 * />
 */
export function EmptyState({
  preset,
  variant = 'page',
  icon,
  title,
  description,
  action,
  secondaryAction,
  query,
  neutral = false,
  className,
  children,
}: EmptyStateProps) {
  // Get preset configuration if preset is provided
  const presetConfig = preset ? PRESET_CONFIG[preset] : null;
  const PresetIcon = presetConfig?.icon;

  // Determine final values (props override preset)
  const finalTitle = title || presetConfig?.title || 'Niciun rezultat';
  const finalDescription =
    description ||
    (query ? `Nu am găsit rezultate pentru „${query}".` : presetConfig?.description || '');
  const IconComponent = icon || (PresetIcon && <PresetIcon className="w-7 h-7" />);

  // Inline variant
  if (variant === 'inline') {
    return (
      <div
        className={cn('flex items-center gap-3 p-4 rounded-lg', 'bg-linear-bg-tertiary', className)}
      >
        {IconComponent && (
          <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-linear-bg-hover text-linear-text-muted flex-shrink-0">
            {IconComponent}
          </div>
        )}
        <p className="text-sm text-linear-text-tertiary">{finalTitle}</p>
      </div>
    );
  }

  // Widget variant (simpler, often positive state)
  if (variant === 'widget') {
    return (
      <div
        className={cn('flex flex-col items-center justify-center py-8 px-4 text-center', className)}
      >
        {IconComponent && (
          <div
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-xl mb-3',
              neutral || preset === 'all-done'
                ? 'bg-linear-bg-tertiary text-linear-text-muted'
                : 'bg-linear-accent-muted text-linear-accent'
            )}
          >
            {IconComponent}
          </div>
        )}
        <p className="text-sm font-medium text-linear-text-primary">{finalTitle}</p>
        {finalDescription && (
          <p className="text-xs text-linear-text-tertiary mt-1 max-w-[200px]">{finalDescription}</p>
        )}
        {children}
      </div>
    );
  }

  // Search variant (includes query and clear action)
  if (variant === 'search') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 px-6 text-center max-w-[280px] mx-auto',
          className
        )}
      >
        {IconComponent && (
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-bg-tertiary text-linear-text-muted mb-5">
            {IconComponent}
          </div>
        )}
        <h3 className="text-[15px] font-semibold text-linear-text-primary mb-2">{finalTitle}</h3>
        <p className="text-[13px] text-linear-text-secondary leading-relaxed mb-5">
          {finalDescription}
        </p>
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="px-4 py-2 text-sm font-medium text-linear-text-primary bg-linear-bg-tertiary border border-linear-border rounded-md hover:bg-linear-bg-hover transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
        {children}
      </div>
    );
  }

  // Page variant (full page empty state with CTA)
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6 text-center max-w-[280px] mx-auto',
        className
      )}
    >
      {IconComponent && (
        <div
          className={cn(
            'flex items-center justify-center w-16 h-16 rounded-2xl mb-5',
            neutral
              ? 'bg-linear-bg-tertiary text-linear-text-muted'
              : 'bg-linear-accent-muted text-linear-accent'
          )}
        >
          {IconComponent}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-linear-text-primary mb-2">{finalTitle}</h3>
      {finalDescription && (
        <p className="text-[13px] text-linear-text-secondary leading-relaxed mb-5">
          {finalDescription}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-linear-accent rounded-md hover:bg-linear-accent-hover transition-colors"
        >
          {action.icon}
          {action.label}
        </button>
      )}
      {secondaryAction && (
        <button
          onClick={secondaryAction.onClick}
          className="mt-3 text-xs text-linear-text-tertiary hover:text-linear-text-secondary transition-colors"
        >
          {secondaryAction.label}
        </button>
      )}
      {children}
    </div>
  );
}

export type { EmptyStateProps, EmptyStateVariant, EmptyStatePreset };
