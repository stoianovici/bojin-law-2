'use client';

import { useState, useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

// ============================================
// Constants
// ============================================

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

// ============================================
// Component
// ============================================

export function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
  className,
}: PullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pullDistance = useMotionValue(0);

  const indicatorOpacity = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 1]);
  const indicatorScale = useTransform(pullDistance, [0, PULL_THRESHOLD], [0.5, 1]);
  const indicatorRotation = useTransform(pullDistance, [0, MAX_PULL], [0, 180]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || refreshing || startY.current === 0) return;

    const currentY = e.touches[0].clientY;
    const diff = Math.max(0, currentY - startY.current);
    const dampedDiff = Math.min(MAX_PULL, diff * 0.5);

    pullDistance.set(dampedDiff);
  };

  const handleTouchEnd = async () => {
    if (disabled || refreshing) return;

    const currentPull = pullDistance.get();

    if (currentPull >= PULL_THRESHOLD) {
      setRefreshing(true);
      pullDistance.set(60);

      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        pullDistance.set(0);
      }
    } else {
      pullDistance.set(0);
    }

    startY.current = 0;
  };

  return (
    <div
      ref={containerRef}
      className={clsx('relative overflow-auto', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10"
        style={{
          height: pullDistance,
          opacity: indicatorOpacity,
        }}
      >
        <motion.div
          className="w-8 h-8 flex items-center justify-center"
          style={{
            scale: indicatorScale,
            rotate: refreshing ? 0 : indicatorRotation,
          }}
        >
          {refreshing ? (
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
          ) : (
            <svg
              className="w-5 h-5 text-text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
        </motion.div>
      </motion.div>

      {/* Content */}
      <motion.div style={{ y: pullDistance }}>{children}</motion.div>
    </div>
  );
}
