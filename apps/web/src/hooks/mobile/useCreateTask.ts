'use client';

import { useMutation } from '@apollo/client/react';
import { CREATE_TASK } from '@/graphql/mutations';

export type TaskType =
  | 'Research'
  | 'DocumentCreation'
  | 'DocumentRetrieval'
  | 'CourtDate'
  | 'Meeting'
  | 'BusinessTrip';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface CreateTaskInput {
  caseId: string;
  title: string;
  type: TaskType;
  assignedTo: string;
  dueDate: string;
  dueTime?: string;
  description?: string;
  priority?: TaskPriority;
  estimatedHours?: number;
}

interface CreateTaskData {
  createTask: {
    id: string;
    title: string;
    type: string;
    status: string;
    dueDate: string;
    dueTime: string | null;
    priority: string;
    case: {
      id: string;
      title: string;
    };
    assignee: {
      id: string;
      firstName: string;
      lastName: string;
    };
    createdAt: string;
  };
}

export function useCreateTask() {
  const [createTaskMutation, { loading, error }] = useMutation<
    CreateTaskData,
    { input: CreateTaskInput }
  >(CREATE_TASK);

  const createTask = async (input: CreateTaskInput) => {
    const result = await createTaskMutation({ variables: { input } });
    return result.data?.createTask;
  };

  return {
    createTask,
    loading,
    error,
  };
}
