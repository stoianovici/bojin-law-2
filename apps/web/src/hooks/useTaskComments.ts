/**
 * Task Comments React Hooks
 * Story 4.6: Task Collaboration and Updates (AC: 1)
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';

// Types
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  author: User;
  content: string;
  parentId?: string;
  mentions: string[];
  mentionedUsers: User[];
  replies: TaskComment[];
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
}

// GraphQL Fragments
const COMMENT_FRAGMENT = gql`
  fragment CommentFields on TaskComment {
    id
    taskId
    authorId
    author {
      id
      firstName
      lastName
      email
    }
    content
    parentId
    mentions
    mentionedUsers {
      id
      firstName
      lastName
    }
    createdAt
    updatedAt
    editedAt
  }
`;

// Queries
const GET_TASK_COMMENTS = gql`
  ${COMMENT_FRAGMENT}
  query GetTaskComments($taskId: ID!) {
    taskComments(taskId: $taskId) {
      ...CommentFields
      replies {
        ...CommentFields
      }
    }
  }
`;

const GET_TASK_COMMENT = gql`
  ${COMMENT_FRAGMENT}
  query GetTaskComment($commentId: ID!) {
    taskComment(commentId: $commentId) {
      ...CommentFields
      replies {
        ...CommentFields
      }
    }
  }
`;

// Mutations
const CREATE_TASK_COMMENT = gql`
  ${COMMENT_FRAGMENT}
  mutation CreateTaskComment($input: CreateTaskCommentInput!) {
    createTaskComment(input: $input) {
      ...CommentFields
    }
  }
`;

const UPDATE_TASK_COMMENT = gql`
  ${COMMENT_FRAGMENT}
  mutation UpdateTaskComment($commentId: ID!, $input: UpdateTaskCommentInput!) {
    updateTaskComment(commentId: $commentId, input: $input) {
      ...CommentFields
    }
  }
`;

const DELETE_TASK_COMMENT = gql`
  mutation DeleteTaskComment($commentId: ID!) {
    deleteTaskComment(commentId: $commentId)
  }
`;

// Input interfaces
export interface CreateCommentInput {
  taskId: string;
  content: string;
  parentId?: string;
}

export interface UpdateCommentInput {
  content: string;
}

// Custom Hooks

/**
 * Hook to get all comments for a task
 */
export function useTaskComments(taskId: string) {
  return useQuery<{ taskComments: TaskComment[] }>(GET_TASK_COMMENTS, {
    variables: { taskId },
    skip: !taskId,
  });
}

/**
 * Hook to get a single comment by ID
 */
export function useTaskComment(commentId: string) {
  return useQuery<{ taskComment: TaskComment }>(GET_TASK_COMMENT, {
    variables: { commentId },
    skip: !commentId,
  });
}

/**
 * Hook to create a new comment
 */
export function useCreateTaskComment() {
  return useMutation<{ createTaskComment: TaskComment }, { input: CreateCommentInput }>(
    CREATE_TASK_COMMENT,
    {
      refetchQueries: ['GetTaskComments'],
    }
  );
}

/**
 * Hook to update a comment
 */
export function useUpdateTaskComment() {
  return useMutation<
    { updateTaskComment: TaskComment },
    { commentId: string; input: UpdateCommentInput }
  >(UPDATE_TASK_COMMENT, {
    refetchQueries: ['GetTaskComments'],
  });
}

/**
 * Hook to delete a comment
 */
export function useDeleteTaskComment() {
  return useMutation<{ deleteTaskComment: boolean }, { commentId: string }>(DELETE_TASK_COMMENT, {
    refetchQueries: ['GetTaskComments'],
  });
}

/**
 * Parse @mentions from content
 * Returns array of usernames mentioned
 */
export function parseMentions(content: string): string[] {
  const mentionRegex = /@[\w.-]+/g;
  const matches = content.match(mentionRegex);
  return matches ? matches.map((m) => m.substring(1)) : [];
}

export type { TaskComment, User };
