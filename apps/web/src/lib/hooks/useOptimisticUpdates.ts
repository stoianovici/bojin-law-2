// useOptimisticUpdates Hook
// Provides optimistic UI updates for better user experience

import { useState, useCallback } from 'react';

export interface OptimisticUpdateOptions<T> {
  /**
   * The actual update function that performs the operation
   */
  updateFn: (data: T) => Promise<any>;

  /**
   * Callback to revert optimistic changes on failure
   */
  onRevert?: (originalData: T) => void;

  /**
   * Callback for successful updates
   */
  onSuccess?: (result: any) => void;

  /**
   * Callback for update failures
   */
  onError?: (error: any) => void;
}

export interface OptimisticUpdateResult<T> {
  /**
   * Perform an optimistic update
   */
  update: (newData: T, originalData: T) => Promise<void>;

  /**
   * Whether an update is currently in progress
   */
  isUpdating: boolean;

  /**
   * Last error that occurred
   */
  error: any;
}

/**
 * Hook for implementing optimistic UI updates
 * Temporarily shows updated state while waiting for server confirmation
 */
export function useOptimisticUpdate<T>({
  updateFn,
  onRevert,
  onSuccess,
  onError,
}: OptimisticUpdateOptions<T>): OptimisticUpdateResult<T> {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<any>(null);

  const update = useCallback(
    async (newData: T, originalData: T) => {
      setIsUpdating(true);
      setError(null);

      try {
        // Perform the actual update
        const result = await updateFn(newData);

        // Update successful
        onSuccess?.(result);
      } catch (err) {
        // Update failed - revert optimistic changes
        onRevert?.(originalData);
        setError(err);
        onError?.(err);
      } finally {
        setIsUpdating(false);
      }
    },
    [updateFn, onRevert, onSuccess, onError]
  );

  return {
    update,
    isUpdating,
    error,
  };
}

// Convenience hook for common optimistic operations
export function useOptimisticTaskUpdate() {
  return useOptimisticUpdate({
    updateFn: async (taskData: any) => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Task updated:', taskData);
      return { success: true };
    },
    onSuccess: () => {
      console.log('Task update successful');
    },
    onError: (error) => {
      console.error('Task update failed:', error);
    },
  });
}

export function useOptimisticDocumentUpdate() {
  return useOptimisticUpdate({
    updateFn: async (documentData: any) => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));
      console.log('Document updated:', documentData);
      return { success: true };
    },
    onSuccess: () => {
      console.log('Document update successful');
    },
    onError: (error) => {
      console.error('Document update failed:', error);
    },
  });
}
