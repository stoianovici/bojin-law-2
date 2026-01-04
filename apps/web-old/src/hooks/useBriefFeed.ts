/**
 * Brief Feed Hook
 * OPS-298: Mobile Home - Fresh Build
 *
 * Fetches the company-wide activity feed for the mobile home screen.
 * Returns recent emails (received/sent) and documents (uploaded/approved).
 */

import { useMemo } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// ============================================================================
// Types
// ============================================================================

export type BriefItemType =
  | 'EMAIL_RECEIVED'
  | 'EMAIL_SENT'
  | 'DOCUMENT_RECEIVED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_UPLOADED'
  | 'NOTE_ADDED'
  | 'DEADLINE_SET';

export interface BriefItem {
  id: string;
  type: BriefItemType;
  title: string;
  subtitle: string | null;
  preview: string | null;
  caseName: string | null;
  caseId: string | null;
  actorName: string | null;
  actorId: string | null;
  entityType: string;
  entityId: string;
  occurredAt: string;
  relativeTime: string;
}

export interface BriefFeedResult {
  items: BriefItem[];
  totalCount: number;
  hasMore: boolean;
  loading: boolean;
  error?: Error;
  refetch: () => void;
  fetchMore: () => void;
}

export interface BriefFeedInput {
  limit?: number;
  offset?: number;
}

// ============================================================================
// GraphQL Query
// ============================================================================

const GET_BRIEF_FEED = gql`
  query GetBriefFeed($input: BriefFeedInput) {
    briefFeed(input: $input) {
      items {
        id
        type
        title
        subtitle
        preview
        caseName
        caseId
        actorName
        actorId
        entityType
        entityId
        occurredAt
        relativeTime
      }
      totalCount
      hasMore
    }
  }
`;

interface GetBriefFeedResult {
  briefFeed: {
    items: BriefItem[];
    totalCount: number;
    hasMore: boolean;
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useBriefFeed(input?: BriefFeedInput): BriefFeedResult {
  const variables = useMemo(
    () => ({
      input: {
        limit: input?.limit ?? 20,
        offset: input?.offset ?? 0,
      },
    }),
    [input?.limit, input?.offset]
  );

  const { data, loading, error, refetch, fetchMore } = useQuery<GetBriefFeedResult>(
    GET_BRIEF_FEED,
    {
      variables,
      fetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: true,
    }
  );

  const result = useMemo(() => {
    return {
      items: data?.briefFeed?.items || [],
      totalCount: data?.briefFeed?.totalCount || 0,
      hasMore: data?.briefFeed?.hasMore || false,
    };
  }, [data]);

  const handleFetchMore = () => {
    if (!result.hasMore || loading) return;

    fetchMore({
      variables: {
        input: {
          limit: variables.input.limit,
          offset: result.items.length,
        },
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          briefFeed: {
            ...fetchMoreResult.briefFeed,
            items: [...prev.briefFeed.items, ...fetchMoreResult.briefFeed.items],
          },
        };
      },
    });
  };

  return {
    ...result,
    loading,
    error: error as Error | undefined,
    refetch,
    fetchMore: handleFetchMore,
  };
}

// ============================================================================
// Icon Helpers
// ============================================================================

/**
 * Get icon for brief item type
 */
export function getBriefItemIcon(type: BriefItemType): string {
  switch (type) {
    case 'EMAIL_RECEIVED':
      return '📨';
    case 'EMAIL_SENT':
      return '📤';
    case 'DOCUMENT_RECEIVED':
      return '📄';
    case 'DOCUMENT_APPROVED':
      return '✅';
    case 'DOCUMENT_UPLOADED':
      return '📁';
    case 'NOTE_ADDED':
      return '📝';
    case 'DEADLINE_SET':
      return '⏰';
    default:
      return '📌';
  }
}

/**
 * Get color class for brief item type
 */
export function getBriefItemColor(type: BriefItemType): string {
  switch (type) {
    case 'EMAIL_RECEIVED':
      return 'bg-blue-50 border-blue-200';
    case 'EMAIL_SENT':
      return 'bg-green-50 border-green-200';
    case 'DOCUMENT_APPROVED':
      return 'bg-emerald-50 border-emerald-200';
    case 'DOCUMENT_UPLOADED':
    case 'DOCUMENT_RECEIVED':
      return 'bg-purple-50 border-purple-200';
    case 'NOTE_ADDED':
      return 'bg-yellow-50 border-yellow-200';
    case 'DEADLINE_SET':
      return 'bg-red-50 border-red-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
}
