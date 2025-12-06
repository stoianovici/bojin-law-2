/**
 * Task Patterns React Hooks
 * Story 5.6: AI Learning and Personalization (Task 29)
 * Hooks for managing learned task creation patterns
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useMemo } from 'react';
import type { TaskCreationPattern } from '@legal-platform/types';

// ====================
// GraphQL Fragments
// ====================

const TASK_CREATION_PATTERN_FRAGMENT = gql`
  fragment TaskCreationPatternFields on TaskCreationPattern {
    id
    firmId
    userId
    patternName
    triggerType
    triggerContext
    taskTemplate {
      type
      titleTemplate
      descriptionTemplate
      priority
      estimatedHours
    }
    occurrenceCount
    confidence
    isActive
    lastTriggeredAt
    createdAt
    updatedAt
  }
`;

const SUGGESTED_TASK_FRAGMENT = gql`
  fragment SuggestedTaskFields on SuggestedTask {
    pattern {
      id
      patternName
      confidence
    }
    title
    description
    type
    priority
    suggestedDueDate
    confidence
  }
`;

// ====================
// Queries
// ====================

const GET_MY_TASK_PATTERNS = gql`
  ${TASK_CREATION_PATTERN_FRAGMENT}
  query GetMyTaskPatterns($activeOnly: Boolean) {
    myTaskPatterns(activeOnly: $activeOnly) {
      ...TaskCreationPatternFields
    }
  }
`;

const SUGGEST_TASK_FROM_CONTEXT = gql`
  ${SUGGESTED_TASK_FRAGMENT}
  query SuggestTaskFromContext($context: JSON!) {
    suggestTaskFromContext(context: $context) {
      ...SuggestedTaskFields
    }
  }
`;

// ====================
// Mutations
// ====================

const UPDATE_TASK_PATTERN = gql`
  ${TASK_CREATION_PATTERN_FRAGMENT}
  mutation UpdateTaskPattern($id: ID!, $input: TaskPatternUpdateInput!) {
    updateTaskPattern(id: $id, input: $input) {
      ...TaskCreationPatternFields
    }
  }
`;

const DELETE_TASK_PATTERN = gql`
  mutation DeleteTaskPattern($id: ID!) {
    deleteTaskPattern(id: $id)
  }
`;

const ACCEPT_TASK_SUGGESTION = gql`
  mutation AcceptTaskSuggestion($patternId: ID!, $caseId: ID!) {
    acceptTaskSuggestion(patternId: $patternId, caseId: $caseId) {
      id
      title
      type
      priority
      dueDate
    }
  }
`;

const DISMISS_TASK_SUGGESTION = gql`
  mutation DismissTaskSuggestion($patternId: ID!, $reason: String) {
    dismissTaskSuggestion(patternId: $patternId, reason: $reason)
  }
`;

const RESET_TASK_PATTERNS = gql`
  mutation ResetTaskPatterns {
    resetTaskPatterns
  }
`;

// ====================
// Types
// ====================

export interface TaskTemplate {
  type: string;
  titleTemplate: string;
  descriptionTemplate?: string;
  priority: string;
  estimatedHours?: number;
}

export interface TaskPatternUpdateInput {
  isActive?: boolean;
  taskTemplate?: Partial<TaskTemplate>;
}

export interface SuggestedTask {
  pattern: {
    id: string;
    patternName: string;
    confidence: number;
  };
  title: string;
  description?: string;
  type: string;
  priority: string;
  suggestedDueDate?: string;
  confidence: number;
}

export interface TriggerContext {
  caseType?: string;
  documentType?: string;
  emailKeywords?: string[];
  taskCompleted?: string;
  dayOfWeek?: number;
  [key: string]: unknown;
}

// ====================
// Hooks
// ====================

/**
 * Hook to get all task creation patterns
 */
export function useTaskPatterns(activeOnly?: boolean) {
  const { data, loading, error, refetch } = useQuery<{
    myTaskPatterns: TaskCreationPattern[];
  }>(GET_MY_TASK_PATTERNS, {
    variables: activeOnly !== undefined ? { activeOnly } : {},
    fetchPolicy: 'cache-and-network',
  });

  const patterns = data?.myTaskPatterns ?? [];

  // Group patterns by trigger type
  const patternsByTrigger = useMemo(() => {
    const groups: Record<string, TaskCreationPattern[]> = {};

    patterns.forEach((pattern: TaskCreationPattern) => {
      const trigger = pattern.triggerType;
      if (!groups[trigger]) {
        groups[trigger] = [];
      }
      groups[trigger].push(pattern);
    });

    return groups;
  }, [patterns]);

  // Sort patterns by confidence
  const sortedByConfidence = useMemo(() => {
    return [...patterns].sort((a, b) => b.confidence - a.confidence);
  }, [patterns]);

  // Most triggered patterns (top 5)
  const mostTriggered = useMemo(() => {
    return [...patterns]
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .slice(0, 5);
  }, [patterns]);

  // Active patterns count
  const activeCount = useMemo(() => {
    return patterns.filter((p: TaskCreationPattern) => p.isActive).length;
  }, [patterns]);

  return {
    patterns,
    patternsByTrigger,
    sortedByConfidence,
    mostTriggered,
    loading,
    error,
    refetch,
    count: patterns.length,
    activeCount,
  };
}

/**
 * Hook to update a task pattern
 */
export function useUpdateTaskPattern() {
  const [update, { loading, error }] = useMutation<
    { updateTaskPattern: TaskCreationPattern },
    { id: string; input: TaskPatternUpdateInput }
  >(UPDATE_TASK_PATTERN, {
    refetchQueries: ['GetMyTaskPatterns'],
  });

  const updatePattern = async (id: string, input: TaskPatternUpdateInput) => {
    const result = await update({ variables: { id, input } });
    return result.data?.updateTaskPattern;
  };

  return {
    updatePattern,
    loading,
    error,
  };
}

/**
 * Hook to toggle a pattern's active state
 */
export function useToggleTaskPattern() {
  const { updatePattern, loading, error } = useUpdateTaskPattern();

  const togglePattern = async (pattern: TaskCreationPattern) => {
    return updatePattern(pattern.id, { isActive: !pattern.isActive });
  };

  return {
    togglePattern,
    loading,
    error,
  };
}

/**
 * Hook to delete a task pattern
 */
export function useDeleteTaskPattern() {
  const [deleteMutation, { loading, error }] = useMutation<
    { deleteTaskPattern: boolean },
    { id: string }
  >(DELETE_TASK_PATTERN, {
    refetchQueries: ['GetMyTaskPatterns'],
    awaitRefetchQueries: true,
  });

  const deletePattern = async (id: string) => {
    const result = await deleteMutation({ variables: { id } });
    return result.data?.deleteTaskPattern ?? false;
  };

  return {
    deletePattern,
    loading,
    error,
  };
}

/**
 * Hook to get task suggestion based on context
 */
export function useSuggestTask(context: TriggerContext | null) {
  const { data, loading, error, refetch } = useQuery<{
    suggestTaskFromContext: SuggestedTask | null;
  }>(SUGGEST_TASK_FROM_CONTEXT, {
    variables: { context },
    skip: !context || Object.keys(context).length === 0,
    fetchPolicy: 'network-only',
  });

  return {
    suggestion: data?.suggestTaskFromContext ?? null,
    loading,
    error,
    refetch,
    hasSuggestion: !!data?.suggestTaskFromContext,
  };
}

/**
 * Hook to accept a task suggestion and create task
 */
export function useAcceptTaskSuggestion() {
  const [accept, { loading, error }] = useMutation<
    { acceptTaskSuggestion: { id: string; title: string } },
    { patternId: string; caseId: string }
  >(ACCEPT_TASK_SUGGESTION, {
    refetchQueries: ['GetMyTaskPatterns', 'GetTasks'],
    awaitRefetchQueries: true,
  });

  const acceptSuggestion = async (patternId: string, caseId: string) => {
    const result = await accept({ variables: { patternId, caseId } });
    return result.data?.acceptTaskSuggestion;
  };

  return {
    acceptSuggestion,
    loading,
    error,
  };
}

/**
 * Hook to dismiss a task suggestion
 */
export function useDismissTaskSuggestion() {
  const [dismiss, { loading, error }] = useMutation<
    { dismissTaskSuggestion: boolean },
    { patternId: string; reason?: string }
  >(DISMISS_TASK_SUGGESTION);

  const dismissSuggestion = async (patternId: string, reason?: string) => {
    const result = await dismiss({ variables: { patternId, reason } });
    return result.data?.dismissTaskSuggestion ?? false;
  };

  return {
    dismissSuggestion,
    loading,
    error,
  };
}

/**
 * Hook to reset all task patterns
 */
export function useResetTaskPatterns() {
  const [reset, { loading, error }] = useMutation<{
    resetTaskPatterns: boolean;
  }>(RESET_TASK_PATTERNS, {
    refetchQueries: ['GetMyTaskPatterns'],
  });

  const resetPatterns = async () => {
    const result = await reset();
    return result.data?.resetTaskPatterns ?? false;
  };

  return {
    resetPatterns,
    loading,
    error,
  };
}

/**
 * Combined hook for task pattern management
 * Use in settings/personalization pages
 */
export function useTaskPatternManagement(activeOnly?: boolean) {
  const {
    patterns,
    patternsByTrigger,
    sortedByConfidence,
    mostTriggered,
    loading: patternsLoading,
    error: patternsError,
    refetch,
    count,
    activeCount,
  } = useTaskPatterns(activeOnly);

  const {
    updatePattern,
    loading: updating,
    error: updateError,
  } = useUpdateTaskPattern();

  const { togglePattern, loading: toggling } = useToggleTaskPattern();

  const {
    deletePattern,
    loading: deleting,
    error: deleteError,
  } = useDeleteTaskPattern();

  const {
    resetPatterns,
    loading: resetting,
    error: resetError,
  } = useResetTaskPatterns();

  return {
    // Data
    patterns,
    patternsByTrigger,
    sortedByConfidence,
    mostTriggered,
    count,
    activeCount,

    // Loading states
    loading: patternsLoading,
    updating,
    toggling,
    deleting,
    resetting,

    // Errors
    error: patternsError || updateError || deleteError || resetError,

    // Actions
    updatePattern,
    togglePattern,
    deletePattern,
    resetPatterns,
    refetch,
  };
}

/**
 * Hook to watch for task suggestions based on current context
 * Used in case/document views to show relevant suggestions
 */
export function useTaskSuggestionWatcher(context: TriggerContext | null) {
  const { suggestion, loading, error, refetch, hasSuggestion } =
    useSuggestTask(context);

  const {
    acceptSuggestion,
    loading: accepting,
    error: acceptError,
  } = useAcceptTaskSuggestion();

  const {
    dismissSuggestion,
    loading: dismissing,
    error: dismissError,
  } = useDismissTaskSuggestion();

  return {
    suggestion,
    hasSuggestion,
    loading,
    accepting,
    dismissing,
    error: error || acceptError || dismissError,
    acceptSuggestion,
    dismissSuggestion,
    refreshSuggestion: refetch,
  };
}

// ====================
// Helper Functions
// ====================

/**
 * Get human-readable label for trigger type
 */
export function getTriggerTypeLabel(triggerType: string): string {
  const labels: Record<string, string> = {
    case_opened: 'Caz nou deschis',
    document_uploaded: 'Document încărcat',
    email_received: 'Email primit',
    task_completed: 'Task finalizat',
    deadline_approaching: 'Deadline apropiat',
    time_based: 'Programat',
  };
  return labels[triggerType] ?? triggerType;
}

/**
 * Get confidence level label
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return 'Foarte înaltă';
  if (confidence >= 0.7) return 'Înaltă';
  if (confidence >= 0.5) return 'Medie';
  if (confidence >= 0.3) return 'Scăzută';
  return 'Foarte scăzută';
}

/**
 * Get confidence color class
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'text-green-600';
  if (confidence >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}
