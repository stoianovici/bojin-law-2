'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

// ============================================================================
// AnimatedPanel - Slide-in/out panel with direction control
// ============================================================================

interface AnimatedPanelProps {
  /** Controls visibility */
  isOpen: boolean;
  children: ReactNode;
  /** Direction panel slides from */
  direction?: 'left' | 'right' | 'up' | 'down';
  className?: string;
}

const offsets = {
  left: { x: -20, y: 0 },
  right: { x: 20, y: 0 },
  up: { x: 0, y: -20 },
  down: { x: 0, y: 20 },
};

/**
 * Animated panel that slides in/out from a direction.
 * Useful for side panels, dropdown menus, and modals.
 */
export function AnimatedPanel({
  isOpen,
  children,
  direction = 'right',
  className,
}: AnimatedPanelProps) {
  const offset = offsets[direction];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, ...offset }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, ...offset }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
