'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

// ============================================================================
// AnimatedList - Container for animated list items
// ============================================================================

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper for lists with animated items. Use with AnimatedListItem.
 * Uses popLayout mode for smooth exit animations.
 */
export function AnimatedList({ children, className }: AnimatedListProps) {
  return (
    <AnimatePresence mode="popLayout">
      <div className={className}>{children}</div>
    </AnimatePresence>
  );
}

// ============================================================================
// AnimatedListItem - Individual animated list item
// ============================================================================

interface AnimatedListItemProps {
  children: ReactNode;
  className?: string;
  /** Unique ID for layout animations (reordering) */
  layoutId?: string;
}

/**
 * Animated list item with enter/exit/layout transitions.
 * - Enter: fade in + slide up
 * - Exit: fade out + scale down
 * - Layout: smooth reordering
 */
export function AnimatedListItem({ children, className, layoutId }: AnimatedListItemProps) {
  return (
    <motion.div
      layout
      layoutId={layoutId}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
