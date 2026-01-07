'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DropZoneIndicatorProps {
  /** Whether the indicator should be visible */
  isVisible: boolean;
  /** Top position in pixels relative to time grid */
  top: number;
  /** Height in pixels based on task duration */
  height: number;
  /** Whether this is a valid drop zone (no collision) */
  isValid: boolean;
  /** Time string to display */
  timeLabel?: string;
}

/**
 * DropZoneIndicator - Visual indicator for where a task will be placed
 *
 * Shows a highlighted area in the time grid during drag operations.
 * Changes color based on whether the drop is valid (no collision).
 */
export function DropZoneIndicator({
  isVisible,
  top,
  height,
  isValid,
  timeLabel,
}: DropZoneIndicatorProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={cn(
            'absolute left-0.5 right-0.5 rounded-linear-sm border-2 border-dashed',
            'pointer-events-none',
            isValid
              ? 'bg-[rgba(139,92,246,0.1)] border-[#8B5CF6]'
              : 'bg-[rgba(239,68,68,0.1)] border-[#EF4444]'
          )}
          style={{
            top: `${top}px`,
            height: `${height}px`,
            minHeight: '24px',
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          {/* Time label */}
          {timeLabel && (
            <div
              className={cn(
                'absolute top-1 left-2 text-[10px] font-medium',
                isValid ? 'text-[#8B5CF6]' : 'text-[#EF4444]'
              )}
            >
              {timeLabel}
            </div>
          )}

          {/* Collision warning */}
          {!isValid && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="text-[#EF4444] text-xs font-medium bg-linear-bg-primary/80 px-2 py-1 rounded">
                Slot ocupat
              </span>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
