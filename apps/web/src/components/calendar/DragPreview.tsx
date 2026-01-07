'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DragPreviewProps {
  /** Whether drag preview should be visible */
  isVisible: boolean;
  /** Task title */
  title: string;
  /** Remaining duration in hours */
  duration?: number;
  /** Position to render at */
  position: { x: number; y: number } | null;
  /** Whether drop target is valid */
  isValidDropTarget?: boolean;
  /** Drop target time string for preview */
  dropTimePreview?: string;
}

const HOUR_HEIGHT = 60;

/**
 * DragPreview - A floating preview of the task being dragged
 *
 * Shows at the cursor position during drag operations with:
 * - Task title
 * - Estimated height based on duration
 * - Visual feedback for valid/invalid drop targets
 */
export function DragPreview({
  isVisible,
  title,
  duration = 1,
  position,
  isValidDropTarget = true,
  dropTimePreview,
}: DragPreviewProps) {
  if (!position) return null;

  const height = Math.max(duration * HOUR_HEIGHT, 24);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed pointer-events-none z-[1000]"
          style={{
            left: position.x - 100, // Center on cursor
            top: position.y - 12, // Offset slightly above cursor
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
        >
          {/* Preview card */}
          <div
            className={cn(
              'w-[200px] rounded-linear-sm border-l-[3px] p-2',
              'bg-linear-bg-secondary/95 backdrop-blur-sm',
              'shadow-linear-lg',
              isValidDropTarget
                ? 'border-l-[#8B5CF6] border border-[#8B5CF6]/30'
                : 'border-l-[#EF4444] border border-[#EF4444]/30'
            )}
            style={{ minHeight: `${height}px` }}
          >
            {/* Task title */}
            <div className="truncate text-xs font-light text-linear-text-primary mb-1">{title}</div>

            {/* Time preview */}
            {dropTimePreview && (
              <div
                className={cn(
                  'text-[10px] font-medium',
                  isValidDropTarget ? 'text-[#8B5CF6]' : 'text-[#EF4444]'
                )}
              >
                {isValidDropTarget ? `→ ${dropTimePreview}` : 'Slot ocupat'}
              </div>
            )}
          </div>

          {/* Invalid drop indicator */}
          {!isValidDropTarget && (
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 bg-[#EF4444] rounded-full flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              <span className="text-white text-[10px] font-bold">×</span>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
