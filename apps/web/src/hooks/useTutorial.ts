'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { useTutorialStore } from '@/store/tutorialStore';
import { GET_USER_PREFERENCES } from '@/graphql/queries';
import { UPDATE_USER_PREFERENCES } from '@/graphql/mutations';

interface UserPreferences {
  theme: string;
  emailSignature: string | null;
  tutorialCompleted: boolean;
  tutorialStep: number;
}

interface GetUserPreferencesResponse {
  userPreferences: UserPreferences;
}

/**
 * Hook to sync tutorial state between Zustand store and backend.
 *
 * - On mount: Loads tutorial state from backend preferences
 * - On completion: Saves tutorialCompleted=true to backend
 * - Auto-starts tutorial for first-time users
 */
export function useTutorial() {
  const {
    step,
    isActive,
    isCompleted,
    startTutorial,
    setStep,
    completeTutorial: storeCompleteTutorial,
  } = useTutorialStore();

  const hasInitialized = useRef(false);
  const prevCompletedRef = useRef(isCompleted);

  // Query user preferences
  const { data, loading } = useQuery<GetUserPreferencesResponse>(GET_USER_PREFERENCES, {
    fetchPolicy: 'cache-and-network',
  });

  // Mutation to update preferences
  const [updatePreferences] = useMutation(UPDATE_USER_PREFERENCES);

  // Initialize from backend on first load
  useEffect(() => {
    if (loading || hasInitialized.current || !data?.userPreferences) return;

    const { tutorialCompleted, tutorialStep } = data.userPreferences;
    hasInitialized.current = true;

    // If local store is already active or completed, don't override
    if (isActive || isCompleted) {
      return;
    }

    // If tutorial was completed before, mark as completed in store
    if (tutorialCompleted) {
      storeCompleteTutorial();
      return;
    }

    // DISABLED: Tutorial auto-start disabled while feature is in development
    // To re-enable, uncomment the startTutorial() calls below
    // If tutorial was in progress, restore step
    if (tutorialStep > 0) {
      setStep(tutorialStep);
      // Auto-start if there was progress
      // startTutorial();
    } else {
      // First time user - auto-start tutorial
      // startTutorial();
    }
  }, [loading, data, isActive, startTutorial, setStep, storeCompleteTutorial]);

  // Sync completion to backend when tutorial is completed
  useEffect(() => {
    // Only sync when transitioning from not-completed to completed
    if (isCompleted && !prevCompletedRef.current && hasInitialized.current) {
      updatePreferences({
        variables: {
          input: {
            tutorialCompleted: true,
            tutorialStep: step,
          },
        },
      }).catch((error: Error) => {
        console.error('[useTutorial] Failed to save completion state:', error);
      });
    }
    prevCompletedRef.current = isCompleted;
  }, [isCompleted, step, updatePreferences]);

  // Debounced step sync (optional - can be removed if not needed)
  // This syncs the step progress periodically
  const syncStep = useCallback(() => {
    if (!isActive || isCompleted || !hasInitialized.current) return;

    updatePreferences({
      variables: {
        input: {
          tutorialStep: step,
        },
      },
    }).catch((error: Error) => {
      console.error('[useTutorial] Failed to sync step:', error);
    });
  }, [isActive, isCompleted, step, updatePreferences]);

  return {
    isLoading: loading,
    isActive,
    step,
    isCompleted,
    syncStep,
  };
}
