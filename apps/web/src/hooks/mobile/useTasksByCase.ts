'use client';

import { useQuery } from '@apollo/client/react';
import { GET_TASKS_BY_CASE } from '@/graphql/queries';

// Task type matching the GET_TASKS_BY_CASE query response
export interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null;
  dueTime: string | null;
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: string;
  completedAt: string | null;
}

// Filter input type for task queries
export interface TaskFilterInput {
  status?: string;
  priority?: string;
  assigneeId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  searchQuery?: string;
}

interface GetTasksByCaseData {
  tasksByCase: Task[];
}

interface GetTasksByCaseVariables {
  caseId: string;
  filters?: TaskFilterInput;
}

interface UseTasksByCaseResult {
  tasks: Task[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
}

export function useTasksByCase(caseId: string, filters?: TaskFilterInput): UseTasksByCaseResult {
  const { data, loading, error, refetch } = useQuery<GetTasksByCaseData, GetTasksByCaseVariables>(
    GET_TASKS_BY_CASE,
    {
      variables: { caseId, filters },
      skip: !caseId,
    }
  );

  return {
    tasks: data?.tasksByCase ?? [],
    loading,
    error,
    refetch: async () => {
      await refetch();
    },
  };
}
