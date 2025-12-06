/**
 * Task Management React Hooks
 * Story 4.2: Task Type System Implementation
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import type { Task, TaskType, TaskPriority, TaskTypeMetadata } from '@legal-platform/types';

// GraphQL Fragments
const TASK_FRAGMENT = gql`
  fragment TaskFields on Task {
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
    typeMetadata
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
const GET_TASK = gql`
  ${TASK_FRAGMENT}
  query GetTask($id: ID!) {
    task(id: $id) {
      ...TaskFields
      subtasks {
        ...TaskFields
      }
    }
  }
`;

const GET_TASKS = gql`
  ${TASK_FRAGMENT}
  query GetTasks($filters: TaskFilterInput, $limit: Int, $offset: Int) {
    tasks(filters: $filters, limit: $limit, offset: $offset) {
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

const GET_MY_TASKS = gql`
  ${TASK_FRAGMENT}
  query GetMyTasks($filters: TaskFilterInput) {
    myTasks(filters: $filters) {
      ...TaskFields
    }
  }
`;

// Mutations
const CREATE_TASK = gql`
  ${TASK_FRAGMENT}
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      ...TaskFields
    }
  }
`;

const UPDATE_TASK = gql`
  ${TASK_FRAGMENT}
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      ...TaskFields
    }
  }
`;

const COMPLETE_TASK = gql`
  ${TASK_FRAGMENT}
  mutation CompleteTask($id: ID!) {
    completeTask(id: $id) {
      ...TaskFields
    }
  }
`;

const CANCEL_TASK = gql`
  ${TASK_FRAGMENT}
  mutation CancelTask($id: ID!, $reason: String) {
    cancelTask(id: $id, reason: $reason) {
      ...TaskFields
    }
  }
`;

const DELETE_TASK = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;

// Interfaces
export interface CreateTaskInput {
  caseId: string;
  type: TaskType;
  title: string;
  description?: string;
  assignedTo: string;
  dueDate: string;
  dueTime?: string;
  priority?: TaskPriority;
  estimatedHours?: number;
  typeMetadata?: TaskTypeMetadata;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignedTo?: string;
  dueDate?: string;
  dueTime?: string;
  status?: 'Pending' | 'InProgress' | 'Completed' | 'Cancelled';
  priority?: TaskPriority;
  estimatedHours?: number;
  typeMetadata?: TaskTypeMetadata;
}

export interface TaskFilters {
  types?: TaskType[];
  statuses?: Array<'Pending' | 'InProgress' | 'Completed' | 'Cancelled'>;
  priorities?: TaskPriority[];
  assignedTo?: string[];
  caseId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  searchQuery?: string;
}

// Custom Hooks

/**
 * Hook to get a single task by ID
 */
export function useTask(id: string) {
  return useQuery<{ task: Task }>(GET_TASK, {
    variables: { id },
    skip: !id,
  });
}

/**
 * Hook to get tasks with optional filters
 */
export function useTasks(filters?: TaskFilters, limit?: number, offset?: number) {
  return useQuery<{ tasks: Task[] }>(GET_TASKS, {
    variables: { filters, limit, offset },
  });
}

/**
 * Hook to get tasks for a specific case
 */
export function useTasksByCase(caseId: string, filters?: TaskFilters) {
  return useQuery<{ tasksByCase: Task[] }>(GET_TASKS_BY_CASE, {
    variables: { caseId, filters },
    skip: !caseId,
  });
}

/**
 * Hook to get current user's tasks
 */
export function useMyTasks(filters?: TaskFilters) {
  return useQuery<{ myTasks: Task[] }>(GET_MY_TASKS, {
    variables: { filters },
  });
}

/**
 * Hook to create a new task
 */
export function useCreateTask() {
  return useMutation<{ createTask: Task }, { input: CreateTaskInput }>(CREATE_TASK, {
    refetchQueries: ['GetMyTasks', 'GetTasksByCase', 'GetTasks'],
  });
}

/**
 * Hook to update a task
 */
export function useUpdateTask() {
  return useMutation<{ updateTask: Task }, { id: string; input: UpdateTaskInput }>(UPDATE_TASK, {
    refetchQueries: ['GetTask', 'GetMyTasks', 'GetTasksByCase'],
  });
}

/**
 * Hook to mark a task as complete
 */
export function useCompleteTask() {
  return useMutation<{ completeTask: Task }, { id: string }>(COMPLETE_TASK, {
    refetchQueries: ['GetTask', 'GetMyTasks', 'GetTasksByCase'],
  });
}

/**
 * Hook to cancel a task
 */
export function useCancelTask() {
  return useMutation<{ cancelTask: Task }, { id: string; reason?: string }>(CANCEL_TASK, {
    refetchQueries: ['GetTask', 'GetMyTasks', 'GetTasksByCase'],
  });
}

/**
 * Hook to delete a task
 */
export function useDeleteTask() {
  return useMutation<{ deleteTask: boolean }, { id: string }>(DELETE_TASK, {
    refetchQueries: ['GetMyTasks', 'GetTasksByCase', 'GetTasks'],
  });
}
