'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ============================================================================
// Types
// ============================================================================

export interface FormModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  cancelLabel?: string;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit?: () => void | Promise<void>;
  loading?: boolean;
  showKeyboardHint?: boolean;
  children?: React.ReactNode;
  trigger?: React.ReactNode;
  /** Width of the modal. Default is 520px */
  width?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// Width Config
// ============================================================================

const widthConfig = {
  sm: 'w-[400px]',
  md: 'w-[520px]',
  lg: 'w-[640px]',
};

// ============================================================================
// FormModal Component
// ============================================================================

export function FormModal({
  open,
  onOpenChange,
  title,
  cancelLabel = 'Anulează',
  submitLabel = 'Salvează',
  onCancel,
  onSubmit,
  loading = false,
  showKeyboardHint = true,
  children,
  trigger,
  width = 'md',
}: FormModalProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);
  const isLoading = loading || internalLoading;

  // Handle keyboard shortcut (⌘+Enter or Ctrl+Enter)
  const handleKeyDown = React.useCallback(
    async (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (onSubmit && !isLoading) {
          setInternalLoading(true);
          try {
            await onSubmit();
          } finally {
            setInternalLoading(false);
          }
        }
      }
    },
    [onSubmit, isLoading]
  );

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
        {/* Backdrop with 80% black and blur */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        {/* Modal content */}
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            widthConfig[width],
            'max-w-[90vw] max-h-[90vh]',
            'bg-linear-bg-secondary border border-linear-border-subtle rounded-xl',
            'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]',
            'overflow-hidden flex flex-col',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'
          )}
          onKeyDown={handleKeyDown}
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

          {/* Footer */}
          <div
            className={cn(
              'flex items-center justify-between px-5 py-4',
              'border-t border-linear-border-subtle bg-linear-bg-tertiary shrink-0'
            )}
          >
            {/* Keyboard hint */}
            {showKeyboardHint ? (
              <span className="text-xs text-linear-text-muted flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-linear-bg-hover border border-linear-border-subtle rounded text-[11px] font-sans text-linear-text-tertiary">
                  ⌘
                </kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 bg-linear-bg-hover border border-linear-border-subtle rounded text-[11px] font-sans text-linear-text-tertiary">
                  Enter
                </kbd>
                <span className="ml-1">salvează</span>
              </span>
            ) : (
              <div />
            )}

            {/* Actions */}
            <div className="flex gap-2.5">
              <DialogPrimitive.Close asChild>
                <Button variant="secondary" onClick={onCancel}>
                  {cancelLabel}
                </Button>
              </DialogPrimitive.Close>
              <Button variant="primary" onClick={handleSubmit} loading={isLoading}>
                {submitLabel}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ============================================================================
// Form Group Helper Components
// ============================================================================

export interface FormGroupProps {
  label?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormGroup({ label, className, children }: FormGroupProps) {
  return (
    <div className={cn('mb-4 last:mb-0', className)}>
      {label && (
        <label className="block text-xs font-medium text-linear-text-tertiary uppercase tracking-wide mb-2">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

export interface FormRowProps {
  className?: string;
  children: React.ReactNode;
}

export function FormRow({ className, children }: FormRowProps) {
  return <div className={cn('grid grid-cols-2 gap-4', className)}>{children}</div>;
}

export function FormDivider() {
  return <div className="h-px bg-linear-border-subtle my-5" />;
}
