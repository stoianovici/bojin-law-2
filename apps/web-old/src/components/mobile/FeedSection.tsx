/**
 * FeedSection Component
 * OPS-302: Collapsible section for grouped brief feed
 *
 * Displays a collapsible section with:
 * - Header with title and count badge
 * - Chevron icon that rotates on toggle
 * - Smooth height animation using Framer Motion
 * - Persisted collapse state in localStorage
 */

'use client';

import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { usePersistedState } from '../../hooks/usePersistedState';

// ============================================================================
// Types
// ============================================================================

interface FeedSectionProps {
  /** Unique key for localStorage persistence */
  sectionKey: string;
  /** Section title (Romanian) */
  title: string;
  /** Item count for badge */
  count: number;
  /** Initial expand state (used if no localStorage value) */
  defaultExpanded: boolean;
  /** Content to render when expanded (BriefCards) */
  children: ReactNode;
  /** Optional className for the container */
  className?: string;
}

// ============================================================================
// Animation Variants
// ============================================================================

const contentVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: 'easeInOut' as const },
      opacity: { duration: 0.15, ease: 'easeInOut' as const },
    },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.2, ease: 'easeInOut' as const },
      opacity: { duration: 0.2, delay: 0.05, ease: 'easeInOut' as const },
    },
  },
};

// ============================================================================
// Component
// ============================================================================

export function FeedSection({
  sectionKey,
  title,
  count,
  defaultExpanded,
  children,
  className,
}: FeedSectionProps) {
  const [isExpanded, setIsExpanded] = usePersistedState(
    `feed-section-${sectionKey}`,
    defaultExpanded
  );

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={clsx('border-b border-linear-border-subtle', className)}>
      {/* Header button */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-linear-bg-hover active:bg-linear-bg-tertiary transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`feed-section-content-${sectionKey}`}
      >
        <div className="flex items-center gap-2">
          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
          >
            <ChevronRight className="w-4 h-4 text-linear-text-tertiary" />
          </motion.span>
          <span className="font-medium text-linear-text-primary">{title}</span>
        </div>
        <span className="text-sm text-linear-text-secondary bg-linear-bg-tertiary px-2 py-0.5 rounded-full min-w-[1.5rem] text-center">
          {count}
        </span>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={`feed-section-content-${sectionKey}`}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={contentVariants}
            className="overflow-hidden"
          >
            <div className="pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
