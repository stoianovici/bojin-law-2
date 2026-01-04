'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-mobile-bg-overlay',
            'data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed bottom-0 left-0 right-0 z-[100]',
            'bg-mobile-bg-elevated rounded-t-[20px]',
            'data-[state=open]:animate-slideInUp data-[state=closed]:animate-slideOutDown',
            'focus:outline-none'
          )}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-9 h-1 bg-mobile-text-tertiary rounded-full" />
          </div>

          {/* Header */}
          {title && (
            <div className="px-4 pb-2">
              <DialogPrimitive.Title className="text-[11px] uppercase tracking-wider text-mobile-text-tertiary font-medium">
                {title}
              </DialogPrimitive.Title>
            </div>
          )}

          {/* Content */}
          <div className="px-4 pb-safe">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
