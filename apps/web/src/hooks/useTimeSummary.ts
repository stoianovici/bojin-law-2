/**
 * Time Summary React Hooks
 * Story 4.3: Time Estimation & Manual Time Logging
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// GraphQL Queries
const GET_WEEKLY_SUMMARY = gql`
  query GetWeeklySummary($weekStart: Date!) {
    weeklySummary(weekStart: $weekStart) {
      weekStart
      weekEnd
      totalHours
      billableHours
      nonBillableHours
      billableAmount
      entriesCount
      trend
      byDay {
        date
        dayOfWeek
        totalHours
        billableHours
        nonBillableHours
      }
    }
  }
`;

const GET_WEEKLY_TREND = gql`
  query GetWeeklyTrend($weekCount: Int!) {
    weeklyTrend(weekCount: $weekCount) {
      weekStart
      weekEnd
      totalHours
      billableHours
      nonBillableHours
      billableAmount
      entriesCount
      trend
      byDay {
        date
        dayOfWeek
        totalHours
        billableHours
        nonBillableHours
      }
    }
  }
`;

// Interfaces
export interface DailySummary {
  date: string;
  dayOfWeek: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
}

export type TrendIndicator = 'UP' | 'DOWN' | 'STABLE';

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  billableAmount: number;
  entriesCount: number;
  trend: TrendIndicator;
  byDay: DailySummary[];
}

// Custom Hooks

/**
 * Hook to get weekly summary for a specific week
 * @param weekStart ISO date string for the start of the week (Monday)
 */
export function useWeeklySummary(weekStart: string) {
  return useQuery<{ weeklySummary: WeeklySummary }>(GET_WEEKLY_SUMMARY, {
    variables: { weekStart },
    skip: !weekStart,
  });
}

/**
 * Hook to get weekly trend data for multiple weeks
 * @param weekCount Number of weeks to retrieve (including current week)
 */
export function useWeeklyTrend(weekCount: number = 4) {
  return useQuery<{ weeklyTrend: WeeklySummary[] }>(GET_WEEKLY_TREND, {
    variables: { weekCount },
  });
}
