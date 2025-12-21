/**
 * Tasks React Hooks
 * Hooks for fetching and managing tasks from the GraphQL API
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { Task, TaskFilters } from '@legal-platform/types';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const TASK_FRAGMENT = gql`
  fragment TaskFields on Task {
    id
    caseId
    type
    title
    description
    assignedTo
    dueDate
    dueTime
    status
    priority
    estimatedHours
    typeMetadata
    parentTaskId
    createdBy
    createdAt
    updatedAt
    completedAt
    assignee {
      id
      firstName
      lastName
      email
    }
    case {
      id
      title
      caseNumber
    }
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_TASKS = gql`
  ${TASK_FRAGMENT}
  query GetTasks($filters: TaskFilterInput, $limit: Int, $offset: Int) {
    tasks(filters: $filters, limit: $limit, offset: $offset) {
      ...TaskFields
    }
  }
`;

const GET_MY_TASKS = gql`
  ${TASK_FRAGMENT}
  query GetMyTasks($filters: TaskFilterInput) {
    myTasks(filters: $filters) {
      ...TaskFields
    }
  }
`;

const GET_TASKS_BY_CASE = gql`
  ${TASK_FRAGMENT}
  query GetTasksByCase($caseId: ID!, $filters: TaskFilterInput) {
    tasksByCase(caseId: $caseId, filters: $filters) {
      ...TaskFields
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface TaskFilterInput {
  types?: string[];
  statuses?: string[];
  priorities?: string[];
  assignedTo?: string[];
  caseId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  searchQuery?: string;
}

/**
 * Convert frontend TaskFilters to GraphQL TaskFilterInput
 */
function toGraphQLFilters(filters?: TaskFilters): TaskFilterInput | undefined {
  if (!filters) return undefined;

  const graphqlFilters: TaskFilterInput = {};

  if (filters.types && filters.types.length > 0) {
    graphqlFilters.types = filters.types;
  }

  if (filters.statuses && filters.statuses.length > 0) {
    graphqlFilters.statuses = filters.statuses;
  }

  if (filters.priorities && filters.priorities.length > 0) {
    graphqlFilters.priorities = filters.priorities;
  }

  if (filters.assignedTo && filters.assignedTo.length > 0) {
    graphqlFilters.assignedTo = filters.assignedTo;
  }

  if (filters.dateRange) {
    graphqlFilters.dueDateFrom = filters.dateRange.start.toISOString().split('T')[0];
    graphqlFilters.dueDateTo = filters.dateRange.end.toISOString().split('T')[0];
  }

  if (filters.searchQuery) {
    graphqlFilters.searchQuery = filters.searchQuery;
  }

  return Object.keys(graphqlFilters).length > 0 ? graphqlFilters : undefined;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch all tasks for the firm
 * Use this for the main tasks page to show all team tasks
 */
export function useTasks(filters?: TaskFilters, limit?: number, offset?: number) {
  const { data, loading, error, refetch } = useQuery<{ tasks: Task[] }>(GET_TASKS, {
    variables: {
      filters: toGraphQLFilters(filters),
      limit: limit || 100,
      offset: offset || 0,
    },
    fetchPolicy: 'cache-and-network',
  });

  return {
    tasks: data?.tasks ?? [],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch only the current user's tasks
 */
export function useMyTasks(filters?: TaskFilters) {
  const { data, loading, error, refetch } = useQuery<{ myTasks: Task[] }>(GET_MY_TASKS, {
    variables: {
      filters: toGraphQLFilters(filters),
    },
    fetchPolicy: 'cache-and-network',
  });

  return {
    tasks: data?.myTasks ?? [],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch tasks for a specific case
 */
export function useTasksByCase(caseId: string, filters?: TaskFilters) {
  const { data, loading, error, refetch } = useQuery<{ tasksByCase: Task[] }>(GET_TASKS_BY_CASE, {
    variables: {
      caseId,
      filters: toGraphQLFilters(filters),
    },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    tasks: data?.tasksByCase ?? [],
    loading,
    error,
    refetch,
  };
}
