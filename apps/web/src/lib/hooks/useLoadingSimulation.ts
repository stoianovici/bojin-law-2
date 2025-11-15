// useLoadingSimulation Hook
// Provides artificial loading delays for demo purposes

import { useState, useEffect } from 'react';

export interface UseLoadingSimulationOptions {
  /**
   * Minimum loading time in milliseconds
   */
  minDelay?: number;

  /**
   * Maximum loading time in milliseconds
   */
  maxDelay?: number;

  /**
   * Whether to enable loading simulation (useful for demo mode)
   */
  enabled?: boolean;
}

export interface UseLoadingSimulationReturn {
  /**
   * Whether currently loading
   */
  isLoading: boolean;

  /**
   * Start loading simulation
   */
  startLoading: () => void;

  /**
   * Stop loading simulation
   */
  stopLoading: () => void;

  /**
   * Simulate loading for a specific action
   */
  simulateLoading: <T>(action?: () => T | Promise<T>) => Promise<T | void>;
}

/**
 * Hook for simulating loading states in demo mode
 * Provides consistent artificial delays for better UX demonstration
 */
export function useLoadingSimulation({
  minDelay = 500,
  maxDelay = 1500,
  enabled = true,
}: UseLoadingSimulationOptions = {}): UseLoadingSimulationReturn {
  const [isLoading, setIsLoading] = useState(false);

  // Generate random delay between min and max
  const getRandomDelay = () => {
    return Math.random() * (maxDelay - minDelay) + minDelay;
  };

  const startLoading = () => {
    if (!enabled) return;
    setIsLoading(true);
  };

  const stopLoading = () => {
    setIsLoading(false);
  };

  const simulateLoading = async <T>(action?: () => T | Promise<T>): Promise<T | void> => {
    if (!enabled) {
      return action?.();
    }

    startLoading();

    try {
      // Wait for random delay
      await new Promise(resolve => setTimeout(resolve, getRandomDelay()));

      // Execute action if provided
      const result = action?.();
      if (result instanceof Promise) {
        return await result;
      }
      return result;
    } finally {
      stopLoading();
    }
  };

  return {
    isLoading,
    startLoading,
    stopLoading,
    simulateLoading,
  };
}

// Convenience hook for common loading scenarios
export function usePageLoading(options?: UseLoadingSimulationOptions) {
  return useLoadingSimulation({ minDelay: 800, maxDelay: 1200, ...options });
}

export function useActionLoading(options?: UseLoadingSimulationOptions) {
  return useLoadingSimulation({ minDelay: 300, maxDelay: 800, ...options });
}

export function useDataLoading(options?: UseLoadingSimulationOptions) {
  return useLoadingSimulation({ minDelay: 500, maxDelay: 1000, ...options });
}