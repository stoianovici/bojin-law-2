/**
 * Time Entry Management React Hooks
 * Story 4.3: Time Estimation & Manual Time Logging
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import type { TimeEntryInput } from '@legal-platform/types';

// GraphQL Fragments
const TIME_ENTRY_FRAGMENT = gql`
  fragment TimeEntryFields on TimeEntry {
    id
    caseId
    taskId
    userId
    date
    hours
    hourlyRate
    description
    narrative
    billable
    firmId
    createdAt
    updatedAt
    amount
  }
`;

const TIME_ENTRY_WITH_RELATIONS_FRAGMENT = gql`
  fragment TimeEntryWithRelations on TimeEntry {
    ...TimeEntryFields
    case {
      id
      title
      caseNumber
    }
    task {
      id
      title
      type
      estimatedHours
    }
    user {
      id
      firstName
      lastName
    }
  }
  ${TIME_ENTRY_FRAGMENT}
`;

// Queries
const GET_TIME_ENTRY = gql`
  ${TIME_ENTRY_WITH_RELATIONS_FRAGMENT}
  query GetTimeEntry($id: ID!) {
    timeEntry(id: $id) {
      ...TimeEntryWithRelations
    }
  }
`;

const GET_TIME_ENTRIES = gql`
  ${TIME_ENTRY_WITH_RELATIONS_FRAGMENT}
  query GetTimeEntries($filters: TimeEntryFilterInput, $limit: Int, $offset: Int) {
    timeEntries(filters: $filters, limit: $limit, offset: $offset) {
      ...TimeEntryWithRelations
    }
  }
`;

const GET_TIME_ENTRIES_BY_TASK = gql`
  ${TIME_ENTRY_WITH_RELATIONS_FRAGMENT}
  query GetTimeEntriesByTask($taskId: ID!) {
    timeEntriesByTask(taskId: $taskId) {
      ...TimeEntryWithRelations
    }
  }
`;

const GET_MY_TIME_ENTRIES = gql`
  ${TIME_ENTRY_WITH_RELATIONS_FRAGMENT}
  query GetMyTimeEntries($filters: TimeEntryFilterInput) {
    myTimeEntries(filters: $filters) {
      ...TimeEntryWithRelations
    }
  }
`;

// Mutations
const CREATE_TIME_ENTRY = gql`
  ${TIME_ENTRY_WITH_RELATIONS_FRAGMENT}
  mutation CreateTimeEntry($input: CreateTimeEntryInput!) {
    createTimeEntry(input: $input) {
      ...TimeEntryWithRelations
    }
  }
`;

const UPDATE_TIME_ENTRY = gql`
  ${TIME_ENTRY_WITH_RELATIONS_FRAGMENT}
  mutation UpdateTimeEntry($id: ID!, $input: UpdateTimeEntryInput!) {
    updateTimeEntry(id: $id, input: $input) {
      ...TimeEntryWithRelations
    }
  }
`;

const DELETE_TIME_ENTRY = gql`
  mutation DeleteTimeEntry($id: ID!) {
    deleteTimeEntry(id: $id)
  }
`;

const LOG_TIME_AGAINST_TASK = gql`
  ${TIME_ENTRY_WITH_RELATIONS_FRAGMENT}
  mutation LogTimeAgainstTask(
    $taskId: ID!
    $hours: Float!
    $description: String!
    $billable: Boolean
  ) {
    logTimeAgainstTask(
      taskId: $taskId
      hours: $hours
      description: $description
      billable: $billable
    ) {
      ...TimeEntryWithRelations
    }
  }
`;

// Interfaces
export interface TimeEntry {
  id: string;
  caseId: string;
  taskId: string | null;
  userId: string;
  date: string;
  hours: number;
  hourlyRate: number;
  description: string;
  narrative: string | null;
  billable: boolean;
  firmId: string;
  createdAt: string;
  updatedAt: string;
  amount: number;
  case?: {
    id: string;
    title: string;
    caseNumber: string;
  };
  task?: {
    id: string;
    title: string;
    type: string;
    estimatedHours: number | null;
  };
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateTimeEntryInput {
  caseId: string;
  taskId?: string;
  date: string;
  hours: number;
  description: string;
  narrative?: string;
  billable: boolean;
}

export interface UpdateTimeEntryInput {
  date?: string;
  hours?: number;
  description?: string;
  narrative?: string;
  billable?: boolean;
}

export interface TimeEntryFilters {
  caseId?: string;
  taskId?: string;
  dateFrom?: string;
  dateTo?: string;
  billable?: boolean;
}

// Custom Hooks

/**
 * Hook to get a single time entry by ID
 */
export function useTimeEntry(id: string) {
  return useQuery<{ timeEntry: TimeEntry }>(GET_TIME_ENTRY, {
    variables: { id },
    skip: !id,
  });
}

/**
 * Hook to get time entries with optional filters
 */
export function useTimeEntries(filters?: TimeEntryFilters, limit?: number, offset?: number) {
  return useQuery<{ timeEntries: TimeEntry[] }>(GET_TIME_ENTRIES, {
    variables: { filters, limit, offset },
  });
}

/**
 * Hook to get time entries for a specific task
 */
export function useTimeEntriesByTask(taskId: string) {
  return useQuery<{ timeEntriesByTask: TimeEntry[] }>(GET_TIME_ENTRIES_BY_TASK, {
    variables: { taskId },
    skip: !taskId,
  });
}

/**
 * Hook to get current user's time entries
 */
export function useMyTimeEntries(filters?: TimeEntryFilters) {
  return useQuery<{ myTimeEntries: TimeEntry[] }>(GET_MY_TIME_ENTRIES, {
    variables: { filters },
  });
}

/**
 * Hook to create a new time entry
 */
export function useCreateTimeEntry() {
  return useMutation<{ createTimeEntry: TimeEntry }, { input: CreateTimeEntryInput }>(
    CREATE_TIME_ENTRY,
    {
      refetchQueries: ['GetMyTimeEntries', 'GetTimeEntriesByTask', 'GetTimeEntries'],
    }
  );
}

/**
 * Hook to update a time entry
 */
export function useUpdateTimeEntry() {
  return useMutation<{ updateTimeEntry: TimeEntry }, { id: string; input: UpdateTimeEntryInput }>(
    UPDATE_TIME_ENTRY,
    {
      refetchQueries: ['GetTimeEntry', 'GetMyTimeEntries', 'GetTimeEntriesByTask'],
    }
  );
}

/**
 * Hook to delete a time entry
 */
export function useDeleteTimeEntry() {
  return useMutation<{ deleteTimeEntry: boolean }, { id: string }>(DELETE_TIME_ENTRY, {
    refetchQueries: ['GetMyTimeEntries', 'GetTimeEntriesByTask', 'GetTimeEntries'],
  });
}

/**
 * Hook to quickly log time against a task
 */
export function useLogTimeAgainstTask() {
  return useMutation<
    { logTimeAgainstTask: TimeEntry },
    { taskId: string; hours: number; description: string; billable?: boolean }
  >(LOG_TIME_AGAINST_TASK, {
    refetchQueries: ['GetMyTimeEntries', 'GetTimeEntriesByTask', 'GetTask'],
  });
}
