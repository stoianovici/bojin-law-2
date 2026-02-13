'use client';

/**
 * useImagePreload Hook
 *
 * Preloads an image and tracks loading state.
 * Returns 'loading', 'loaded', or 'error' state for graceful fallbacks.
 */

import { useState, useEffect } from 'react';

export type ImageLoadState = 'loading' | 'loaded' | 'error';

export function useImagePreload(src: string | undefined): ImageLoadState {
  const [state, setState] = useState<ImageLoadState>('loading');

  useEffect(() => {
    if (!src) {
      setState('error');
      return;
    }

    // Reset state when src changes
    setState('loading');

    const img = new Image();
    img.src = src;

    const handleLoad = () => setState('loaded');
    const handleError = () => setState('error');

    img.onload = handleLoad;
    img.onerror = handleError;

    // If image is already cached, onload fires synchronously
    if (img.complete) {
      setState('loaded');
    }

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return state;
}

// Priority-based fallback gradients
export const PRIORITY_GRADIENTS = {
  featured: 'bg-gradient-to-br from-accent/20 via-bg-card to-bg-card',
  secondary: 'bg-gradient-to-br from-bg-elevated via-bg-card to-bg-card',
} as const;
