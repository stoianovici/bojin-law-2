/**
 * usePullToRefresh Hook
 * OPS-298: Pull-to-refresh support for mobile feeds
 *
 * Detects pull-down gesture at top of scroll container and triggers refresh.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing';

interface PullToRefreshOptions {
  /** Callback when refresh is triggered */
  onRefresh: () => Promise<void> | void;
  /** Pull distance required to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance (default: 120) */
  maxPull?: number;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
}

interface PullToRefreshState {
  /** Current pull state */
  state: PullState;
  /** Current pull distance in pixels */
  pullDistance: number;
  /** Progress towards threshold (0-1) */
  progress: number;
}

interface PullToRefreshReturn extends PullToRefreshState {
  /** Ref to attach to the scroll container */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Props to spread on the scroll container */
  containerProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
}

export function usePullToRefresh(options: PullToRefreshOptions): PullToRefreshReturn {
  const { onRefresh, threshold = 80, maxPull = 120, enabled = true } = options;

  const [state, setState] = useState<PullState>('idle');
  const [pullDistance, setPullDistance] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isPulling = useRef<boolean>(false);

  const progress = Math.min(pullDistance / threshold, 1);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || state === 'refreshing') return;

      const container = containerRef.current;
      if (!container) return;

      // Only start pull if at top of scroll container
      if (container.scrollTop > 0) return;

      startY.current = e.touches[0].clientY;
      currentY.current = startY.current;
      isPulling.current = true;
    },
    [enabled, state]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !isPulling.current || state === 'refreshing') return;

      const container = containerRef.current;
      if (!container) return;

      // If scrolled down, cancel pull
      if (container.scrollTop > 0) {
        isPulling.current = false;
        setPullDistance(0);
        setState('idle');
        return;
      }

      currentY.current = e.touches[0].clientY;
      const deltaY = currentY.current - startY.current;

      // Only track downward pulls
      if (deltaY <= 0) {
        setPullDistance(0);
        setState('idle');
        return;
      }

      // Apply resistance - pull feels "heavier" as you pull further
      const resistance = 0.5;
      const adjustedDistance = Math.min(deltaY * resistance, maxPull);

      setPullDistance(adjustedDistance);
      setState(adjustedDistance >= threshold ? 'ready' : 'pulling');

      // Prevent default scroll when pulling
      if (adjustedDistance > 0) {
        e.preventDefault();
      }
    },
    [enabled, state, threshold, maxPull]
  );

  const handleTouchEnd = useCallback(
    async (_e: React.TouchEvent) => {
      if (!enabled || !isPulling.current) return;

      isPulling.current = false;

      if (state === 'ready') {
        setState('refreshing');
        // Keep showing indicator while refreshing
        setPullDistance(threshold);

        try {
          await onRefresh();
        } finally {
          setState('idle');
          setPullDistance(0);
        }
      } else {
        setState('idle');
        setPullDistance(0);
      }
    },
    [enabled, state, threshold, onRefresh]
  );

  // Reset state when disabled
  useEffect(() => {
    if (!enabled) {
      setState('idle');
      setPullDistance(0);
      isPulling.current = false;
    }
  }, [enabled]);

  return {
    state,
    pullDistance,
    progress,
    containerRef,
    containerProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
