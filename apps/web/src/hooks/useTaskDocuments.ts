/**
 * Task Document Linking React Hooks
 * Story 4.2: Task Type System Implementation - Research Tasks
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';

// GraphQL Operations
const TASK_DOCUMENT_LINK_FRAGMENT = gql`
  fragment TaskDocumentLinkFields on TaskDocumentLink {
    id
    taskId
    documentId
    document {
      id
      title
      fileType
      caseId
    }
    linkType
    notes
    linkedBy {
      id
      firstName
      lastName
    }
    linkedAt
  }
`;

const GET_TASK_DOCUMENTS = gql`
  ${TASK_DOCUMENT_LINK_FRAGMENT}
  query GetTaskDocuments($taskId: ID!) {
    task(id: $taskId) {
      id
      linkedDocuments {
        ...TaskDocumentLinkFields
      }
    }
  }
`;

const LINK_DOCUMENT_TO_TASK = gql`
  ${TASK_DOCUMENT_LINK_FRAGMENT}
  mutation LinkDocumentToTask($taskId: ID!, $input: LinkDocumentInput!) {
    linkDocumentToTask(taskId: $taskId, input: $input) {
      ...TaskDocumentLinkFields
    }
  }
`;

const UNLINK_DOCUMENT_FROM_TASK = gql`
  mutation UnlinkDocumentFromTask($taskId: ID!, $documentId: ID!) {
    unlinkDocumentFromTask(taskId: $taskId, documentId: $documentId)
  }
`;

// Interfaces
export type TaskDocumentLinkType = 'Source' | 'Output' | 'Reference';

export interface TaskDocumentLink {
  id: string;
  taskId: string;
  documentId: string;
  document: {
    id: string;
    title: string;
    fileType: string;
    caseId: string;
  };
  linkType: TaskDocumentLinkType;
  notes?: string;
  linkedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  linkedAt: Date;
}

export interface LinkDocumentInput {
  documentId: string;
  linkType: TaskDocumentLinkType;
  notes?: string;
}

// Custom Hooks

/**
 * Hook to get documents linked to a task
 */
export function useTaskDocuments(taskId: string) {
  return useQuery<{ task: { id: string; linkedDocuments: TaskDocumentLink[] } }>(
    GET_TASK_DOCUMENTS,
    {
      variables: { taskId },
      skip: !taskId,
    }
  );
}

/**
 * Hook to link a document to a task
 */
export function useLinkDocumentToTask() {
  return useMutation<
    { linkDocumentToTask: TaskDocumentLink },
    { taskId: string; input: LinkDocumentInput }
  >(LINK_DOCUMENT_TO_TASK, {
    refetchQueries: ['GetTaskDocuments', 'GetTask'],
  });
}

/**
 * Hook to unlink a document from a task
 */
export function useUnlinkDocumentFromTask() {
  return useMutation<
    { unlinkDocumentFromTask: boolean },
    { taskId: string; documentId: string }
  >(UNLINK_DOCUMENT_FROM_TASK, {
    refetchQueries: ['GetTaskDocuments', 'GetTask'],
  });
}
