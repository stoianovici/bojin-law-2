'use client';

import { useQuery, useLazyQuery } from '@apollo/client/react';
import { GET_CASE, GET_CASE_SUMMARY, GET_TASKS_BY_CASE } from '@/graphql/queries';
import type { CaseStatus } from './useCases';

// ============================================
// Types
// ============================================

interface Client {
  id: string;
  name: string;
  contactInfo: Record<string, unknown> | null;
}

interface TeamMember {
  id: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Actor {
  id: string;
  name: string;
  role: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
}

export interface CaseDetail {
  id: string;
  caseNumber: string;
  title: string;
  status: CaseStatus;
  type: string;
  description: string | null;
  openedDate: string | null;
  client: Client | null;
  teamMembers: TeamMember[];
  actors: Actor[];
  keywords: string[] | null;
  referenceNumbers: string[] | null;
  updatedAt: string;
}

export interface CaseSummary {
  id: string;
  executiveSummary: string;
  currentStatus: string;
  keyDevelopments: string[];
  openIssues: string[];
  generatedAt: string;
  isStale: boolean;
}

export interface CaseTask {
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

interface CaseData {
  case: CaseDetail;
}

interface CaseSummaryData {
  caseSummary: CaseSummary | null;
}

interface CaseTasksData {
  tasksByCase: CaseTask[];
}

// ============================================
// Hook
// ============================================

export function useCase(caseId: string) {
  // Fetch case details
  const {
    data: caseData,
    loading: caseLoading,
    error: caseError,
    refetch: refetchCase,
  } = useQuery<CaseData>(GET_CASE, {
    variables: { id: caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  // Fetch case tasks
  const {
    data: tasksData,
    loading: tasksLoading,
    refetch: refetchTasks,
  } = useQuery<CaseTasksData>(GET_TASKS_BY_CASE, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  // Lazy load AI summary (expensive query)
  const [loadSummary, { data: summaryData, loading: summaryLoading, error: summaryError }] =
    useLazyQuery<CaseSummaryData>(GET_CASE_SUMMARY, {
      fetchPolicy: 'cache-and-network',
    });

  // Wrap fetchSummary to pass the caseId
  const fetchSummary = () => {
    if (caseId) {
      loadSummary({ variables: { caseId } });
    }
  };

  // Get lead member
  const leadMember = caseData?.case?.teamMembers.find((m) => m.role === 'Lead');

  // Sort tasks by priority and due date
  const sortedTasks = [...(tasksData?.tasksByCase ?? [])].sort((a, b) => {
    // Priority order: Urgent > High > Normal > Low
    const priorityOrder: Record<string, number> = {
      Urgent: 0,
      High: 1,
      Normal: 2,
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

  // Count tasks by status
  const taskCounts = {
    pending: sortedTasks.filter((t) => t.status === 'Pending' || t.status === 'InProgress').length,
    completed: sortedTasks.filter((t) => t.status === 'Completed').length,
    total: sortedTasks.length,
  };

  const refetch = async () => {
    await Promise.all([refetchCase(), refetchTasks()]);
  };

  // Extract summary with proper type (Apollo may return partial data)
  const summary = summaryData?.caseSummary ? (summaryData.caseSummary as CaseSummary) : null;

  return {
    case: caseData?.case ?? null,
    loading: caseLoading,
    error: caseError,
    leadMember: leadMember ?? null,
    tasks: sortedTasks,
    tasksLoading,
    taskCounts,
    summary,
    summaryLoading,
    summaryError,
    fetchSummary,
    refetch,
  };
}
