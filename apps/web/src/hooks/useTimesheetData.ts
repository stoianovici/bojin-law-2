/**
 * Timesheet Data Hook
 * Fetches time entries for timesheet mode with case context
 *
 * Provides:
 * - Time entries filtered by case and date range
 * - Case billing type detection (hourly/fixed)
 * - Computed totals (hours, cost)
 */

import { useMemo } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { TimesheetFiltersValue } from '../components/team-activity/TimesheetFilters';

// ============================================================================
// Types
// ============================================================================

export type BillingType = 'Hourly' | 'Fixed' | 'Retainer';

export interface TimesheetEntry {
  id: string;
  date: string;
  description: string;
  narrative: string | null;
  hours: number;
  hourlyRate: number;
  amount: number;
  billable: boolean;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  task: {
    id: string;
    title: string;
  } | null;
}

export interface CustomRates {
  partnerRate: number | null;
  associateRate: number | null;
  paralegalRate: number | null;
}

export interface TimesheetCase {
  id: string;
  title: string;
  caseNumber: string | null;
  billingType: BillingType;
  customRates: CustomRates | null;
  client: {
    id: string;
    name: string;
  } | null;
}

export interface TimesheetData {
  entries: TimesheetEntry[];
  case: TimesheetCase | null;
  totalHours: number;
  totalBillableHours: number;
  totalCost: number;
  totalBillableCost: number;
}

export interface UseTimesheetDataResult {
  data: TimesheetData | null;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

// ============================================================================
// GraphQL Query
// ============================================================================

const GET_TIMESHEET_ENTRIES = gql`
  query GetTimesheetEntries(
    $caseId: ID!
    $startDate: DateTime!
    $endDate: DateTime!
    $teamMemberIds: [ID!]
  ) {
    timesheetEntries(
      caseId: $caseId
      startDate: $startDate
      endDate: $endDate
      teamMemberIds: $teamMemberIds
    ) {
      entries {
        id
        date
        description
        narrative
        hours
        hourlyRate
        amount
        billable
        user {
          id
          firstName
          lastName
          email
        }
        task {
          id
          title
        }
      }
      case {
        id
        title
        caseNumber
        billingType
        customRates {
          partnerRate
          associateRate
          paralegalRate
        }
        client {
          id
          name
        }
      }
      totalHours
      totalBillableHours
      totalCost
      totalBillableCost
    }
  }
`;

interface GetTimesheetEntriesResult {
  timesheetEntries: {
    entries: TimesheetEntry[];
    case: TimesheetCase;
    totalHours: number;
    totalBillableHours: number;
    totalCost: number;
    totalBillableCost: number;
  };
}

interface GetTimesheetEntriesVariables {
  caseId: string;
  startDate: string;
  endDate: string;
  teamMemberIds?: string[];
}

// ============================================================================
// Hook
// ============================================================================

export function useTimesheetData(filters: TimesheetFiltersValue): UseTimesheetDataResult {
  const hasCase = !!filters.caseId;

  const variables = useMemo<GetTimesheetEntriesVariables | null>(() => {
    if (!filters.caseId) return null;
    return {
      caseId: filters.caseId,
      startDate: filters.startDate.toISOString(),
      endDate: filters.endDate.toISOString(),
      teamMemberIds: filters.teamMemberIds.length > 0 ? filters.teamMemberIds : undefined,
    };
  }, [filters.caseId, filters.startDate, filters.endDate, filters.teamMemberIds]);

  const { data, loading, error, refetch } = useQuery<
    GetTimesheetEntriesResult,
    GetTimesheetEntriesVariables
  >(GET_TIMESHEET_ENTRIES, {
    variables: variables!,
    skip: !hasCase || !variables,
    fetchPolicy: 'cache-and-network',
  });

  const result = useMemo<TimesheetData | null>(() => {
    if (!data?.timesheetEntries) return null;
    const {
      entries,
      case: caseData,
      totalHours,
      totalBillableHours,
      totalCost,
      totalBillableCost,
    } = data.timesheetEntries;
    return {
      entries,
      case: caseData,
      totalHours,
      totalBillableHours,
      totalCost,
      totalBillableCost,
    };
  }, [data]);

  return {
    data: result,
    loading,
    error: error as Error | undefined,
    refetch,
  };
}

// ============================================================================
// Helpers
// ============================================================================

export function formatUserName(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return fullName || user.email;
}

export function getBillingTypeLabel(billingType: BillingType): string {
  switch (billingType) {
    case 'Hourly':
      return 'Orar';
    case 'Fixed':
      return 'Sumă fixă';
    case 'Retainer':
      return 'Abonament';
    default:
      return billingType;
  }
}
