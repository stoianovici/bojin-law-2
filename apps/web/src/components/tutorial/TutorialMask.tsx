'use client';

import { useLayoutEffect, useState, useCallback, useRef, useEffect } from 'react';
import { useTutorialStore } from '@/store/tutorialStore';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function TutorialMask() {
  const { isActive, litRegions } = useTutorialStore();
  const [rects, setRects] = useState<Rect[]>([]);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const pendingRegionsRef = useRef<string[]>([]);

  // Measure element positions - only updates rects when elements are found
  const measureElements = useCallback((options?: { force?: boolean }) => {
    const regionsToFind = pendingRegionsRef.current.length > 0
      ? pendingRegionsRef.current
      : litRegions;

    const newRects: Rect[] = [];
    let allFound = true;

    for (const region of regionsToFind) {
      const el = document.querySelector(`[data-tutorial="${region}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Add padding
        newRects.push({
          x: rect.x - 8,
          y: rect.y - 8,
          width: rect.width + 16,
          height: rect.height + 16,
        });
      } else {
        allFound = false;
      }
    }

    // Only update rects if we found at least one element, or if forced
    // This preserves the previous position during transitions
    if (newRects.length > 0 || options?.force) {
      setRects(newRects);
      if (allFound) {
        pendingRegionsRef.current = [];
      }
    }

    return allFound;
  }, [litRegions]);

  // When litRegions change, track them as pending and start looking
  useEffect(() => {
    if (!isActive || litRegions.length === 0) return;

    // Mark these regions as pending (we want to find them)
    pendingRegionsRef.current = litRegions;

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    let retryCount = 0;
    const maxRetries = 20;
    const baseDelay = 50;

    const tryMeasure = () => {
      const allFound = measureElements();
      if (!allFound && retryCount < maxRetries) {
        retryCount++;
        const delay = baseDelay * Math.min(retryCount, 4); // Cap at 200ms
        retryTimeoutRef.current = setTimeout(tryMeasure, delay);
      }
    };

    // Initial measurement after a short delay for DOM to settle
    retryTimeoutRef.current = setTimeout(tryMeasure, 16);

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [isActive, litRegions, measureElements]);

  // MutationObserver to detect when elements appear
  useEffect(() => {
    if (!isActive || litRegions.length === 0) return;

    observerRef.current = new MutationObserver(() => {
      // Check if any of our pending target elements now exist
      const regionsToFind = pendingRegionsRef.current.length > 0
        ? pendingRegionsRef.current
        : litRegions;

      const hasNewElement = regionsToFind.some(
        (region) => document.querySelector(`[data-tutorial="${region}"]`) !== null
      );
      if (hasNewElement) {
        measureElements();
      }
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tutorial'],
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [isActive, litRegions, measureElements]);

  // Handle resize and scroll - always measure current litRegions
  useLayoutEffect(() => {
    if (!isActive) return;

    const handleResizeOrScroll = () => {
      // On resize/scroll, measure whatever elements are currently visible
      measureElements({ force: true });
    };

    measureElements();

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [isActive, measureElements]);

  if (!isActive) return null;

  // Build clip-path polygon
  // Full screen is the outer boundary, holes are the inner boundaries
  const clipPath = buildClipPath(rects);

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[9998] pointer-events-none"
      style={{
        clipPath,
        transition: 'clip-path 600ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    />
  );
}

function buildClipPath(rects: Rect[]): string {
  if (rects.length === 0) {
    // No holes - cover entire screen
    return 'polygon(0 0, 100% 0, 100% 100%, 0 100%)';
  }

  // For a single rect, create a polygon that covers everything EXCEPT the rect
  // This requires an "evenodd" approach with outer boundary + inner holes
  // We use path() instead since polygon doesn't support holes

  // Actually, let's use a simpler approach with CSS: use multiple overlapping polygons
  // Or we can use path() with evenodd fill-rule

  // Simplest approach: create a path with moveTo outer, then lineTo hole (reverse winding)
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;

  // Outer boundary (clockwise)
  let path = `M 0 0 L ${vw} 0 L ${vw} ${vh} L 0 ${vh} Z`;

  // Inner holes (counter-clockwise for evenodd)
  for (const r of rects) {
    const x1 = r.x;
    const y1 = r.y;
    const x2 = r.x + r.width;
    const y2 = r.y + r.height;
    // Counter-clockwise for hole
    path += ` M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2} L ${x2} ${y1} Z`;
  }

  return `path(evenodd, "${path}")`;
}
