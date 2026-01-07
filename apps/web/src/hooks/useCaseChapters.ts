/**
 * useCaseChapters Hook
 * Apollo hooks for fetching case chapters and searching case history
 * Supports the Case History Redesign feature
 */

import { useState, useCallback } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';

// ============================================================================
// GraphQL Queries
// ============================================================================

export const GET_CASE_CHAPTERS = gql`
  query GetCaseChapters($caseId: UUID!) {
    caseChapters(caseId: $caseId) {
      id
      phase
      title
      summary
      startDate
      endDate
      generatedAt
      isStale
      events {
        id
        eventType
        title
        summary
        occurredAt
        metadata
      }
    }
    hasChapters(caseId: $caseId)
    caseRawActivities(caseId: $caseId, limit: 100) {
      id
      type
      title
      occurredAt
      metadata {
        documentId
        emailId
        taskId
        context
      }
    }
  }
`;

export const SEARCH_CASE_HISTORY = gql`
  query SearchCaseHistory($caseId: UUID!, $query: String!) {
    searchCaseHistory(caseId: $caseId, query: $query) {
      results {
        eventId
        chapterId
        chapterTitle
        eventTitle
        eventSummary
        occurredAt
        matchSnippet
      }
      totalCount
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

// CasePhase enum matching Prisma schema
export type CasePhase =
  | 'ConsultantaInitiala'
  | 'Negociere'
  | 'DueDiligence'
  | 'PrimaInstanta'
  | 'Apel'
  | 'Executare'
  | 'Mediere'
  | 'Arbitraj'
  | 'Inchis';

export type CaseChapterEventType =
  | 'Document'
  | 'Email'
  | 'Task'
  | 'CourtOutcome'
  | 'ContractSigned'
  | 'Negotiation'
  | 'Deadline'
  | 'ClientDecision'
  | 'TeamChange'
  | 'StatusChange'
  | 'Milestone';

export interface DocumentQuickInfo {
  id: string;
  name: string;
  fileType: string;
  size?: number;
  uploadedAt?: string;
}

export interface EmailQuickInfo {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
}

export interface CaseChapterEvent {
  id: string;
  eventType: CaseChapterEventType;
  title: string;
  summary: string;
  occurredAt: string;
  metadata: {
    documentIds?: string[];
    emailIds?: string[];
    documents?: DocumentQuickInfo[];
    emails?: EmailQuickInfo[];
  };
}

export interface CaseChapter {
  id: string;
  phase: CasePhase;
  title: string;
  summary: string;
  startDate: string | null;
  endDate: string | null;
  generatedAt: string;
  isStale: boolean;
  events: CaseChapterEvent[];
  eventCount: number;
}

export interface SearchResult {
  eventId: string;
  chapterId: string;
  chapterTitle: string;
  eventTitle: string;
  eventSummary: string;
  occurredAt: string;
  matchSnippet: string;
}

// Raw activity types
export type CaseRawActivityType = 'Document' | 'Email' | 'Task';

export interface CaseRawActivityMetadata {
  documentId?: string;
  emailId?: string;
  taskId?: string;
  context?: string;
}

export interface CaseRawActivity {
  id: string;
  type: CaseRawActivityType;
  title: string;
  occurredAt: string;
  metadata: CaseRawActivityMetadata;
}

// Query response types
interface GetCaseChaptersResponse {
  caseChapters: CaseChapter[];
  hasChapters: boolean;
  caseRawActivities: CaseRawActivity[];
}

interface SearchCaseHistoryResponse {
  searchCaseHistory: {
    results: SearchResult[];
    totalCount: number;
  };
}

// ============================================================================
// Hook: useCaseChapters
// ============================================================================

export interface UseCaseChaptersReturn {
  chapters: CaseChapter[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<any>;
  hasChapters: boolean;
  rawActivities: CaseRawActivity[];
}

/**
 * Fetch all chapters for a case with their events
 */
export function useCaseChapters(caseId: string): UseCaseChaptersReturn {
  const { data, loading, error, refetch } = useQuery<GetCaseChaptersResponse>(GET_CASE_CHAPTERS, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  // Map chapters to include eventCount computed from events array
  const chapters: CaseChapter[] = (data?.caseChapters ?? []).map((chapter) => ({
    ...chapter,
    eventCount: chapter.events?.length ?? 0,
  }));

  return {
    chapters,
    loading,
    error: error as Error | undefined,
    refetch,
    hasChapters: data?.hasChapters ?? false,
    rawActivities: data?.caseRawActivities ?? [],
  };
}

// ============================================================================
// Hook: useSearchCaseHistory
// ============================================================================

export interface UseSearchCaseHistoryReturn {
  search: (caseId: string, query: string) => Promise<void>;
  results: SearchResult[];
  totalCount: number;
  loading: boolean;
  error: Error | undefined;
  clearResults: () => void;
}

/**
 * Lazy query for searching case history (only executes when called)
 */
export function useSearchCaseHistory(): UseSearchCaseHistoryReturn {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [executeSearch, { loading, error }] = useLazyQuery<SearchCaseHistoryResponse>(
    SEARCH_CASE_HISTORY,
    { fetchPolicy: 'network-only' }
  );

  const search = useCallback(
    async (caseId: string, query: string): Promise<void> => {
      if (!caseId || !query.trim()) {
        setResults([]);
        setTotalCount(0);
        return;
      }

      const result = await executeSearch({
        variables: { caseId, query: query.trim() },
      });

      if (result.data?.searchCaseHistory) {
        setResults(result.data.searchCaseHistory.results);
        setTotalCount(result.data.searchCaseHistory.totalCount);
      }
    },
    [executeSearch]
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setTotalCount(0);
  }, []);

  return {
    search,
    results,
    totalCount,
    loading,
    error: error as Error | undefined,
    clearResults,
  };
}

export default useCaseChapters;
