/**
 * usePersistedState Hook
 * OPS-302: FeedSection Component
 *
 * A useState variant that persists to localStorage.
 * Handles SSR by falling back to defaultValue during server render.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type SetValue<T> = T | ((prevValue: T) => T);

// ============================================================================
// Hook
// ============================================================================

/**
 * useState with localStorage persistence.
 *
 * @param key - localStorage key
 * @param defaultValue - fallback value if key doesn't exist
 * @returns [value, setValue] tuple like useState
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: SetValue<T>) => void] {
  // Use a lazy initializer to read from localStorage only once
  const [value, setValue] = useState<T>(() => {
    // Check if we're on the server (SSR)
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // Invalid JSON or localStorage error - use default
      console.warn(`usePersistedState: Failed to parse key "${key}"`);
    }

    return defaultValue;
  });

  // Update localStorage when value changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      console.warn(`usePersistedState: Failed to save key "${key}"`);
    }
  }, [key, value]);

  // Wrapper to handle functional updates
  const setPersistedValue = useCallback((newValue: SetValue<T>) => {
    setValue((prev) => {
      const resolved =
        typeof newValue === 'function' ? (newValue as (prevValue: T) => T)(prev) : newValue;
      return resolved;
    });
  }, []);

  return [value, setPersistedValue];
}
