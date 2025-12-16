/**
 * Response Patterns React Hooks
 * Story 5.6: AI Learning and Personalization (Task 34)
 * Hooks for managing user's response time patterns and deadline suggestions
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useMemo } from 'react';
import type { ResponseTimePattern } from '@legal-platform/types';

// ====================
// GraphQL Fragments
// ====================

const RESPONSE_TIME_PATTERN_FRAGMENT = gql`
  fragment ResponseTimePatternFields on ResponseTimePattern {
    id
    firmId
    userId
    taskType
    caseType
    averageResponseHours
    medianResponseHours
    minResponseHours
    maxResponseHours
    sampleCount
    stdDeviation
    dayOfWeekPattern
    timeOfDayPattern
    lastCalculatedAt
    createdAt
    updatedAt
  }
`;

const SUGGESTED_DEADLINE_FRAGMENT = gql`
  fragment SuggestedDeadlineFields on SuggestedDeadline {
    suggestedDate
    confidence
    basedOnSamples
    reasoning
  }
`;

// ====================
// Queries
// ====================

const GET_MY_RESPONSE_PATTERNS = gql`
  ${RESPONSE_TIME_PATTERN_FRAGMENT}
  query GetMyResponsePatterns {
    myResponsePatterns {
      ...ResponseTimePatternFields
    }
  }
`;

const SUGGEST_DEADLINE = gql`
  ${SUGGESTED_DEADLINE_FRAGMENT}
  query SuggestDeadline($taskType: String!, $caseType: String) {
    suggestDeadline(taskType: $taskType, caseType: $caseType) {
      ...SuggestedDeadlineFields
    }
  }
`;

// ====================
// Types
// ====================

export interface DayOfWeekPattern {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday?: number;
  sunday?: number;
}

export interface TimeOfDayPattern {
  morning: number;
  afternoon: number;
  evening: number;
  night?: number;
}

export interface SuggestedDeadline {
  suggestedDate: string;
  confidence: number;
  basedOnSamples: number;
  reasoning: string;
}

export interface ResponsePatternSummary {
  averageResponseTime: string;
  fastestTaskType?: string;
  slowestTaskType?: string;
  peakProductivityTime?: string;
  totalSamples: number;
}

// ====================
// Hooks
// ====================

/**
 * Hook to get all response time patterns
 */
export function useResponsePatterns() {
  const { data, loading, error, refetch } = useQuery<{
    myResponsePatterns: ResponseTimePattern[];
  }>(GET_MY_RESPONSE_PATTERNS, {
    fetchPolicy: 'cache-and-network',
  });

  const patterns = data?.myResponsePatterns ?? [];

  // Group patterns by task type
  const patternsByTaskType = useMemo(() => {
    const map: Record<string, ResponseTimePattern[]> = {};
    patterns.forEach((pattern: ResponseTimePattern) => {
      if (!map[pattern.taskType]) {
        map[pattern.taskType] = [];
      }
      map[pattern.taskType].push(pattern);
    });
    return map;
  }, [patterns]);

  // Get unique task types
  const taskTypes = useMemo(() => {
    return [...new Set(patterns.map((p: ResponseTimePattern) => p.taskType))];
  }, [patterns]);

  // Calculate summary statistics
  const summary = useMemo((): ResponsePatternSummary | null => {
    if (patterns.length === 0) return null;

    // Calculate overall average
    const totalHours = patterns.reduce(
      (sum: number, p: ResponseTimePattern) => sum + p.averageResponseHours * p.sampleCount,
      0
    );
    const totalSamples = patterns.reduce(
      (sum: number, p: ResponseTimePattern) => sum + p.sampleCount,
      0
    );
    const overallAverage = totalSamples > 0 ? totalHours / totalSamples : 0;

    // Find fastest and slowest task types
    const sortedByAvg = [...patterns].sort(
      (a, b) => a.averageResponseHours - b.averageResponseHours
    );
    const fastest = sortedByAvg[0];
    const slowest = sortedByAvg[sortedByAvg.length - 1];

    // Find peak productivity time
    const dayPatterns = patterns
      .filter((p: ResponseTimePattern) => p.dayOfWeekPattern)
      .map((p: ResponseTimePattern) => p.dayOfWeekPattern as DayOfWeekPattern);

    let peakDay: string | undefined;
    if (dayPatterns.length > 0) {
      const avgByDay: Record<string, number[]> = {};
      dayPatterns.forEach((pattern: DayOfWeekPattern) => {
        Object.entries(pattern).forEach(([day, hours]) => {
          if (!avgByDay[day]) avgByDay[day] = [];
          avgByDay[day].push(hours as number);
        });
      });

      let minAvg = Infinity;
      Object.entries(avgByDay).forEach(([day, hoursList]) => {
        const avg = hoursList.reduce((a, b) => a + b, 0) / hoursList.length;
        if (avg < minAvg) {
          minAvg = avg;
          peakDay = day;
        }
      });
    }

    return {
      averageResponseTime: formatHours(overallAverage),
      fastestTaskType: fastest?.taskType,
      slowestTaskType: slowest?.taskType,
      peakProductivityTime: peakDay ? formatDayOfWeek(peakDay) : undefined,
      totalSamples,
    };
  }, [patterns]);

  return {
    patterns,
    patternsByTaskType,
    taskTypes,
    summary,
    loading,
    error,
    refetch,
    count: patterns.length,
    hasPatterns: patterns.length > 0,
  };
}

/**
 * Hook to get deadline suggestion for a task
 */
export function useSuggestDeadline(taskType: string, caseType?: string) {
  const { data, loading, error, refetch } = useQuery<{
    suggestDeadline: SuggestedDeadline | null;
  }>(SUGGEST_DEADLINE, {
    variables: { taskType, caseType },
    skip: !taskType,
    fetchPolicy: 'network-only',
  });

  const suggestion = data?.suggestDeadline ?? null;

  return {
    suggestion,
    loading,
    error,
    refetch,
    hasSuggestion: !!suggestion,
  };
}

/**
 * Combined hook for response pattern management
 */
export function useResponsePatternManagement() {
  const {
    patterns,
    patternsByTaskType,
    taskTypes,
    summary,
    loading,
    error,
    refetch,
    count,
    hasPatterns,
  } = useResponsePatterns();

  return {
    // Data
    patterns,
    patternsByTaskType,
    taskTypes,
    summary,
    count,
    hasPatterns,

    // Loading states
    loading,

    // Errors
    error,

    // Actions
    refetch,
  };
}

// ====================
// Helper Functions
// ====================

/**
 * Format hours to human-readable string
 */
export function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} minute`;
  }
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h} ${h === 1 ? 'oră' : 'ore'}`;
    return `${h}h ${m}m`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (remainingHours === 0) {
    return `${days} ${days === 1 ? 'zi' : 'zile'}`;
  }
  return `${days} ${days === 1 ? 'zi' : 'zile'} ${remainingHours}h`;
}

/**
 * Format day of week to Romanian
 */
export function formatDayOfWeek(day: string): string {
  const days: Record<string, string> = {
    monday: 'Luni',
    tuesday: 'Marți',
    wednesday: 'Miercuri',
    thursday: 'Joi',
    friday: 'Vineri',
    saturday: 'Sâmbătă',
    sunday: 'Duminică',
  };
  return days[day.toLowerCase()] || day;
}

/**
 * Format time of day to Romanian
 */
export function formatTimeOfDay(time: string): string {
  const times: Record<string, string> = {
    morning: 'Dimineață (6-12)',
    afternoon: 'După-amiază (12-18)',
    evening: 'Seară (18-22)',
    night: 'Noapte (22-6)',
  };
  return times[time.toLowerCase()] || time;
}

/**
 * Get task type label in Romanian
 */
export function formatTaskType(type: string): string {
  const types: Record<string, string> = {
    Research: 'Cercetare',
    Drafting: 'Redactare',
    Review: 'Revizuire',
    Meeting: 'Întâlnire',
    Filing: 'Depunere',
    Communication: 'Comunicare',
    Administrative: 'Administrativ',
    CourtAppearance: 'Prezență în instanță',
    ClientCall: 'Apel client',
    InternalMeeting: 'Întâlnire internă',
  };
  return types[type] || type;
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
 * Get color for hours value (for heatmaps)
 */
export function getHoursColor(hours: number, max: number): string {
  const ratio = hours / max;
  if (ratio < 0.25) return 'bg-green-100 text-green-800';
  if (ratio < 0.5) return 'bg-yellow-100 text-yellow-800';
  if (ratio < 0.75) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

/**
 * Calculate productivity score from pattern
 */
export function calculateProductivityScore(pattern: ResponseTimePattern): number {
  // Score based on consistency (lower std deviation = more consistent)
  const consistencyScore = pattern.stdDeviation ? Math.max(0, 100 - pattern.stdDeviation * 10) : 50;

  // Score based on response time relative to baseline (24h = 50 points)
  const speedScore = Math.max(0, 100 - (pattern.averageResponseHours / 24) * 50);

  // Weighted average
  return Math.round(consistencyScore * 0.4 + speedScore * 0.6);
}
