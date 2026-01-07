'use client';

import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ============================================================================
// Types
// ============================================================================

export type ConfirmDialogSeverity = 'danger' | 'warning' | 'info';

export interface ConfirmDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  severity?: ConfirmDialogSeverity;
  cancelLabel?: string;
  actionLabel: string;
  onCancel?: () => void;
  onAction: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}

// ============================================================================
// Severity Configs
// ============================================================================

const severityConfig: Record<
  ConfirmDialogSeverity,
  { icon: React.ElementType; bgClass: string; iconClass: string }
> = {
  danger: {
    icon: AlertTriangle,
    bgClass: 'bg-linear-error/15',
    iconClass: 'text-linear-error',
  },
  warning: {
    icon: AlertCircle,
    bgClass: 'bg-amber-500/15',
    iconClass: 'text-amber-500',
  },
  info: {
    icon: Info,
    bgClass: 'bg-linear-accent/15',
    iconClass: 'text-linear-accent',
  },
};

// ============================================================================
// ConfirmDialog Component
// ============================================================================

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  severity = 'danger',
  cancelLabel = 'Anulează',
  actionLabel,
  onCancel,
  onAction,
  loading = false,
  children,
}: ConfirmDialogProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children && <AlertDialogPrimitive.Trigger asChild>{children}</AlertDialogPrimitive.Trigger>}
      <AlertDialogPrimitive.Portal>
        {/* Backdrop with 80% black and blur */}
        <AlertDialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        {/* Dialog content - 400px, centered */}
        <AlertDialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[400px] max-w-[90vw]',
            'bg-linear-bg-elevated border border-linear-border-subtle rounded-2xl',
            'p-6 shadow-[0_8px_24px_rgba(0,0,0,0.5)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'
          )}
        >
          {/* Severity Icon */}
          <div
            className={cn(
              'w-12 h-12 rounded-xl mb-4 flex items-center justify-center',
              config.bgClass
            )}
          >
            <Icon className={cn('w-6 h-6', config.iconClass)} />
          </div>

          {/* Title */}
          <AlertDialogPrimitive.Title className="text-lg font-semibold text-linear-text-primary mb-2">
            {title}
          </AlertDialogPrimitive.Title>

          {/* Description */}
          <AlertDialogPrimitive.Description className="text-sm text-linear-text-secondary leading-relaxed mb-6">
            {description}
          </AlertDialogPrimitive.Description>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary" onClick={onCancel}>
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button
                variant={severity === 'danger' ? 'danger' : 'primary'}
                onClick={onAction}
                loading={loading}
              >
                {actionLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

// ============================================================================
// Controlled version hook for easier usage
// ============================================================================

export interface UseConfirmDialogOptions {
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function useConfirmDialog({ onConfirm, onCancel }: UseConfirmDialogOptions) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleAction = React.useCallback(async () => {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [onConfirm]);

  const handleCancel = React.useCallback(() => {
    onCancel?.();
    setOpen(false);
  }, [onCancel]);

  return {
    open,
    setOpen,
    loading,
    handleAction,
    handleCancel,
  };
}
