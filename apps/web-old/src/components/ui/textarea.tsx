'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ====================================================================
// Textarea Component
// ====================================================================

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Enable auto-resize based on content */
  autoResize?: boolean;
  /** Minimum height when auto-resizing */
  minHeight?: number;
  /** Maximum height when auto-resizing */
  maxHeight?: number;
}

/**
 * Textarea component with Linear styling
 *
 * Features:
 * - Dark tertiary background
 * - Subtle border with accent focus glow
 * - Optional auto-resize based on content
 *
 * @example
 * // Basic usage
 * <Textarea placeholder="Adaugă un comentariu..." />
 *
 * // With auto-resize
 * <Textarea autoResize minHeight={80} maxHeight={300} />
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoResize = false, minHeight = 80, maxHeight = 400, onChange, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const resolvedRef = (ref as React.RefObject<HTMLTextAreaElement>) || textareaRef;

    const adjustHeight = React.useCallback(() => {
      const textarea = resolvedRef.current;
      if (!textarea || !autoResize) return;

      // Reset height to calculate scrollHeight correctly
      textarea.style.height = 'auto';

      // Calculate new height
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;

      // Add overflow when at max height
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [autoResize, minHeight, maxHeight, resolvedRef]);

    // Adjust on mount and when value changes
    React.useEffect(() => {
      adjustHeight();
    }, [adjustHeight, props.value, props.defaultValue]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      adjustHeight();
      onChange?.(e);
    };

    return (
      <textarea
        className={cn(
          'flex w-full rounded-lg',
          'bg-linear-bg-tertiary border border-linear-border-subtle',
          'px-3 py-2.5 text-[13px] text-linear-text-primary',
          'placeholder:text-linear-text-muted',
          'transition-all duration-150 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent/20 focus-visible:border-linear-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'resize-none',
          'font-[inherit]',
          className
        )}
        ref={resolvedRef}
        onChange={handleChange}
        style={{
          minHeight: autoResize ? minHeight : undefined,
          ...props.style,
        }}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
