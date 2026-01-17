'use client';

import { useMutation } from '@apollo/client/react';
import { CREATE_TASK } from '@/graphql/mutations';
import { GET_CALENDAR_EVENTS, GET_MY_TASKS } from '@/graphql/queries';

export type TaskType =
  | 'Research'
  | 'DocumentCreation'
  | 'DocumentRetrieval'
  | 'CourtDate'
  | 'Meeting'
  | 'BusinessTrip';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface CreateTaskInput {
  caseId?: string; // Optional - set for case-level tasks
  clientId?: string; // Optional - set for client-level tasks
  title: string;
  type: TaskType;
  assignedTo: string;
  dueDate: string;
  dueTime?: string;
  description?: string;
  priority?: TaskPriority;
  estimatedHours?: number;
  parentTaskId?: string; // For subtasks - links to parent task
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
    } | null;
    client: {
      id: string;
      name: string;
    } | null;
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
  >(CREATE_TASK, {
    refetchQueries: [{ query: GET_CALENDAR_EVENTS }, { query: GET_MY_TASKS }],
  });

  const createTask = async (input: CreateTaskInput) => {
    console.log('[useCreateTask] Sending mutation with input:', input);

    try {
      const result = await createTaskMutation({ variables: { input } });
      console.log('[useCreateTask] Mutation result:', result);

      // Throw error if no task was returned
      if (!result.data?.createTask) {
        throw new Error('Task creation failed - no task returned');
      }

      return result.data.createTask;
    } catch (err) {
      // Apollo throws ApolloError which contains graphQLErrors
      console.error('[useCreateTask] Mutation error:', err);
      throw err;
    }
  };

  return {
    createTask,
    loading,
    error,
  };
}
