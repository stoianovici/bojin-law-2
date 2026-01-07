'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

// ============================================================================
// StaggerChildren - Container for staggered entrance animations
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  /** Delay between each child animation (default: 0.05s) */
  staggerDelay?: number;
}

/**
 * Container that staggers the entrance of child StaggerItem components.
 * Great for lists, grids, and cards that load sequentially.
 */
export function StaggerChildren({
  children,
  className,
  staggerDelay = 0.05,
}: StaggerContainerProps) {
  const variants =
    staggerDelay === 0.05
      ? containerVariants
      : {
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: { staggerChildren: staggerDelay },
          },
        };

  return (
    <motion.div variants={variants} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

// ============================================================================
// StaggerItem - Individual staggered item
// ============================================================================

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

/**
 * Item that animates in sequence with other StaggerItems.
 * Must be a direct child of StaggerChildren.
 */
export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}
