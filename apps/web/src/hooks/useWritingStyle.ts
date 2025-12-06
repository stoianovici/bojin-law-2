/**
 * Writing Style React Hooks
 * Story 5.6: AI Learning and Personalization (Task 22)
 * Hooks for managing user's learned writing style profile
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import type { WritingStyleProfile } from '@legal-platform/types';

// ====================
// GraphQL Fragments
// ====================

const WRITING_STYLE_PROFILE_FRAGMENT = gql`
  fragment WritingStyleProfileFields on WritingStyleProfile {
    id
    firmId
    userId
    formalityLevel
    averageSentenceLength
    vocabularyComplexity
    preferredTone
    commonPhrases {
      phrase
      frequency
      context
    }
    punctuationStyle {
      useOxfordComma
      preferSemicolons
      useDashes
      colonBeforeLists
    }
    languagePatterns {
      primaryLanguage
      formalityByLanguage
      preferredGreetingsByLanguage
      legalTermsPreference
    }
    sampleCount
    lastAnalyzedAt
    createdAt
    updatedAt
  }
`;

// ====================
// Queries
// ====================

const GET_MY_WRITING_STYLE_PROFILE = gql`
  ${WRITING_STYLE_PROFILE_FRAGMENT}
  query GetMyWritingStyleProfile {
    myWritingStyleProfile {
      ...WritingStyleProfileFields
    }
  }
`;

// ====================
// Mutations
// ====================

const ANALYZE_WRITING_STYLE = gql`
  ${WRITING_STYLE_PROFILE_FRAGMENT}
  mutation AnalyzeWritingStyle {
    analyzeWritingStyle {
      ...WritingStyleProfileFields
    }
  }
`;

const RESET_WRITING_STYLE_PROFILE = gql`
  mutation ResetWritingStyleProfile {
    resetWritingStyleProfile
  }
`;

const RECORD_DRAFT_EDIT = gql`
  mutation RecordDraftEdit($input: RecordEditInput!) {
    recordDraftEdit(input: $input)
  }
`;

// ====================
// Types
// ====================

export interface RecordEditInput {
  draftId: string;
  originalText: string;
  editedText: string;
  editLocation: 'greeting' | 'body' | 'closing' | 'full' | 'subject';
}

export interface WritingStyleSummary {
  formalityLevel: number;
  preferredTone: string;
  sampleCount: number;
  topPhrases: string[];
  isLearning: boolean;
  learningProgress: number; // 0-100
}

// ====================
// Hooks
// ====================

/**
 * Hook to get the current user's writing style profile
 * Uses cache-first strategy with session-level caching
 */
export function useWritingStyleProfile() {
  const { data, loading, error, refetch } = useQuery<{
    myWritingStyleProfile: WritingStyleProfile | null;
  }>(GET_MY_WRITING_STYLE_PROFILE, {
    fetchPolicy: 'cache-first',
    // Don't poll - style updates are infrequent
    notifyOnNetworkStatusChange: true,
  });

  const profile = data?.myWritingStyleProfile ?? null;

  // Calculate learning progress based on sample count
  // Target: 50 samples for "fully learned"
  const learningProgress = profile
    ? Math.min(100, Math.round((profile.sampleCount / 50) * 100))
    : 0;

  return {
    profile,
    loading,
    error,
    refetch,
    hasProfile: !!profile,
    learningProgress,
    isLearning: !!profile && profile.sampleCount < 50,
  };
}

/**
 * Hook to get a summarized view of writing style
 * Useful for dashboard displays
 */
export function useWritingStyleSummary(): {
  summary: WritingStyleSummary | null;
  loading: boolean;
  error: Error | undefined;
} {
  const { profile, loading, error, learningProgress, isLearning } =
    useWritingStyleProfile();

  if (!profile) {
    return { summary: null, loading, error: error as Error | undefined };
  }

  const summary: WritingStyleSummary = {
    formalityLevel: profile.formalityLevel,
    preferredTone: profile.preferredTone,
    sampleCount: profile.sampleCount,
    topPhrases: [...profile.commonPhrases]
      .sort((a: { phrase: string; frequency: number }, b: { phrase: string; frequency: number }) => b.frequency - a.frequency)
      .slice(0, 5)
      .map((p: { phrase: string; frequency: number }) => p.phrase),
    isLearning,
    learningProgress,
  };

  return { summary, loading, error: error as Error | undefined };
}

/**
 * Hook to trigger manual writing style analysis
 * Analyzes recent edits that haven't been processed
 */
export function useAnalyzeWritingStyle() {
  const [analyze, { loading, error }] = useMutation<{
    analyzeWritingStyle: WritingStyleProfile | null;
  }>(ANALYZE_WRITING_STYLE, {
    refetchQueries: ['GetMyWritingStyleProfile'],
  });

  const analyzeWritingStyle = async () => {
    const result = await analyze();
    return result.data?.analyzeWritingStyle ?? null;
  };

  return {
    analyzeWritingStyle,
    loading,
    error,
  };
}

/**
 * Hook to reset the user's writing style profile
 * Clears all learned data - use with confirmation
 */
export function useResetWritingStyle() {
  const [reset, { loading, error }] = useMutation<{
    resetWritingStyleProfile: boolean;
  }>(RESET_WRITING_STYLE_PROFILE, {
    refetchQueries: ['GetMyWritingStyleProfile'],
    // Optimistic update - immediately clear cache
    update: (cache: { writeQuery: (options: { query: unknown; data: unknown }) => void }) => {
      cache.writeQuery({
        query: GET_MY_WRITING_STYLE_PROFILE,
        data: { myWritingStyleProfile: null },
      });
    },
  });

  const resetWritingStyle = async () => {
    const result = await reset();
    return result.data?.resetWritingStyleProfile ?? false;
  };

  return {
    resetWritingStyle,
    loading,
    error,
  };
}

/**
 * Hook to record draft edits for style learning
 * Should be called when user modifies AI-generated drafts
 */
export function useRecordDraftEdit() {
  const [record, { loading, error }] = useMutation<
    { recordDraftEdit: boolean },
    { input: RecordEditInput }
  >(RECORD_DRAFT_EDIT);

  const recordDraftEdit = async (input: RecordEditInput) => {
    // Don't record if texts are identical
    if (input.originalText === input.editedText) {
      return true;
    }

    // Don't record very small changes (less than 10 chars difference)
    const lengthDiff = Math.abs(
      input.editedText.length - input.originalText.length
    );
    if (lengthDiff < 10 && input.editedText.length < 50) {
      return true;
    }

    try {
      const result = await record({ variables: { input } });
      return result.data?.recordDraftEdit ?? false;
    } catch {
      // Silently fail - recording is not critical
      console.debug('Failed to record draft edit');
      return false;
    }
  };

  return {
    recordDraftEdit,
    loading,
    error,
  };
}

/**
 * Combined hook for complete writing style management
 * Use in settings/personalization pages
 */
export function useWritingStyle() {
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    refetch,
    hasProfile,
    learningProgress,
    isLearning,
  } = useWritingStyleProfile();

  const {
    analyzeWritingStyle,
    loading: analyzing,
    error: analyzeError,
  } = useAnalyzeWritingStyle();

  const {
    resetWritingStyle,
    loading: resetting,
    error: resetError,
  } = useResetWritingStyle();

  const { recordDraftEdit, loading: recording } = useRecordDraftEdit();

  return {
    // Profile data
    profile,
    hasProfile,
    learningProgress,
    isLearning,

    // Loading states
    loading: profileLoading,
    analyzing,
    resetting,
    recording,

    // Errors
    error: profileError || analyzeError || resetError,

    // Actions
    analyzeWritingStyle,
    resetWritingStyle,
    recordDraftEdit,
    refetch,

    // Computed values
    formalityLabel: profile
      ? getFormalityLabel(profile.formalityLevel)
      : 'Unknown',
    complexityLabel: profile
      ? getComplexityLabel(profile.vocabularyComplexity)
      : 'Unknown',
  };
}

// ====================
// Helper Functions
// ====================

/**
 * Get human-readable label for formality level
 */
function getFormalityLabel(level: number): string {
  if (level < 0.25) return 'Casual';
  if (level < 0.5) return 'Semi-formal';
  if (level < 0.75) return 'Professional';
  return 'Highly Formal';
}

/**
 * Get human-readable label for vocabulary complexity
 */
function getComplexityLabel(level: number): string {
  if (level < 0.25) return 'Simple';
  if (level < 0.5) return 'Moderate';
  if (level < 0.75) return 'Complex';
  return 'Advanced';
}
