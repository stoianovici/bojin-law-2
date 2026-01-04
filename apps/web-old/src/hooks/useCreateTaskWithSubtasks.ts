/**
 * useCreateTaskWithSubtasks Hook
 * OPS-265: Create a task with subtasks in a single operation
 *
 * Handles the two-step process:
 * 1. Create the parent task via createTask mutation
 * 2. Batch create subtasks with the new task ID
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useCallback, useState } from 'react';
import type { Task } from '@legal-platform/types';
import type { SubtaskDraft } from '../components/task/SubtaskBuilder';

// ============================================================================
// GraphQL Operations
// ============================================================================

const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
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
      createdAt
    }
  }
`;

const CREATE_SUBTASK = gql`
  mutation CreateSubtask($input: CreateSubtaskInput!) {
    createSubtask(input: $input) {
      id
      title
      status
      parentTaskId
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface CreateTaskInput {
  caseId: string;
  type: string;
  title: string;
  description?: string;
  assignedTo: string;
  dueDate: string; // ISO date string
  dueTime?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  estimatedHours?: number;
}

interface CreateSubtaskInput {
  parentTaskId: string;
  title: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useCreateTaskWithSubtasks() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [createTaskMutation] = useMutation<{ createTask: Task }>(CREATE_TASK);
  const [createSubtaskMutation] = useMutation<
    { createSubtask: Task },
    { input: CreateSubtaskInput }
  >(CREATE_SUBTASK);

  const createTaskWithSubtasks = useCallback(
    async (taskInput: CreateTaskInput, subtasks: SubtaskDraft[]): Promise<Task> => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Create the parent task
        const taskResult = await createTaskMutation({
          variables: { input: taskInput },
          refetchQueries: ['GetTasks', 'GetMyTasks', 'GetTasksByCase'],
        });

        const createdTask = taskResult.data?.createTask;
        if (!createdTask) {
          throw new Error('Failed to create task');
        }

        // Step 2: Create subtasks in sequence (could parallelize but keeping it simple)
        if (subtasks.length > 0) {
          for (const subtask of subtasks) {
            await createSubtaskMutation({
              variables: {
                input: {
                  parentTaskId: createdTask.id,
                  title: subtask.title,
                },
              },
            });
          }
        }

        setLoading(false);
        return createdTask;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setLoading(false);
        throw error;
      }
    },
    [createTaskMutation, createSubtaskMutation]
  );

  return {
    createTaskWithSubtasks,
    loading,
    error,
  };
}

export default useCreateTaskWithSubtasks;
