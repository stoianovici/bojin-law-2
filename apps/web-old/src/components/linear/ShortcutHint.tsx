'use client';

/**
 * ShortcutHint Component
 * Displays keyboard shortcut hints in Linear style
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ====================================================================
// ShortcutHint - Inline keyboard shortcut badge
// ====================================================================

const shortcutHintVariants = cva('inline-flex items-center gap-0.5', {
  variants: {
    /** Visual style variant */
    variant: {
      default:
        '[&>kbd]:bg-linear-bg-tertiary [&>kbd]:border-linear-border [&>kbd]:text-linear-text-tertiary',
      muted:
        '[&>kbd]:bg-transparent [&>kbd]:border-linear-border-subtle [&>kbd]:text-linear-text-muted',
      accent:
        '[&>kbd]:bg-linear-accent/10 [&>kbd]:border-linear-accent/30 [&>kbd]:text-linear-accent',
    },
    /** Size variant */
    size: {
      sm: '[&>kbd]:text-[9px] [&>kbd]:px-1 [&>kbd]:py-0.5 [&>kbd]:min-w-[14px]',
      md: '[&>kbd]:text-[10px] [&>kbd]:px-1.5 [&>kbd]:py-0.5 [&>kbd]:min-w-[18px]',
      lg: '[&>kbd]:text-[11px] [&>kbd]:px-2 [&>kbd]:py-1 [&>kbd]:min-w-[22px]',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

export interface ShortcutHintProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof shortcutHintVariants> {
  /** Keys to display (e.g., ['⌘', 'K'] or ['Ctrl', 'Shift', 'P']) */
  keys: string[];
}

/**
 * ShortcutHint renders keyboard shortcut keys in styled badges:
 * - Each key is displayed in its own kbd element
 * - Linear-style dark theme with subtle borders
 * - Multiple size variants for different contexts
 *
 * @example
 * <ShortcutHint keys={['⌘', 'K']} />
 * // Renders: ⌘ K
 *
 * @example
 * <ShortcutHint keys={['Ctrl', 'Shift', 'P']} size="sm" />
 */
export function ShortcutHint({ className, variant, size, keys, ...props }: ShortcutHintProps) {
  return (
    <span className={cn(shortcutHintVariants({ variant, size }), className)} {...props}>
      {keys.map((key, index) => (
        <kbd
          key={index}
          className={cn(
            'inline-flex items-center justify-center',
            'font-mono font-medium',
            'border rounded',
            'select-none'
          )}
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

// ====================================================================
// ShortcutTooltip - Tooltip content with shortcut hint
// ====================================================================

export interface ShortcutTooltipProps {
  /** Tooltip label text */
  label: string;
  /** Shortcut keys to display */
  keys?: string[];
  /** Additional description */
  description?: string;
}

/**
 * ShortcutTooltip renders tooltip content with optional shortcut hint
 * Use with Tooltip component for consistent styling
 *
 * @example
 * <Tooltip>
 *   <TooltipTrigger>...</TooltipTrigger>
 *   <TooltipContent>
 *     <ShortcutTooltip label="Open command palette" keys={['⌘', 'K']} />
 *   </TooltipContent>
 * </Tooltip>
 */
export function ShortcutTooltip({ label, keys, description }: ShortcutTooltipProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <span className="text-linear-text-primary">{label}</span>
        {keys && keys.length > 0 && <ShortcutHint keys={keys} variant="muted" size="sm" />}
      </div>
      {description && <span className="text-xs text-linear-text-muted">{description}</span>}
    </div>
  );
}

// ====================================================================
// Common Shortcut Key Sets
// ====================================================================

/** Platform-aware command/meta key */
export function getMetaKey(): string {
  if (typeof navigator === 'undefined') return '⌘';
  return navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';
}

/** Common shortcut key presets */
export const ShortcutKeys = {
  commandPalette: () => [getMetaKey(), 'K'],
  search: () => [getMetaKey(), '/'],
  shortcuts: () => [getMetaKey(), '?'],
  save: () => [getMetaKey(), 'S'],
  newItem: () => [getMetaKey(), 'N'],
  escape: ['Esc'],
  enter: ['↵'],
  arrowUp: ['↑'],
  arrowDown: ['↓'],
  arrowLeft: ['←'],
  arrowRight: ['→'],
} as const;
