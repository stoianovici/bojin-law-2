/**
 * Morning Briefing React Hooks
 * Story 5.4: Proactive AI Suggestions System
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import type {
  ProactiveAISuggestion,
  PrioritizedTask,
  DeadlineInfo,
  RiskAlert,
} from '@legal-platform/types';

// Use the correct AISuggestion type (GraphQL-compatible)
type AISuggestion = ProactiveAISuggestion;
import type { Task } from '@legal-platform/types';

// ====================
// GraphQL Fragments
// ====================

const PRIORITIZED_TASK_FRAGMENT = gql`
  fragment PrioritizedTaskFields on PrioritizedTask {
    taskId
    task {
      id
      title
      description
      dueDate
      status
      priority
      assignee {
        id
        firstName
        lastName
      }
      case {
        id
        title
      }
    }
    priority
    priorityReason
    suggestedTimeSlot
  }
`;

const DEADLINE_INFO_FRAGMENT = gql`
  fragment DeadlineInfoFields on DeadlineInfo {
    id
    taskId
    title
    dueDate
    daysUntilDue
    severity
    caseId
    case {
      id
      title
    }
    suggestedActions {
      action
      description
      actionType
      payload
    }
    blockedBy
  }
`;

const RISK_ALERT_FRAGMENT = gql`
  fragment RiskAlertFields on RiskAlert {
    type
    description
    suggestedAction
    severity
  }
`;

const AI_SUGGESTION_FRAGMENT = gql`
  fragment AISuggestionFields on AISuggestion {
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

const MORNING_BRIEFING_FRAGMENT = gql`
  ${PRIORITIZED_TASK_FRAGMENT}
  ${DEADLINE_INFO_FRAGMENT}
  ${RISK_ALERT_FRAGMENT}
  ${AI_SUGGESTION_FRAGMENT}
  fragment MorningBriefingFields on MorningBriefing {
    id
    briefingDate
    prioritizedTasks {
      ...PrioritizedTaskFields
    }
    keyDeadlines {
      ...DeadlineInfoFields
    }
    riskAlerts {
      ...RiskAlertFields
    }
    suggestions {
      ...AISuggestionFields
    }
    summary
    isViewed
    viewedAt
    tokensUsed
    createdAt
  }
`;

// ====================
// Queries
// ====================

const GET_MORNING_BRIEFING = gql`
  ${MORNING_BRIEFING_FRAGMENT}
  query GetMorningBriefing($date: Date) {
    morningBriefing(date: $date) {
      ...MorningBriefingFields
    }
  }
`;

// ====================
// Mutations
// ====================

const MARK_BRIEFING_VIEWED = gql`
  ${MORNING_BRIEFING_FRAGMENT}
  mutation MarkBriefingViewed($briefingId: ID!) {
    markBriefingViewed(briefingId: $briefingId) {
      ...MorningBriefingFields
    }
  }
`;

const GENERATE_MORNING_BRIEFING = gql`
  ${MORNING_BRIEFING_FRAGMENT}
  mutation GenerateMorningBriefing {
    generateMorningBriefing {
      ...MorningBriefingFields
    }
  }
`;

// ====================
// Types
// ====================

export interface MorningBriefing {
  id: string;
  briefingDate: string;
  prioritizedTasks: Array<PrioritizedTask & { task: Task | null }>;
  keyDeadlines: DeadlineInfo[];
  riskAlerts: RiskAlert[];
  suggestions: AISuggestion[];
  summary: string;
  isViewed: boolean;
  viewedAt: string | null;
  tokensUsed: number | null;
  createdAt: string;
}

// ====================
// Hooks
// ====================

/**
 * Hook to get today's morning briefing
 * Auto-fetches on mount and caches for the session
 */
export function useTodaysBriefing() {
  const { data, loading, error, refetch } = useQuery<{
    morningBriefing: MorningBriefing | null;
  }>(GET_MORNING_BRIEFING, {
    // No date variable defaults to today
    fetchPolicy: 'cache-first',
    // Refetch every 5 minutes to check for updates
    pollInterval: 5 * 60 * 1000,
  });

  return {
    briefing: data?.morningBriefing ?? null,
    loading,
    error,
    refetch,
    hasBriefing: !!data?.morningBriefing,
  };
}

/**
 * Hook to get a specific date's briefing
 */
export function useBriefingByDate(date: string | null) {
  const { data, loading, error, refetch } = useQuery<{
    morningBriefing: MorningBriefing | null;
  }>(GET_MORNING_BRIEFING, {
    variables: { date },
    skip: !date,
    fetchPolicy: 'cache-first',
  });

  return {
    briefing: data?.morningBriefing ?? null,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to mark a briefing as viewed
 */
export function useMarkBriefingViewed() {
  const [markViewed, { loading, error }] = useMutation<
    { markBriefingViewed: MorningBriefing },
    { briefingId: string }
  >(MARK_BRIEFING_VIEWED, {
    refetchQueries: ['GetMorningBriefing'],
  });

  const markBriefingViewed = async (briefingId: string) => {
    const result = await markViewed({ variables: { briefingId } });
    return result.data?.markBriefingViewed;
  };

  return {
    markBriefingViewed,
    loading,
    error,
  };
}

/**
 * Hook to generate a new morning briefing
 */
export function useGenerateMorningBriefing() {
  const [generate, { loading, error }] = useMutation<{
    generateMorningBriefing: MorningBriefing;
  }>(GENERATE_MORNING_BRIEFING, {
    refetchQueries: ['GetMorningBriefing'],
  });

  const generateBriefing = async () => {
    const result = await generate();
    return result.data?.generateMorningBriefing;
  };

  return {
    generateBriefing,
    loading,
    error,
  };
}

/**
 * Hook to get suggestions from the morning briefing
 * Convenience hook that extracts just the suggestions
 */
export function useBriefingSuggestions() {
  const { briefing, loading, error } = useTodaysBriefing();

  return {
    suggestions: briefing?.suggestions ?? [],
    loading,
    error,
    count: briefing?.suggestions?.length ?? 0,
  };
}

/**
 * Hook to get prioritized tasks from the morning briefing
 * Convenience hook that extracts just the prioritized tasks
 */
export function usePrioritizedTasks() {
  const { briefing, loading, error } = useTodaysBriefing();

  return {
    tasks: briefing?.prioritizedTasks ?? [],
    loading,
    error,
    count: briefing?.prioritizedTasks?.length ?? 0,
  };
}

/**
 * Hook to get key deadlines from the morning briefing
 * Convenience hook that extracts just the deadlines
 */
export function useKeyDeadlines() {
  const { briefing, loading, error } = useTodaysBriefing();

  return {
    deadlines: briefing?.keyDeadlines ?? [],
    loading,
    error,
    count: briefing?.keyDeadlines?.length ?? 0,
  };
}

/**
 * Hook to get risk alerts from the morning briefing
 * Convenience hook that extracts just the risk alerts
 */
export function useRiskAlerts() {
  const { briefing, loading, error } = useTodaysBriefing();

  return {
    alerts: briefing?.riskAlerts ?? [],
    loading,
    error,
    count: briefing?.riskAlerts?.length ?? 0,
  };
}

/**
 * Combined hook for the complete morning briefing experience
 * Includes auto-mark-viewed functionality
 */
export function useMorningBriefing() {
  const { briefing, loading, error, refetch, hasBriefing } = useTodaysBriefing();
  const { markBriefingViewed, loading: markingViewed } = useMarkBriefingViewed();
  const { generateBriefing, loading: generating } = useGenerateMorningBriefing();

  // Mark as viewed when briefing is loaded and not yet viewed
  const markViewed = async () => {
    if (briefing && !briefing.isViewed) {
      await markBriefingViewed(briefing.id);
    }
  };

  return {
    briefing,
    loading: loading || markingViewed || generating,
    error,
    refetch,
    hasBriefing,
    markViewed,
    generateBriefing,
    // Convenience getters
    summary: briefing?.summary ?? null,
    prioritizedTasks: briefing?.prioritizedTasks ?? [],
    keyDeadlines: briefing?.keyDeadlines ?? [],
    riskAlerts: briefing?.riskAlerts ?? [],
    suggestions: briefing?.suggestions ?? [],
    isViewed: briefing?.isViewed ?? false,
  };
}
