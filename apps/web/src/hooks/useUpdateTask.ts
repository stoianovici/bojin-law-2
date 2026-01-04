'use client';

import { useMutation } from '@apollo/client/react';
import { UPDATE_TASK } from '@/graphql/mutations';

export type TaskType =
  | 'Research'
  | 'DocumentCreation'
  | 'DocumentRetrieval'
  | 'CourtDate'
  | 'Meeting'
  | 'BusinessTrip';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Planificat' | 'InLucru' | 'Review' | 'Finalizat';

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  dueTime?: string;
  assignedTo?: string;
  caseId?: string;
  estimatedDuration?: number;
  parentTaskId?: string;
}

interface Assignee {
  id: string;
  firstName: string;
  lastName: string;
}

interface Subtask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedDuration: number | null;
  assignee: Assignee | null;
}

interface UpdateTaskData {
  updateTask: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    status: string;
    priority: string;
    dueDate: string | null;
    dueTime: string | null;
    estimatedDuration: number | null;
    parentTaskId: string | null;
    assignee: Assignee | null;
    case: {
      id: string;
      title: string;
    } | null;
    subtasks: Subtask[];
  };
}

export function useUpdateTask() {
  const [updateTaskMutation, { loading, error }] = useMutation<
    UpdateTaskData,
    { id: string; input: UpdateTaskInput }
  >(UPDATE_TASK);

  const updateTask = async (id: string, input: UpdateTaskInput) => {
    const result = await updateTaskMutation({ variables: { id, input } });
    return result.data?.updateTask;
  };

  return {
    updateTask,
    loading,
    error,
  };
}
