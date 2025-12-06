/**
 * Task History React Hooks
 * Story 4.6: Task Collaboration and Updates (AC: 5)
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// Types
interface User {
  id: string;
  firstName: string;
  lastName: string;
}

type TaskHistoryAction =
  | 'Created'
  | 'Updated'
  | 'StatusChanged'
  | 'AssigneeChanged'
  | 'PriorityChanged'
  | 'DueDateChanged'
  | 'CommentAdded'
  | 'CommentEdited'
  | 'CommentDeleted'
  | 'AttachmentAdded'
  | 'AttachmentRemoved'
  | 'SubtaskCreated'
  | 'SubtaskCompleted'
  | 'DependencyAdded'
  | 'DependencyRemoved'
  | 'Delegated';

interface TaskHistoryEntry {
  id: string;
  taskId: string;
  actorId: string;
  actor: User;
  action: TaskHistoryAction;
  field?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// GraphQL Fragments
const HISTORY_FRAGMENT = gql`
  fragment HistoryFields on TaskHistoryEntry {
    id
    taskId
    actorId
    actor {
      id
      firstName
      lastName
    }
    action
    field
    oldValue
    newValue
    metadata
    createdAt
  }
`;

// Queries
const GET_TASK_HISTORY = gql`
  ${HISTORY_FRAGMENT}
  query GetTaskHistory($taskId: ID!, $options: HistoryOptionsInput) {
    taskHistory(taskId: $taskId, options: $options) {
      ...HistoryFields
    }
  }
`;

// Input interfaces
export interface HistoryOptions {
  limit?: number;
  actions?: TaskHistoryAction[];
  since?: string;
  until?: string;
}

// Custom Hooks

/**
 * Hook to get history for a task
 */
export function useTaskHistory(taskId: string, options?: HistoryOptions) {
  return useQuery<{ taskHistory: TaskHistoryEntry[] }>(GET_TASK_HISTORY, {
    variables: { taskId, options },
    skip: !taskId,
  });
}

/**
 * Get human-readable description for a history action
 */
export function getHistoryActionLabel(action: TaskHistoryAction): string {
  const labels: Record<TaskHistoryAction, string> = {
    Created: 'a creat sarcina',
    Updated: 'a actualizat sarcina',
    StatusChanged: 'a schimbat statusul',
    AssigneeChanged: 'a schimbat persoana asignată',
    PriorityChanged: 'a schimbat prioritatea',
    DueDateChanged: 'a schimbat data scadenței',
    CommentAdded: 'a adăugat un comentariu',
    CommentEdited: 'a editat un comentariu',
    CommentDeleted: 'a șters un comentariu',
    AttachmentAdded: 'a adăugat un atașament',
    AttachmentRemoved: 'a eliminat un atașament',
    SubtaskCreated: 'a creat o sub-sarcină',
    SubtaskCompleted: 'a finalizat o sub-sarcină',
    DependencyAdded: 'a adăugat o dependență',
    DependencyRemoved: 'a eliminat o dependență',
    Delegated: 'a delegat sarcina',
  };
  return labels[action] || action;
}

/**
 * Get icon for a history action
 */
export function getHistoryActionIcon(action: TaskHistoryAction): string {
  const icons: Record<TaskHistoryAction, string> = {
    Created: '➕',
    Updated: '✏️',
    StatusChanged: '🔄',
    AssigneeChanged: '👤',
    PriorityChanged: '⚡',
    DueDateChanged: '📅',
    CommentAdded: '💬',
    CommentEdited: '📝',
    CommentDeleted: '🗑️',
    AttachmentAdded: '📎',
    AttachmentRemoved: '📎',
    SubtaskCreated: '📋',
    SubtaskCompleted: '✅',
    DependencyAdded: '🔗',
    DependencyRemoved: '🔗',
    Delegated: '🤝',
  };
  return icons[action] || '📌';
}

export type { TaskHistoryEntry, TaskHistoryAction };
