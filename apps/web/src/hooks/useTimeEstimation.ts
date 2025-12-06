/**
 * Time Estimation React Hooks
 * Story 4.3: Time Estimation & Manual Time Logging
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import type { TaskType } from '@legal-platform/types';

// GraphQL Queries
const ESTIMATE_TASK_TIME = gql`
  mutation EstimateTaskTime($input: EstimateTimeInput!) {
    estimateTaskTime(input: $input) {
      estimatedHours
      confidence
      reasoning
      basedOnSimilarTasks
      rangeMin
      rangeMax
    }
  }
`;

const GET_ESTIMATE_VS_ACTUAL_REPORT = gql`
  query GetEstimateVsActualReport($periodStart: Date!, $periodEnd: Date!) {
    estimateVsActualReport(periodStart: $periodStart, periodEnd: $periodEnd) {
      userId
      periodStart
      periodEnd
      overallAccuracy
      improvementTrend
      recommendations
      byTaskType {
        taskType
        taskCount
        avgEstimatedHours
        avgActualHours
        accuracy
        variance
        variancePercent
      }
    }
  }
`;

const GET_TASK_TYPE_ACCURACY = gql`
  query GetTaskTypeAccuracy($taskType: TaskType!) {
    taskTypeAccuracy(taskType: $taskType) {
      taskType
      taskCount
      avgEstimatedHours
      avgActualHours
      accuracy
      variance
      variancePercent
    }
  }
`;

// Interfaces
export interface TimeEstimation {
  estimatedHours: number;
  confidence: number;
  reasoning: string;
  basedOnSimilarTasks: number;
  rangeMin: number;
  rangeMax: number;
}

export interface EstimateTimeInput {
  taskType: TaskType;
  taskTitle: string;
  taskDescription?: string;
  caseType?: string;
}

export interface TaskTypeComparison {
  taskType: TaskType;
  taskCount: number;
  avgEstimatedHours: number;
  avgActualHours: number;
  accuracy: number;
  variance: number;
  variancePercent: number;
}

export type TrendIndicator = 'UP' | 'DOWN' | 'STABLE';

export interface EstimateVsActualReport {
  userId: string;
  periodStart: string;
  periodEnd: string;
  overallAccuracy: number;
  improvementTrend: TrendIndicator;
  recommendations: string[];
  byTaskType: TaskTypeComparison[];
}

// Custom Hooks

/**
 * Hook to estimate task time using AI
 */
export function useEstimateTaskTime() {
  return useMutation<{ estimateTaskTime: TimeEstimation }, { input: EstimateTimeInput }>(
    ESTIMATE_TASK_TIME
  );
}

/**
 * Hook to get estimate vs actual report for a period
 */
export function useEstimateVsActualReport(periodStart: string, periodEnd: string) {
  return useQuery<{ estimateVsActualReport: EstimateVsActualReport }>(
    GET_ESTIMATE_VS_ACTUAL_REPORT,
    {
      variables: { periodStart, periodEnd },
      skip: !periodStart || !periodEnd,
    }
  );
}

/**
 * Hook to get accuracy for a specific task type
 */
export function useTaskTypeAccuracy(taskType: TaskType) {
  return useQuery<{ taskTypeAccuracy: TaskTypeComparison }>(GET_TASK_TYPE_ACCURACY, {
    variables: { taskType },
    skip: !taskType,
  });
}
