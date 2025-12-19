/**
 * Case Events React Hook
 * OPS-050: Overview Tab AI Summary UI
 *
 * Provides hook for fetching paginated case events with importance filtering
 */

import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { useCallback, useEffect, useRef } from 'react';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_CASE_EVENTS = gql`
  query GetCaseEvents($caseId: ID!, $minImportance: EventImportance, $first: Int, $after: String) {
    caseEvents(caseId: $caseId, minImportance: $minImportance, first: $first, after: $after) {
      edges {
        node {
          id
          caseId
          eventType
          sourceId
          title
          description
          importance
          occurredAt
          actor {
            id
            firstName
            lastName
            email
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        endCursor
      }
      totalCount
      countsByCategory {
        all
        documents
        communications
        tasks
      }
    }
  }
`;

const SYNC_CASE_EVENTS = gql`
  mutation SyncCaseEvents($caseId: ID!) {
    syncCaseEvents(caseId: $caseId) {
      created
      skipped
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export type CaseEventType =
  | 'DocumentUploaded'
  | 'DocumentSigned'
  | 'DocumentDeleted'
  | 'EmailReceived'
  | 'EmailSent'
  | 'EmailCourt'
  | 'NoteCreated'
  | 'NoteUpdated'
  | 'TaskCreated'
  | 'TaskCompleted'
  | 'CaseStatusChanged'
  | 'TeamMemberAdded'
  | 'ContactAdded';

export type EventImportance = 'High' | 'Medium' | 'Low';

export interface CaseEventActor {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface CaseEvent {
  id: string;
  caseId: string;
  eventType: CaseEventType;
  sourceId: string;
  title: string;
  description?: string;
  importance: EventImportance;
  occurredAt: string;
  actor?: CaseEventActor;
}

interface CaseEventEdge {
  node: CaseEvent;
  cursor: string;
}

interface CaseEventPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  endCursor?: string;
}

/**
 * Server-side counts by tab category (OPS-055)
 * These are TOTAL counts, not counts of loaded events
 */
export interface CaseEventCounts {
  all: number;
  documents: number;
  communications: number;
  tasks: number;
}

interface CaseEventConnection {
  edges: CaseEventEdge[];
  pageInfo: CaseEventPageInfo;
  totalCount: number;
  countsByCategory: CaseEventCounts;
}

interface GetCaseEventsData {
  caseEvents: CaseEventConnection;
}

interface SyncCaseEventsData {
  syncCaseEvents: {
    created: number;
    skipped: number;
  };
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching paginated case events with importance filtering
 * Auto-syncs events from existing case data on first load if empty
 * Defaults to LOW importance to show all events
 */
export function useCaseEvents(
  caseId: string,
  options?: {
    minImportance?: EventImportance;
    first?: number;
    autoSync?: boolean;
  }
) {
  const { minImportance = 'Low', first = 10, autoSync = true } = options ?? {};
  const hasSyncedRef = useRef(false);

  const { data, loading, error, fetchMore, refetch } = useQuery<GetCaseEventsData>(
    GET_CASE_EVENTS,
    {
      variables: { caseId, minImportance, first },
      skip: !caseId,
      fetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: true,
    }
  );

  const [syncEvents, { loading: syncing }] = useMutation<SyncCaseEventsData>(SYNC_CASE_EVENTS);

  const events = data?.caseEvents?.edges?.map((e) => e.node) ?? [];
  const hasMore = data?.caseEvents?.pageInfo?.hasNextPage ?? false;
  const endCursor = data?.caseEvents?.pageInfo?.endCursor;
  const totalCount = data?.caseEvents?.totalCount ?? 0;
  // OPS-055: Server-side counts for tab badges (not derived from loaded events)
  const countsByCategory = data?.caseEvents?.countsByCategory ?? {
    all: 0,
    documents: 0,
    communications: 0,
    tasks: 0,
  };

  // Auto-sync events on first load
  // OPS-056: Changed to always sync once per component mount (idempotent - skips existing)
  // This ensures newly classified emails get synced even if documents already synced
  useEffect(() => {
    if (autoSync && !hasSyncedRef.current && !loading && caseId) {
      hasSyncedRef.current = true;
      syncEvents({ variables: { caseId } })
        .then((result) => {
          const created = result.data?.syncCaseEvents?.created ?? 0;
          if (created > 0) {
            refetch();
          }
        })
        .catch((err) => {
          console.error('Failed to sync case events:', err);
        });
    }
  }, [autoSync, caseId, loading, syncEvents, refetch]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !endCursor || loading) return;

    try {
      await fetchMore({
        variables: {
          caseId,
          minImportance,
          first,
          after: endCursor,
        },
        updateQuery: (
          prev: GetCaseEventsData,
          { fetchMoreResult }: { fetchMoreResult?: GetCaseEventsData }
        ) => {
          if (!fetchMoreResult) return prev;
          return {
            caseEvents: {
              ...fetchMoreResult.caseEvents,
              edges: [...prev.caseEvents.edges, ...fetchMoreResult.caseEvents.edges],
            },
          };
        },
      });
    } catch (err) {
      console.error('Error loading more case events:', err);
    }
  }, [hasMore, endCursor, loading, fetchMore, caseId, minImportance, first]);

  return {
    events,
    loading: loading || syncing,
    error,
    loadMore,
    hasMore,
    totalCount,
    countsByCategory,
    refetch,
    syncing,
  };
}
