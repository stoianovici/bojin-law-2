/**
 * AssistantSheet Component
 * OPS-300: AssistantSheet Component
 *
 * Mobile-optimized bottom sheet for the AI assistant.
 * Slides up from the bottom covering ~60% of the viewport.
 * Features:
 * - Tap backdrop to dismiss
 * - Drag handle for swipe-to-dismiss
 * - Spring animation for open/close
 * - Reuses existing AssistantChat component
 */

'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { useAssistantStore } from '../../stores/assistant.store';
import { useIsMobile } from '../../hooks/useIsMobile';
import { AssistantChat } from '../assistant/AssistantChat';

// ============================================================================
// Constants
// ============================================================================

const SHEET_HEIGHT = '60vh';
const DRAG_CLOSE_THRESHOLD = 100; // pixels to drag down before closing

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Drag handle indicator at top of sheet
 */
function DragHandle() {
  return (
    <div className="flex justify-center pt-3 pb-1">
      <div className="w-10 h-1 rounded-full bg-linear-border-default" aria-hidden="true" />
    </div>
  );
}

/**
 * Sheet header with title and close button
 */
interface SheetHeaderProps {
  onClose: () => void;
}

function SheetHeader({ onClose }: SheetHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 pb-2 border-b border-linear-border-subtle">
      <h2 className="text-base font-semibold text-linear-text-primary">Asistent AI</h2>
      <button
        onClick={onClose}
        className="w-11 h-11 -mr-2 rounded-lg flex items-center justify-center hover:bg-linear-bg-hover active:bg-linear-bg-tertiary active:scale-95 transition-all"
        aria-label="Închide asistent"
      >
        <X className="w-5 h-5 text-linear-text-tertiary" />
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AssistantSheet() {
  const { isOpen, toggleOpen } = useAssistantStore();
  const isMobile = useIsMobile();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll when sheet is open (only on mobile)
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isOpen]);

  // Handle drag end - close if dragged down far enough
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > DRAG_CLOSE_THRESHOLD) {
        toggleOpen();
      }
    },
    [toggleOpen]
  );

  // Close on backdrop click
  const handleBackdropClick = useCallback(() => {
    toggleOpen();
  }, [toggleOpen]);

  // Don't render on desktop
  if (!isMobile) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={handleBackdropClick}
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
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            className="fixed bottom-0 left-0 right-0 z-50 bg-linear-bg-secondary rounded-t-2xl shadow-2xl flex flex-col overflow-hidden border-t border-linear-border-subtle"
            style={{ height: SHEET_HEIGHT }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-sheet-title"
          >
            <DragHandle />
            <SheetHeader onClose={toggleOpen} />

            {/* Chat content - flex-1 to fill remaining space */}
            <div className="flex-1 overflow-hidden">
              <AssistantChat />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

AssistantSheet.displayName = 'AssistantSheet';
