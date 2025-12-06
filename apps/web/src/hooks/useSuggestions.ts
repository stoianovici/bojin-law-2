/**
 * AI Suggestions React Hooks
 * Story 5.4: Proactive AI Suggestions System (Task 23)
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import type {
  AISuggestion,
  SuggestionContext,
} from '@legal-platform/types';

// ====================
// GraphQL Fragments
// ====================

const AI_SUGGESTION_FRAGMENT = gql`
  fragment SuggestionFields on AISuggestion {
    id
    type
    category
    title
    description
    suggestedAction
    actionPayload
    confidence
    priority
    status
    case {
      id
      title
    }
    expiresAt
    createdAt
    updatedAt
  }
`;

// ====================
// Queries
// ====================

const GET_CONTEXTUAL_SUGGESTIONS = gql`
  ${AI_SUGGESTION_FRAGMENT}
  query GetContextualSuggestions($context: SuggestionContextInput!) {
    contextualSuggestions(context: $context) {
      ...SuggestionFields
    }
  }
`;

const GET_PENDING_SUGGESTIONS = gql`
  ${AI_SUGGESTION_FRAGMENT}
  query GetPendingSuggestions($limit: Int, $offset: Int) {
    pendingSuggestions(limit: $limit, offset: $offset) {
      ...SuggestionFields
    }
  }
`;

const GET_PATTERN_BASED_SUGGESTIONS = gql`
  ${AI_SUGGESTION_FRAGMENT}
  query GetPatternBasedSuggestions($limit: Int) {
    patternBasedSuggestions(limit: $limit) {
      ...SuggestionFields
    }
  }
`;

// ====================
// Mutations
// ====================

const ACCEPT_SUGGESTION = gql`
  ${AI_SUGGESTION_FRAGMENT}
  mutation AcceptSuggestion($suggestionId: ID!) {
    acceptSuggestion(suggestionId: $suggestionId) {
      ...SuggestionFields
    }
  }
`;

const DISMISS_SUGGESTION = gql`
  ${AI_SUGGESTION_FRAGMENT}
  mutation DismissSuggestion($suggestionId: ID!, $reason: String) {
    dismissSuggestion(suggestionId: $suggestionId, reason: $reason) {
      ...SuggestionFields
    }
  }
`;

const REFRESH_SUGGESTIONS = gql`
  ${AI_SUGGESTION_FRAGMENT}
  mutation RefreshSuggestions($context: SuggestionContextInput!) {
    refreshSuggestions(context: $context) {
      ...SuggestionFields
    }
  }
`;

const RECORD_FEEDBACK = gql`
  mutation RecordSuggestionFeedback($input: SuggestionFeedbackInput!) {
    recordSuggestionFeedback(input: $input) {
      success
      suggestionId
      newStatus
    }
  }
`;

const RECORD_USER_ACTION = gql`
  mutation RecordUserAction($type: String!, $context: JSON) {
    recordUserAction(type: $type, context: $context)
  }
`;

// ====================
// Types
// ====================

export interface SuggestionContextInput {
  currentScreen?: string;
  currentCaseId?: string;
  currentDocumentId?: string;
  recentActions?: Array<{
    type: string;
    timestamp?: string;
    context?: Record<string, unknown>;
  }>;
}

export interface SuggestionFeedbackInput {
  suggestionId: string;
  action: 'accepted' | 'dismissed' | 'modified' | 'ignored';
  modifiedAction?: Record<string, unknown>;
  feedbackReason?: string;
  responseTimeMs?: number;
}

// ====================
// Hooks
// ====================

/**
 * Hook to get contextual suggestions based on current user context
 * Uses 30-second polling for real-time updates
 */
export function useContextualSuggestions(context: SuggestionContextInput) {
  const { data, loading, error, refetch } = useQuery<{
    contextualSuggestions: AISuggestion[];
  }>(GET_CONTEXTUAL_SUGGESTIONS, {
    variables: { context },
    fetchPolicy: 'cache-and-network',
    pollInterval: 30 * 1000, // 30 seconds
    skip: !context,
  });

  return {
    suggestions: data?.contextualSuggestions ?? [],
    loading,
    error,
    refetch,
    count: data?.contextualSuggestions?.length ?? 0,
  };
}

/**
 * Hook to get all pending suggestions for the current user
 * Supports pagination
 */
export function usePendingSuggestions(limit = 10, offset = 0) {
  const { data, loading, error, refetch, fetchMore } = useQuery<{
    pendingSuggestions: AISuggestion[];
  }>(GET_PENDING_SUGGESTIONS, {
    variables: { limit, offset },
    fetchPolicy: 'cache-and-network',
    pollInterval: 30 * 1000, // 30 seconds
  });

  const loadMore = () => {
    return fetchMore({
      variables: {
        limit,
        offset: (data?.pendingSuggestions?.length ?? 0) + offset,
      },
    });
  };

  return {
    suggestions: data?.pendingSuggestions ?? [],
    loading,
    error,
    refetch,
    loadMore,
    count: data?.pendingSuggestions?.length ?? 0,
  };
}

/**
 * Hook to get pattern-based suggestions
 */
export function usePatternBasedSuggestions(limit = 5) {
  const { data, loading, error, refetch } = useQuery<{
    patternBasedSuggestions: AISuggestion[];
  }>(GET_PATTERN_BASED_SUGGESTIONS, {
    variables: { limit },
    fetchPolicy: 'cache-first',
  });

  return {
    suggestions: data?.patternBasedSuggestions ?? [],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to accept a suggestion
 * Includes optimistic update
 */
export function useAcceptSuggestion() {
  const [accept, { loading, error }] = useMutation<
    { acceptSuggestion: AISuggestion },
    { suggestionId: string }
  >(ACCEPT_SUGGESTION, {
    refetchQueries: ['GetPendingSuggestions', 'GetContextualSuggestions'],
    optimisticResponse: ({ suggestionId }) => ({
      acceptSuggestion: {
        __typename: 'AISuggestion',
        id: suggestionId,
        status: 'Accepted',
        // These will be overwritten by server response
        type: 'TaskSuggestion',
        category: 'Task',
        title: '',
        description: '',
        suggestedAction: null,
        actionPayload: null,
        confidence: 0,
        priority: 'Normal',
        case: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }),
  });

  const acceptSuggestion = async (suggestionId: string) => {
    const startTime = Date.now();
    const result = await accept({ variables: { suggestionId } });
    const responseTimeMs = Date.now() - startTime;

    // Record feedback for learning
    // This is fire-and-forget, don't await
    recordFeedbackAsync(suggestionId, 'accepted', responseTimeMs);

    return result.data?.acceptSuggestion;
  };

  return {
    acceptSuggestion,
    loading,
    error,
  };
}

/**
 * Hook to dismiss a suggestion
 * Includes optimistic update
 */
export function useDismissSuggestion() {
  const [dismiss, { loading, error }] = useMutation<
    { dismissSuggestion: AISuggestion },
    { suggestionId: string; reason?: string }
  >(DISMISS_SUGGESTION, {
    refetchQueries: ['GetPendingSuggestions', 'GetContextualSuggestions'],
    optimisticResponse: ({ suggestionId }) => ({
      dismissSuggestion: {
        __typename: 'AISuggestion',
        id: suggestionId,
        status: 'Dismissed',
        // These will be overwritten by server response
        type: 'TaskSuggestion',
        category: 'Task',
        title: '',
        description: '',
        suggestedAction: null,
        actionPayload: null,
        confidence: 0,
        priority: 'Normal',
        case: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }),
  });

  const dismissSuggestion = async (suggestionId: string, reason?: string) => {
    const startTime = Date.now();
    const result = await dismiss({ variables: { suggestionId, reason } });
    const responseTimeMs = Date.now() - startTime;

    // Record feedback for learning
    recordFeedbackAsync(suggestionId, 'dismissed', responseTimeMs, reason);

    return result.data?.dismissSuggestion;
  };

  return {
    dismissSuggestion,
    loading,
    error,
  };
}

/**
 * Hook to force refresh suggestions for current context
 * Invalidates cache and fetches fresh suggestions
 */
export function useRefreshSuggestions() {
  const [refresh, { loading, error }] = useMutation<
    { refreshSuggestions: AISuggestion[] },
    { context: SuggestionContextInput }
  >(REFRESH_SUGGESTIONS, {
    refetchQueries: ['GetPendingSuggestions', 'GetContextualSuggestions'],
  });

  const refreshSuggestions = async (context: SuggestionContextInput) => {
    const result = await refresh({ variables: { context } });
    return result.data?.refreshSuggestions ?? [];
  };

  return {
    refreshSuggestions,
    loading,
    error,
  };
}

/**
 * Hook to record detailed suggestion feedback
 * Used for learning and improving suggestion quality
 */
export function useRecordFeedback() {
  const [record, { loading, error }] = useMutation<
    { recordSuggestionFeedback: { success: boolean; suggestionId: string; newStatus: string } },
    { input: SuggestionFeedbackInput }
  >(RECORD_FEEDBACK);

  const recordFeedback = async (input: SuggestionFeedbackInput) => {
    const result = await record({ variables: { input } });
    return result.data?.recordSuggestionFeedback;
  };

  return {
    recordFeedback,
    loading,
    error,
  };
}

/**
 * Hook to record user actions for pattern learning
 */
export function useRecordUserAction() {
  const [record, { loading, error }] = useMutation<
    { recordUserAction: boolean },
    { type: string; context?: Record<string, unknown> }
  >(RECORD_USER_ACTION);

  const recordUserAction = async (type: string, context?: Record<string, unknown>) => {
    const result = await record({ variables: { type, context } });
    return result.data?.recordUserAction ?? false;
  };

  return {
    recordUserAction,
    loading,
    error,
  };
}

// ====================
// Helper Functions
// ====================

/**
 * Fire-and-forget feedback recording for background learning
 * Does not block the UI
 */
async function recordFeedbackAsync(
  suggestionId: string,
  action: 'accepted' | 'dismissed',
  responseTimeMs: number,
  feedbackReason?: string
) {
  try {
    // This would typically use a separate Apollo client instance
    // or a simple fetch call to avoid blocking
    // For now, we'll use a simple approach
    await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RecordFeedback($input: SuggestionFeedbackInput!) {
            recordSuggestionFeedback(input: $input) {
              success
            }
          }
        `,
        variables: {
          input: {
            suggestionId,
            action,
            responseTimeMs,
            feedbackReason,
          },
        },
      }),
    });
  } catch {
    // Silently fail - feedback is not critical
    console.debug('Failed to record suggestion feedback');
  }
}

/**
 * Combined hook for the complete suggestion management experience
 * Use this hook in components that need full suggestion functionality
 */
export function useSuggestions(context?: SuggestionContextInput) {
  const contextual = useContextualSuggestions(context ?? {});
  const pending = usePendingSuggestions();
  const { acceptSuggestion, loading: accepting } = useAcceptSuggestion();
  const { dismissSuggestion, loading: dismissing } = useDismissSuggestion();
  const { refreshSuggestions, loading: refreshing } = useRefreshSuggestions();
  const { recordUserAction } = useRecordUserAction();

  // Combine all suggestions, removing duplicates
  const allSuggestions = React.useMemo(() => {
    const seen = new Set<string>();
    const combined: AISuggestion[] = [];

    [...(contextual.suggestions ?? []), ...(pending.suggestions ?? [])].forEach((s) => {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        combined.push(s);
      }
    });

    return combined;
  }, [contextual.suggestions, pending.suggestions]);

  return {
    // All suggestions
    suggestions: allSuggestions,
    contextualSuggestions: contextual.suggestions,
    pendingSuggestions: pending.suggestions,

    // Loading states
    loading: contextual.loading || pending.loading,
    accepting,
    dismissing,
    refreshing,

    // Errors
    error: contextual.error || pending.error,

    // Actions
    acceptSuggestion,
    dismissSuggestion,
    refreshSuggestions: () => context && refreshSuggestions(context),
    recordUserAction,

    // Refetch functions
    refetchContextual: contextual.refetch,
    refetchPending: pending.refetch,

    // Counts
    totalCount: allSuggestions.length,
    contextualCount: contextual.count,
    pendingCount: pending.count,
  };
}

// Import React for useMemo
import * as React from 'react';
