'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_MY_TASKS } from '@/graphql/queries';
import { UPDATE_TASK_STATUS, CREATE_TASK } from '@/graphql/mutations';

// ============================================
// Types
// ============================================

export type TaskStatus = 'Pending' | 'InProgress' | 'Completed' | 'Cancelled';
export type TaskPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  estimatedHours: number | null;
  loggedTime: number | null;
  case: {
    id: string;
    caseNumber: string;
    title: string;
  } | null;
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: string;
  completedAt: string | null;
}

interface TasksData {
  myTasks: Task[];
}

type FilterMode = 'pending' | 'completed' | 'all';

// ============================================
// Hook
// ============================================

export function useTasks() {
  const [filterMode, setFilterMode] = useState<FilterMode>('pending');

  // Build filter based on mode
  const getFilters = () => {
    switch (filterMode) {
      case 'pending':
        return { statuses: ['Pending', 'InProgress'] };
      case 'completed':
        return { statuses: ['Completed'] };
      case 'all':
        return {};
    }
  };

  const { data, loading, error, refetch } = useQuery<TasksData>(GET_MY_TASKS, {
    variables: { filters: getFilters() },
    fetchPolicy: 'cache-and-network',
  });

  // Toggle task completion mutation
  const [updateStatus, { loading: updating }] = useMutation(UPDATE_TASK_STATUS, {
    optimisticResponse: ({ id, status }: { id: string; status: TaskStatus }) => ({
      __typename: 'Mutation' as const,
      updateTask: {
        __typename: 'Task' as const,
        id,
        status,
        completedAt: status === 'Completed' ? new Date().toISOString() : null,
      },
    }),
  });

  // Create task mutation
  const [createTask, { loading: creating }] = useMutation(CREATE_TASK, {
    refetchQueries: [{ query: GET_MY_TASKS, variables: { filters: getFilters() } }],
  });

  // Sort tasks: urgent first, then by due date
  const sortedTasks = [...(data?.myTasks ?? [])].sort((a, b) => {
    // Priority order: Urgent > High > Normal > Low
    const priorityOrder: Record<string, number> = {
      Urgent: 0,
      High: 1,
      Normal: 2,
      Low: 3,
    };
    const priorityDiff = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;

    // Then by due date (null dates go last)
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  // Group tasks by case
  const tasksByCase = sortedTasks.reduce(
    (acc, task) => {
      const caseId = task.case?.id ?? 'no-case';
      const caseName = task.case?.caseNumber ?? 'Fără dosar';
      if (!acc[caseId]) {
        acc[caseId] = { caseId, caseName, caseTitle: task.case?.title ?? '', tasks: [] };
      }
      acc[caseId].tasks.push(task);
      return acc;
    },
    {} as Record<string, { caseId: string; caseName: string; caseTitle: string; tasks: Task[] }>
  );

  // Toggle task completion
  const toggleTask = async (taskId: string, currentStatus: TaskStatus) => {
    const newStatus: TaskStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    await updateStatus({
      variables: { id: taskId, status: newStatus },
    });
  };

  // Count stats
  const stats = {
    pending: sortedTasks.filter((t) => t.status === 'Pending' || t.status === 'InProgress').length,
    completed: sortedTasks.filter((t) => t.status === 'Completed').length,
    overdue: sortedTasks.filter((t) => {
      if (!t.dueDate || t.status === 'Completed') return false;
      return new Date(t.dueDate) < new Date();
    }).length,
    urgent: sortedTasks.filter((t) => t.priority === 'Urgent' && t.status !== 'Completed').length,
  };

  return {
    tasks: sortedTasks,
    tasksByCase: Object.values(tasksByCase),
    loading,
    error,
    refetch,
    filterMode,
    setFilterMode,
    toggleTask,
    updating,
    createTask,
    creating,
    stats,
  };
}
