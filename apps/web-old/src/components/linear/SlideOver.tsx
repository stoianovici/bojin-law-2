'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ============================================================================
// Types
// ============================================================================

export interface SlideOverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  cancelLabel?: string;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit?: () => void | Promise<void>;
  loading?: boolean;
  showFooter?: boolean;
  children?: React.ReactNode;
  trigger?: React.ReactNode;
  /** Width of the panel. Default is 400px */
  width?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// Width Config
// ============================================================================

const widthConfig = {
  sm: 'w-[320px]',
  md: 'w-[400px]',
  lg: 'w-[480px]',
};

// ============================================================================
// SlideOver Component
// ============================================================================

export function SlideOver({
  open,
  onOpenChange,
  title,
  cancelLabel = 'Anulează',
  submitLabel = 'Salvează',
  onCancel,
  onSubmit,
  loading = false,
  showFooter = true,
  children,
  trigger,
  width = 'md',
}: SlideOverProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);
  const isLoading = loading || internalLoading;

  const handleSubmit = React.useCallback(async () => {
    if (onSubmit && !isLoading) {
      setInternalLoading(true);
      try {
        await onSubmit();
      } finally {
        setInternalLoading(false);
      }
    }
  }, [onSubmit, isLoading]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        {/* Backdrop with 60% black (lighter for slide-over) */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/60',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        {/* Slide-over panel */}
        <DialogPrimitive.Content
          className={cn(
            'fixed right-0 top-0 bottom-0 z-50',
            widthConfig[width],
            'max-w-[90vw]',
            'bg-linear-bg-secondary border-l border-linear-border-subtle',
            'flex flex-col',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'duration-200'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-linear-border-subtle shrink-0">
            <DialogPrimitive.Title className="text-[15px] font-semibold text-linear-text-primary">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className={cn(
                  'w-7 h-7 flex items-center justify-center',
                  'bg-transparent border-none rounded-md',
                  'text-linear-text-tertiary hover:text-linear-text-primary hover:bg-linear-bg-hover',
                  'transition-colors cursor-pointer'
                )}
              >
                <X className="w-4 h-4" />
                <span className="sr-only">Închide</span>
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Body - scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

          {/* Footer (optional) */}
          {showFooter && (
            <div
              className={cn(
                'flex gap-3 justify-end px-5 py-4',
                'border-t border-linear-border-subtle bg-linear-bg-tertiary shrink-0'
              )}
            >
              <DialogPrimitive.Close asChild>
                <Button variant="secondary" onClick={onCancel}>
                  {cancelLabel}
                </Button>
              </DialogPrimitive.Close>
              <Button variant="primary" onClick={handleSubmit} loading={isLoading}>
                {submitLabel}
              </Button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ============================================================================
// SlideOver Section Helper
// ============================================================================

export interface SlideOverSectionProps {
  title?: string;
  className?: string;
  children: React.ReactNode;
}

export function SlideOverSection({ title, className, children }: SlideOverSectionProps) {
  return (
    <div className={cn('mb-5 last:mb-0', className)}>
      {title && (
        <h3 className="text-xs font-medium text-linear-text-tertiary uppercase tracking-wide mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
