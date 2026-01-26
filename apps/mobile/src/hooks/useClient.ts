'use client';

import { useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  GET_CLIENT,
  GET_TASKS_BY_CLIENT,
  GET_CASE_DOCUMENT_COUNTS,
  GET_CLIENT_INBOX_DOCUMENTS,
} from '@/graphql/queries';
import type { CaseStatus } from './useCases';

// ============================================
// Types
// ============================================

interface TeamMember {
  id: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface ClientCase {
  id: string;
  caseNumber: string;
  title: string;
  status: CaseStatus;
  type: string;
  referenceNumbers: string[] | null;
}

export interface ClientDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  clientType: string | null;
  companyType: string | null;
  cui: string | null;
  caseCount: number;
  activeCaseCount: number;
  cases: ClientCase[];
  teamMembers: TeamMember[];
}

export interface ClientTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface InboxDocument {
  id: string;
  document: {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    status: string;
    sourceType: string;
    uploadedAt: string;
    senderName: string | null;
    senderEmail: string | null;
    thumbnailMedium: string | null;
  };
  linkedAt: string;
  receivedAt: string;
  isOriginal: boolean;
  promotedFromAttachment: boolean;
}

interface CaseDocumentCount {
  caseId: string;
  documentCount: number;
}

interface ClientData {
  client: ClientDetail | null;
}

interface TasksData {
  tasksByClient: ClientTask[];
}

interface DocumentCountsData {
  caseDocumentCounts: CaseDocumentCount[];
}

interface InboxDocumentsData {
  clientInboxDocuments: InboxDocument[];
}

// ============================================
// Hook
// ============================================

export function useClient(clientId: string) {
  // Fetch client details
  const {
    data: clientData,
    loading: clientLoading,
    error: clientError,
    refetch: refetchClient,
  } = useQuery<ClientData>(GET_CLIENT, {
    variables: { id: clientId },
    skip: !clientId,
    fetchPolicy: 'cache-and-network',
  });

  // Fetch client tasks
  const {
    data: tasksData,
    loading: tasksLoading,
    refetch: refetchTasks,
  } = useQuery<TasksData>(GET_TASKS_BY_CLIENT, {
    variables: { clientId },
    skip: !clientId,
    fetchPolicy: 'cache-and-network',
  });

  // Fetch document counts for this client's cases (server-side filtered)
  const {
    data: documentCountsData,
    loading: documentCountsLoading,
    refetch: refetchDocumentCounts,
  } = useQuery<DocumentCountsData>(GET_CASE_DOCUMENT_COUNTS, {
    variables: { clientId },
    skip: !clientId,
    fetchPolicy: 'cache-and-network',
  });

  // Fetch client inbox documents (documents not linked to any case)
  const {
    data: inboxData,
    loading: inboxLoading,
    refetch: refetchInbox,
  } = useQuery<InboxDocumentsData>(GET_CLIENT_INBOX_DOCUMENTS, {
    variables: { clientId },
    skip: !clientId,
    fetchPolicy: 'cache-and-network',
  });

  // Sort tasks by priority and due date - memoized
  const sortedTasks = useMemo(() => {
    return [...(tasksData?.tasksByClient ?? [])].sort((a, b) => {
      // Priority order: Urgent > High > Medium > Low
      const priorityOrder: Record<string, number> = {
        Urgent: 0,
        High: 1,
        Medium: 2,
        Low: 3,
      };
      const priorityDiff = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
      if (priorityDiff !== 0) return priorityDiff;

      // Then by due date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  }, [tasksData?.tasksByClient]);

  // Count tasks by status - memoized
  const taskCounts = useMemo(() => {
    return {
      pending: sortedTasks.filter((t) => t.status === 'Pending' || t.status === 'InProgress')
        .length,
      completed: sortedTasks.filter((t) => t.status === 'Completed').length,
      total: sortedTasks.length,
    };
  }, [sortedTasks]);

  // Build document counts map - server already filters to this client's cases
  const documentCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    documentCountsData?.caseDocumentCounts?.forEach((count) => {
      map.set(count.caseId, count.documentCount);
    });
    return map;
  }, [documentCountsData?.caseDocumentCounts]);

  // Get inbox documents
  const inboxDocuments = inboxData?.clientInboxDocuments ?? [];

  // Total documents = case docs + inbox docs - memoized
  const totalDocumentCount = useMemo(() => {
    const caseDocsCount = Array.from(documentCountsMap.values()).reduce((a, b) => a + b, 0);
    return caseDocsCount + inboxDocuments.length;
  }, [documentCountsMap, inboxDocuments.length]);

  // Enrich cases with document counts - memoized
  const casesWithDocuments = useMemo(() => {
    return (clientData?.client?.cases ?? []).map((c) => ({
      ...c,
      documentCount: documentCountsMap.get(c.id) ?? 0,
    }));
  }, [clientData?.client?.cases, documentCountsMap]);

  const refetch = async () => {
    await Promise.all([refetchClient(), refetchTasks(), refetchDocumentCounts(), refetchInbox()]);
  };

  return {
    client: clientData?.client ?? null,
    loading: clientLoading,
    error: clientError,
    tasks: sortedTasks,
    tasksLoading,
    taskCounts,
    casesWithDocuments,
    inboxDocuments,
    documentsLoading: documentCountsLoading || inboxLoading,
    totalDocumentCount,
    refetch,
  };
}
