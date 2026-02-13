'use client';

/**
 * usePageFlip Hook
 *
 * Manages vertical page-flip navigation for the Flipboard-style briefing.
 * Uses framer-motion drag gestures with spring animations.
 *
 * Features:
 * - Swipe up → next page
 * - Swipe down → previous page
 * - Velocity-based flipping (fast swipes trigger flip even with small offset)
 * - Spring animation for natural feel
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useMotionValue, useTransform, PanInfo, MotionValue } from 'framer-motion';

// ============================================
// Constants
// ============================================

// Drag thresholds
const DRAG_THRESHOLD = 100; // pixels needed to trigger page change
const VELOCITY_THRESHOLD = 500; // px/s velocity to trigger page change

// Spring animation config (matches BottomSheet.tsx)
export const SPRING_CONFIG = {
  type: 'spring' as const,
  damping: 30,
  stiffness: 300,
};

// ============================================
// Types
// ============================================

export interface UsePageFlipOptions {
  totalPages: number;
  onPageChange?: (page: number) => void;
  /** Session storage key for persisting page position */
  persistKey?: string;
}

export interface UsePageFlipReturn {
  /** Current page index (0-based) */
  currentPage: number;
  /** Motion value for y position (for drag tracking) */
  y: MotionValue<number>;
  /** Drag end handler for framer-motion */
  handleDragEnd: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  /** Spring animation configuration */
  springConfig: typeof SPRING_CONFIG;
  /** Navigate to specific page */
  goToPage: (page: number) => void;
  /** Navigate to next page */
  nextPage: () => void;
  /** Navigate to previous page */
  previousPage: () => void;
  /** Check if can go to next page */
  canGoNext: boolean;
  /** Check if can go to previous page */
  canGoPrevious: boolean;
  /** Opacity transform for current page (fades during drag) */
  pageOpacity: MotionValue<number>;
  /** Scale transform for current page (shrinks during drag) */
  pageScale: MotionValue<number>;
}

// ============================================
// Hook
// ============================================

// Helper to safely get/set sessionStorage
function getPersistedPage(key: string | undefined): number | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(key);
    if (stored !== null) {
      const page = parseInt(stored, 10);
      return isNaN(page) ? null : page;
    }
  } catch {
    // sessionStorage not available
  }
  return null;
}

function setPersistedPage(key: string | undefined, page: number): void {
  if (!key || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, String(page));
  } catch {
    // sessionStorage not available
  }
}

export function usePageFlip({
  totalPages,
  onPageChange,
  persistKey,
}: UsePageFlipOptions): UsePageFlipReturn {
  // Initialize from persisted value if available
  const [currentPage, setCurrentPage] = useState(() => {
    const persisted = getPersistedPage(persistKey);
    if (persisted !== null) {
      // Clamp to valid range
      return Math.max(0, Math.min(totalPages - 1, persisted));
    }
    return 0;
  });
  const y = useMotionValue(0);

  // Clamp currentPage when totalPages shrinks
  useEffect(() => {
    if (totalPages > 0 && currentPage >= totalPages) {
      const newPage = totalPages - 1;
      setCurrentPage(newPage);
      setPersistedPage(persistKey, newPage);
      onPageChange?.(newPage);
    }
  }, [totalPages, currentPage, persistKey, onPageChange]);

  // Derived computed values
  const canGoNext = currentPage < totalPages - 1;
  const canGoPrevious = currentPage > 0;

  // Transform y drag value to opacity (fade out during drag)
  const pageOpacity = useTransform(y, [-200, -50, 0, 50, 200], [0.5, 0.9, 1, 0.9, 0.5]);

  // Transform y drag value to scale (shrink during drag)
  const pageScale = useTransform(y, [-200, 0, 200], [0.95, 1, 0.95]);

  // Navigate to specific page
  const goToPage = useCallback(
    (page: number) => {
      const clampedPage = Math.max(0, Math.min(totalPages - 1, page));
      setCurrentPage(clampedPage);
      setPersistedPage(persistKey, clampedPage);
      onPageChange?.(clampedPage);
    },
    [totalPages, onPageChange, persistKey]
  );

  // Navigate to next page
  const nextPage = useCallback(() => {
    if (canGoNext) {
      goToPage(currentPage + 1);
    }
  }, [canGoNext, currentPage, goToPage]);

  // Navigate to previous page
  const previousPage = useCallback(() => {
    if (canGoPrevious) {
      goToPage(currentPage - 1);
    }
  }, [canGoPrevious, currentPage, goToPage]);

  // Handle drag end - determine if we should flip pages
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;

      // Check if swipe up (negative offset/velocity = upward)
      const swipedUp = offset.y < -DRAG_THRESHOLD || velocity.y < -VELOCITY_THRESHOLD;
      const swipedDown = offset.y > DRAG_THRESHOLD || velocity.y > VELOCITY_THRESHOLD;

      if (swipedUp && canGoNext) {
        // Swipe up → next page
        goToPage(currentPage + 1);
      } else if (swipedDown && canGoPrevious) {
        // Swipe down → previous page
        goToPage(currentPage - 1);
      }

      // Reset y position (will animate back)
      y.set(0);
    },
    [canGoNext, canGoPrevious, currentPage, goToPage, y]
  );

  return useMemo(
    () => ({
      currentPage,
      y,
      handleDragEnd,
      springConfig: SPRING_CONFIG,
      goToPage,
      nextPage,
      previousPage,
      canGoNext,
      canGoPrevious,
      pageOpacity,
      pageScale,
    }),
    [
      currentPage,
      y,
      handleDragEnd,
      goToPage,
      nextPage,
      previousPage,
      canGoNext,
      canGoPrevious,
      pageOpacity,
      pageScale,
    ]
  );
}
