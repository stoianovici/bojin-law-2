/**
 * useSwipeGesture Hook
 * OPS-298: Touch gesture support for mobile drawer
 *
 * Detects horizontal swipe gestures for mobile navigation.
 * Supports edge detection for "swipe from edge to open" patterns.
 */

import { useRef, useCallback, useEffect } from 'react';

export type SwipeDirection = 'left' | 'right';

interface SwipeGestureOptions {
  /** Minimum distance (px) to qualify as a swipe */
  threshold?: number;
  /** Maximum vertical movement (px) before canceling horizontal swipe */
  verticalTolerance?: number;
  /** If true, only triggers when swipe starts from left edge (first 20px) */
  edgeOnly?: boolean;
  /** Edge width in pixels (default: 20) */
  edgeWidth?: number;
  /** Callback when swipe is detected */
  onSwipe?: (direction: SwipeDirection) => void;
  /** Callback for swipe left */
  onSwipeLeft?: () => void;
  /** Callback for swipe right */
  onSwipeRight?: () => void;
  /** Whether gesture detection is enabled */
  enabled?: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  startedFromEdge: boolean;
  isTracking: boolean;
}

export function useSwipeGesture(options: SwipeGestureOptions = {}) {
  const {
    threshold = 50,
    verticalTolerance = 100,
    edgeOnly = false,
    edgeWidth = 20,
    onSwipe,
    onSwipeLeft,
    onSwipeRight,
    enabled = true,
  } = options;

  const touchState = useRef<TouchState>({
    startX: 0,
    startY: 0,
    startedFromEdge: false,
    isTracking: false,
  });

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      const startedFromEdge = touch.clientX <= edgeWidth;

      // If edgeOnly mode, only track touches starting from edge
      if (edgeOnly && !startedFromEdge) {
        touchState.current.isTracking = false;
        return;
      }

      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startedFromEdge,
        isTracking: true,
      };
    },
    [enabled, edgeOnly, edgeWidth]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !touchState.current.isTracking) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchState.current.startX;
      const deltaY = touch.clientY - touchState.current.startY;

      // Reset tracking state
      touchState.current.isTracking = false;

      // Check if vertical movement exceeded tolerance (user is scrolling)
      if (Math.abs(deltaY) > verticalTolerance) {
        return;
      }

      // Check if horizontal movement exceeded threshold
      if (Math.abs(deltaX) < threshold) {
        return;
      }

      const direction: SwipeDirection = deltaX > 0 ? 'right' : 'left';

      // Call appropriate callbacks
      onSwipe?.(direction);
      if (direction === 'left') {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    },
    [enabled, threshold, verticalTolerance, onSwipe, onSwipeLeft, onSwipeRight]
  );

  // Bind handlers to a specific element
  const bindToElement = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;

      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchend', handleTouchEnd, { passive: true });

      return () => {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchend', handleTouchEnd);
      };
    },
    [handleTouchStart, handleTouchEnd]
  );

  // Return handlers for manual attachment or ref-based binding
  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
    },
    bindToElement,
  };
}

/**
 * useEdgeSwipe Hook
 * Convenience hook for detecting swipes from the left edge of the screen.
 * Typically used to open a drawer/menu.
 */
export function useEdgeSwipe(onSwipeFromEdge: () => void, enabled = true) {
  const { bindToElement } = useSwipeGesture({
    edgeOnly: true,
    onSwipeRight: onSwipeFromEdge,
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;

    // Bind to document body for edge detection
    const cleanup = bindToElement(document.body);
    return cleanup;
  }, [bindToElement, enabled]);
}
