'use client';

import { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Height: 'auto' | 'full' | number (percentage) */
  height?: 'auto' | 'full' | number;
  /** Show drag handle */
  showHandle?: boolean;
  /** Close on backdrop click */
  closeOnBackdrop?: boolean;
  /** Close on swipe down */
  closeOnSwipe?: boolean;
}

// ============================================
// Component
// ============================================

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  height = 'auto',
  showHandle = true,
  closeOnBackdrop = true,
  closeOnSwipe = true,
}: BottomSheetProps) {
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (!closeOnSwipe) return;

      // Close if dragged down more than 100px or with velocity
      if (info.offset.y > 100 || info.velocity.y > 500) {
        onClose();
      }
    },
    [closeOnSwipe, onClose]
  );

  const getHeightStyle = () => {
    if (height === 'auto') return 'auto';
    if (height === 'full') return '90vh';
    return `${height}vh`;
  };

  // Only render on client
  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            drag={closeOnSwipe ? 'y' : false}
            dragControls={dragControls}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            className={clsx(
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-bg-elevated rounded-t-2xl',
              'shadow-xl',
              'flex flex-col',
              'max-h-[90vh]'
            )}
            style={{
              height: getHeightStyle(),
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'sheet-title' : undefined}
          >
            {/* Handle */}
            {showHandle && (
              <div
                className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-10 h-1 rounded-full bg-text-tertiary/50" />
              </div>
            )}

            {/* Title */}
            {title && (
              <div className="px-6 pb-3 border-b border-border">
                <h2
                  id="sheet-title"
                  className="text-lg font-semibold text-text-primary text-center"
                >
                  {title}
                </h2>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ============================================
// BottomSheet Actions
// ============================================

interface BottomSheetActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function BottomSheetActions({ children, className }: BottomSheetActionsProps) {
  return (
    <div className={clsx('flex flex-col gap-2 p-6 pt-4', 'border-t border-border', className)}>
      {children}
    </div>
  );
}

// ============================================
// BottomSheet Content
// ============================================

export function BottomSheetContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={clsx('px-6 py-4', className)}>{children}</div>;
}
