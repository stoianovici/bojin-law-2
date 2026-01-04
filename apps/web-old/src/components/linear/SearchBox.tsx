'use client';

/**
 * SearchBox Component
 * Search input with icon and optional keyboard shortcut hint
 * Follows Linear design patterns
 */

import * as React from 'react';
import { Search } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { ShortcutHint, getMetaKey } from './ShortcutHint';

// ====================================================================
// SearchBox Variants
// ====================================================================

const searchBoxVariants = cva(
  [
    'flex items-center gap-2',
    'bg-linear-bg-tertiary',
    'border border-linear-border-subtle',
    'rounded-lg',
    'transition-all duration-150 ease-in-out',
    'focus-within:border-linear-accent focus-within:ring-2 focus-within:ring-linear-accent/20',
  ],
  {
    variants: {
      size: {
        sm: 'px-2.5 py-1.5',
        md: 'px-3 py-2',
        lg: 'px-4 py-2.5',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const searchIconVariants = cva('text-linear-text-tertiary flex-shrink-0', {
  variants: {
    size: {
      sm: 'w-3.5 h-3.5',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const searchInputVariants = cva(
  [
    'flex-1 bg-transparent border-none outline-none',
    'text-linear-text-primary placeholder:text-linear-text-tertiary',
    'min-w-0',
  ],
  {
    variants: {
      size: {
        sm: 'text-xs',
        md: 'text-[13px]',
        lg: 'text-sm',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

// ====================================================================
// SearchBox Component
// ====================================================================

export interface SearchBoxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof searchBoxVariants> {
  /** Show keyboard shortcut hint (e.g., ⌘K) */
  showShortcut?: boolean;
  /** Custom shortcut keys (defaults to ['⌘', 'K']) */
  shortcutKeys?: string[];
  /** Container className override */
  containerClassName?: string;
  /** Callback when shortcut is triggered */
  onShortcut?: () => void;
}

/**
 * SearchBox renders a search input with Linear styling:
 * - Search icon prefix
 * - Optional keyboard shortcut hint
 * - Focus glow effect
 * - Configurable width (recommended: 200-240px)
 *
 * @example
 * <SearchBox
 *   placeholder="Caută..."
 *   showShortcut
 *   className="w-[220px]"
 * />
 */
export const SearchBox = React.forwardRef<HTMLInputElement, SearchBoxProps>(
  (
    {
      className,
      containerClassName,
      size,
      showShortcut = false,
      shortcutKeys,
      placeholder = 'Caută...',
      onShortcut,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const resolvedRef = (ref as React.RefObject<HTMLInputElement>) || inputRef;

    // Handle keyboard shortcut
    React.useEffect(() => {
      if (!showShortcut) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        const isMac = navigator.platform.includes('Mac');
        const modifier = isMac ? e.metaKey : e.ctrlKey;

        if (modifier && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          if (onShortcut) {
            onShortcut();
          } else {
            resolvedRef.current?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showShortcut, onShortcut, resolvedRef]);

    const defaultShortcutKeys = React.useMemo(
      () => shortcutKeys || [getMetaKey(), 'K'],
      [shortcutKeys]
    );

    return (
      <div className={cn(searchBoxVariants({ size }), containerClassName)}>
        <Search className={searchIconVariants({ size })} />
        <input
          ref={resolvedRef}
          type="text"
          placeholder={placeholder}
          className={cn(searchInputVariants({ size }), className)}
          {...props}
        />
        {showShortcut && <ShortcutHint keys={defaultShortcutKeys} size="sm" variant="muted" />}
      </div>
    );
  }
);
SearchBox.displayName = 'SearchBox';
