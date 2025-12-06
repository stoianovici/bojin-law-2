/**
 * Subtask Management React Hooks
 * Story 4.6: Task Collaboration and Updates (AC: 4)
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import type { Task } from '@legal-platform/types';

// Types
interface ParentTaskContext {
  id: string;
  title: string;
  caseId: string;
  caseTitle: string;
  type: string;
}

interface SubtaskWithContext {
  subtask: Task;
  parentTask: ParentTaskContext;
}

// GraphQL Fragments
const SUBTASK_FRAGMENT = gql`
  fragment SubtaskFields on Task {
    id
    caseId
    type
    title
    description
    assignedTo
    assignee {
      id
      firstName
      lastName
      email
    }
    dueDate
    dueTime
    status
    priority
    estimatedHours
    parentTaskId
    createdBy
    creator {
      id
      firstName
      lastName
    }
    createdAt
    updatedAt
    completedAt
  }
`;

// Queries
const GET_SUBTASKS = gql`
  ${SUBTASK_FRAGMENT}
  query GetSubtasks($parentTaskId: ID!) {
    subtasks(parentTaskId: $parentTaskId) {
      ...SubtaskFields
    }
  }
`;

const GET_MY_SUBTASKS = gql`
  query GetMySubtasks {
    mySubtasks {
      subtask {
        id
        title
        description
        status
        priority
        dueDate
        assignee {
          id
          firstName
          lastName
        }
      }
      parentTask {
        id
        title
        caseId
        caseTitle
        type
      }
    }
  }
`;

// Mutations
const CREATE_SUBTASK = gql`
  ${SUBTASK_FRAGMENT}
  mutation CreateSubtask($input: CreateSubtaskInput!) {
    createSubtask(input: $input) {
      ...SubtaskFields
    }
  }
`;

const TOGGLE_SUBTASK = gql`
  ${SUBTASK_FRAGMENT}
  mutation ToggleSubtask($subtaskId: ID!) {
    toggleSubtask(subtaskId: $subtaskId) {
      ...SubtaskFields
    }
  }
`;

// Input interfaces
export interface CreateSubtaskInput {
  parentTaskId: string;
  title: string;
  description?: string;
  assignedTo?: string;
  dueDate?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  estimatedHours?: number;
}

// Custom Hooks

/**
 * Hook to get subtasks for a parent task
 */
export function useSubtasks(parentTaskId: string) {
  return useQuery<{ subtasks: Task[] }>(GET_SUBTASKS, {
    variables: { parentTaskId },
    skip: !parentTaskId,
  });
}

/**
 * Hook to get all subtasks assigned to current user
 */
export function useMySubtasks() {
  return useQuery<{ mySubtasks: SubtaskWithContext[] }>(GET_MY_SUBTASKS);
}

/**
 * Hook to create a new subtask
 */
export function useCreateSubtask() {
  return useMutation<{ createSubtask: Task }, { input: CreateSubtaskInput }>(CREATE_SUBTASK, {
    refetchQueries: ['GetSubtasks', 'GetTask', 'GetMySubtasks'],
  });
}

/**
 * Hook to toggle subtask completion
 */
export function useToggleSubtask() {
  return useMutation<{ toggleSubtask: Task }, { subtaskId: string }>(TOGGLE_SUBTASK, {
    refetchQueries: ['GetSubtasks', 'GetTask', 'GetMySubtasks'],
  });
}

/**
 * Calculate subtask completion percentage
 */
export function getSubtaskProgress(subtasks: Task[]): number {
  if (subtasks.length === 0) return 0;
  const completed = subtasks.filter((s) => s.status === 'Completed').length;
  return Math.round((completed / subtasks.length) * 100);
}

/**
 * Get summary text for subtasks
 */
export function getSubtaskSummary(subtasks: Task[]): string {
  if (subtasks.length === 0) return 'Fără sub-sarcini';
  const completed = subtasks.filter((s) => s.status === 'Completed').length;
  return `${completed}/${subtasks.length} finalizate`;
}

export type { SubtaskWithContext, ParentTaskContext };
