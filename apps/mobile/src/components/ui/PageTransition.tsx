'use client';

import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// Types
// ============================================

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

interface ListItemTransitionProps {
  children: ReactNode;
  index?: number;
  className?: string;
}

// ============================================
// Page Transition
// ============================================

const pageVariants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
    },
  },
};

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// List Item Animation
// ============================================

const listItemVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      delay: index * 0.03,
      ease: [0.25, 0.1, 0.25, 1],
    },
  }),
};

export function ListItemTransition({ children, index = 0, className }: ListItemTransitionProps) {
  return (
    <motion.div
      variants={listItemVariants}
      initial="initial"
      animate="animate"
      custom={index}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Fade In Animation
// ============================================

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, className }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Slide Up Animation (for modals, sheets)
// ============================================

interface SlideUpProps {
  children: ReactNode;
  isVisible: boolean;
  className?: string;
}

export function SlideUp({ children, isVisible, className }: SlideUpProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Scale Tap Animation (for buttons)
// ============================================

interface ScaleTapProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function ScaleTap({ children, className, onClick }: ScaleTapProps) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1 }}
      className={className}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
