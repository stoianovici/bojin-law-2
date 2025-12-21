/**
 * PreviewButton Component
 * Reusable button for triggering document/attachment previews
 */

'use client';

import React from 'react';
import { Eye } from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface PreviewButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Visual variant */
  variant?: 'icon' | 'text' | 'full';
  /** Size variant */
  size?: 'sm' | 'md';
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function PreviewButton({
  onClick,
  disabled = false,
  loading = false,
  variant = 'icon',
  size = 'md',
  className,
}: PreviewButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    icon: clsx(
      'rounded-lg',
      size === 'sm' ? 'p-1.5' : 'p-2',
      'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
    ),
    text: clsx(
      'gap-1.5',
      size === 'sm' ? 'text-xs' : 'text-sm',
      'text-blue-600 hover:text-blue-700'
    ),
    full: clsx(
      'gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white',
      size === 'sm' ? 'text-xs' : 'text-sm',
      'text-gray-700 hover:bg-gray-50'
    ),
  };

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(baseClasses, variantClasses[variant], className)}
      aria-label="Previzualizează"
      title="Previzualizează"
    >
      <Eye className={clsx(iconSize, loading && 'animate-pulse')} />
      {variant !== 'icon' && <span>{loading ? 'Se încarcă...' : 'Previzualizează'}</span>}
    </button>
  );
}

PreviewButton.displayName = 'PreviewButton';

export default PreviewButton;
