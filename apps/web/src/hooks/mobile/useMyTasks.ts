'use client';

import { useQuery } from '@apollo/client/react';
import { GET_MY_TASKS } from '@/graphql/queries';

// Task filter input type
export interface TaskFilterInput {
  status?: string;
  priority?: string;
  type?: string;
  dueDate?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  [key: string]: unknown;
}

// Task-related types based on the GraphQL query
export interface TaskCase {
  id: string;
  caseNumber: string;
  title: string;
}

export interface TaskAssignee {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null;
  dueTime: string | null;
  case: TaskCase | null;
  assignee: TaskAssignee | null;
  createdAt: string;
  completedAt: string | null;
}

interface GetMyTasksData {
  myTasks: Task[];
}

interface GetMyTasksVariables {
  filters?: TaskFilterInput;
}

interface UseMyTasksResult {
  tasks: Task[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
}

export function useMyTasks(filters?: TaskFilterInput): UseMyTasksResult {
  const { data, loading, error, refetch } = useQuery<GetMyTasksData, GetMyTasksVariables>(
    GET_MY_TASKS,
    {
      variables: filters ? { filters } : undefined,
      fetchPolicy: 'cache-and-network',
    }
  );

  const handleRefetch = async () => {
    await refetch();
  };

  return {
    tasks: data?.myTasks ?? [],
    loading,
    error: error ? new Error(error.message) : undefined,
    refetch: handleRefetch,
  };
}
