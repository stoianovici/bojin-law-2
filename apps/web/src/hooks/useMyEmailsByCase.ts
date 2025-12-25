/**
 * useMyEmailsByCase Hook
 * OPS-041: /communications Case-Organized Redesign
 *
 * Provides email data organized by case for the case-organized /communications page.
 * Combines existing queries to structure data for the sidebar view.
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useMemo, useState, useCallback, useEffect } from 'react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const EMAIL_ADDRESS_FRAGMENT = gql`
  fragment EmailAddressFieldsCase on EmailAddress {
    name
    address
  }
`;

// OPS-130: Lightweight fragment for list view - excludes heavy body content fields
// Full content (bodyContent, bodyContentClean) is fetched separately via useEmailThread
// when a thread is selected for viewing
const EMAIL_THREAD_FRAGMENT = gql`
  ${EMAIL_ADDRESS_FRAGMENT}
  fragment EmailThreadFieldsCase on EmailThread {
    id
    conversationId
    subject
    participantCount
    messageCount
    hasUnread
    hasAttachments
    lastMessageDate
    firstMessageDate
    case {
      id
      title
      caseNumber
    }
    emails {
      id
      subject
      bodyPreview
      folderType
      from {
        ...EmailAddressFieldsCase
      }
      receivedDateTime
      sentDateTime
      isRead
      hasAttachments
      # OPS-062: Multi-case support
      caseLinks {
        id
        caseId
        confidence
        matchType
        linkedAt
        linkedBy
        isPrimary
        case {
          id
          title
          caseNumber
        }
      }
    }
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_EMAIL_THREADS_BY_CASE = gql`
  ${EMAIL_THREAD_FRAGMENT}
  query GetEmailThreadsByCase($limit: Int, $offset: Int) {
    emailThreads(limit: $limit, offset: $offset) {
      ...EmailThreadFieldsCase
    }
  }
`;

const GET_UNASSIGNED_COURT_EMAILS = gql`
  ${EMAIL_ADDRESS_FRAGMENT}
  query GetUnassignedCourtEmails($limit: Int, $offset: Int) {
    unassignedCourtEmails(limit: $limit, offset: $offset) {
      id
      subject
      from {
        ...EmailAddressFieldsCase
      }
      receivedDateTime
      extractedReferences
      suggestedCases {
        id
        caseNumber
        title
        referenceNumbers
      }
      institutionCategory
      bodyPreview
    }
    unassignedCourtEmailsCount
  }
`;

const GET_UNCERTAIN_EMAILS = gql`
  ${EMAIL_ADDRESS_FRAGMENT}
  query GetUncertainEmailsForSidebar($limit: Int, $offset: Int) {
    uncertainEmails(limit: $limit, offset: $offset) {
      id
      conversationId
      subject
      from {
        ...EmailAddressFieldsCase
      }
      receivedDateTime
      bodyPreview
      suggestedCases {
        id
        caseNumber
        title
        score
      }
      uncertaintyReason
    }
    uncertainEmailsCount
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface EmailAddress {
  name?: string;
  address: string;
}

// OPS-062: Multi-case support types
export interface CaseReference {
  id: string;
  title: string;
  caseNumber: string;
}

export interface ThreadCaseLink {
  id: string;
  caseId: string;
  confidence: number | null;
  matchType: string | null;
  linkedAt: string;
  linkedBy: string;
  isPrimary: boolean;
  case: CaseReference;
}

export interface ThreadPreview {
  id: string;
  conversationId: string;
  subject: string;
  lastMessageDate: string;
  messageCount: number;
  hasUnread: boolean;
  hasAttachments: boolean;
  latestFrom?: EmailAddress;
  // OPS-062: Aggregated case links from all emails in thread
  allCaseLinks?: ThreadCaseLink[];
  // Count of unique cases this thread's emails are linked to
  linkedCasesCount?: number;
}

export interface CaseWithThreads {
  id: string;
  title: string;
  caseNumber: string;
  threads: ThreadPreview[];
  unreadCount: number;
  totalThreads: number;
}

export interface UnassignedCourtEmail {
  id: string;
  subject: string;
  from: EmailAddress;
  receivedDateTime: string;
  extractedReferences: string[];
  suggestedCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    referenceNumbers: string[];
  }>;
  institutionCategory?: string;
  bodyPreview: string;
}

export interface UncertainEmail {
  id: string;
  conversationId?: string; // OPS-200: For thread view loading
  subject: string;
  from: EmailAddress;
  receivedDateTime: string;
  bodyPreview: string;
  suggestedCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    score: number;
  }>;
  uncertaintyReason?: string;
}

export interface MyEmailsByCase {
  cases: CaseWithThreads[];
  unassignedCase: CaseWithThreads | null; // Threads without case assignment
  courtUnassigned: UnassignedCourtEmail[];
  courtUnassignedCount: number;
  uncertain: UncertainEmail[];
  uncertainCount: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useMyEmailsByCase(options?: { limit?: number }) {
  // OPS-129: Limit initial load to 50 threads for performance
  const { limit = 50 } = options || {};

  // OPS-132: Track whether more threads exist beyond current loaded set
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch all email threads
  const {
    data: threadsData,
    loading: threadsLoading,
    error: threadsError,
    refetch: refetchThreads,
    fetchMore,
    // OPS-130: Type reflects lightweight list fragment - no bodyContent/bodyContentClean
  } = useQuery<{
    emailThreads: Array<{
      id: string;
      conversationId: string;
      subject: string;
      participantCount: number;
      messageCount: number;
      hasUnread: boolean;
      hasAttachments: boolean;
      lastMessageDate: string;
      firstMessageDate: string;
      case: { id: string; title: string; caseNumber: string } | null;
      emails: Array<{
        id: string;
        subject: string;
        bodyPreview: string;
        folderType?: string | null; // OPS-126: 'inbox' or 'sent'
        from: EmailAddress;
        receivedDateTime: string;
        sentDateTime: string;
        isRead: boolean;
        hasAttachments: boolean;
        // OPS-062: Multi-case support
        caseLinks?: Array<{
          id: string;
          caseId: string;
          confidence: number | null;
          matchType: string | null;
          linkedAt: string;
          linkedBy: string;
          isPrimary: boolean;
          case: { id: string; title: string; caseNumber: string };
        }>;
      }>;
    }>;
  }>(GET_EMAIL_THREADS_BY_CASE, {
    variables: { limit, offset: 0 },
    fetchPolicy: 'cache-and-network',
  });

  // OPS-132: Track if more threads exist based on initial fetch
  useEffect(() => {
    if (threadsData?.emailThreads && !threadsLoading) {
      // If we got fewer threads than the limit, there are no more to load
      // This handles the initial load case
      if (threadsData.emailThreads.length < limit && threadsData.emailThreads.length > 0) {
        setHasMore(false);
      }
    }
  }, [threadsData?.emailThreads?.length, threadsLoading, limit]);

  // Helper function to aggregate case links from all emails in a thread
  const aggregateCaseLinks = (
    emails: Array<{
      caseLinks?: Array<{
        id: string;
        caseId: string;
        confidence: number | null;
        matchType: string | null;
        linkedAt: string;
        linkedBy: string;
        isPrimary: boolean;
        case: { id: string; title: string; caseNumber: string };
      }>;
    }>
  ): { allCaseLinks: ThreadCaseLink[]; linkedCasesCount: number } => {
    const caseLinksMap = new Map<string, ThreadCaseLink>();

    for (const email of emails) {
      for (const link of email.caseLinks || []) {
        // Use caseId as key to dedupe across emails in thread
        if (!caseLinksMap.has(link.caseId)) {
          caseLinksMap.set(link.caseId, link);
        } else {
          // If this link is primary and existing one isn't, prefer this one
          const existing = caseLinksMap.get(link.caseId)!;
          if (link.isPrimary && !existing.isPrimary) {
            caseLinksMap.set(link.caseId, link);
          }
        }
      }
    }

    const allCaseLinks = Array.from(caseLinksMap.values());
    return {
      allCaseLinks,
      linkedCasesCount: allCaseLinks.length,
    };
  };

  // Fetch unassigned court emails (INSTANȚE)
  const {
    data: courtData,
    loading: courtLoading,
    error: courtError,
    refetch: refetchCourt,
  } = useQuery<{
    unassignedCourtEmails: UnassignedCourtEmail[];
    unassignedCourtEmailsCount: number;
  }>(GET_UNASSIGNED_COURT_EMAILS, {
    variables: { limit: 50, offset: 0 },
    fetchPolicy: 'cache-and-network',
  });

  // Fetch uncertain emails (NECLAR)
  const {
    data: uncertainData,
    loading: uncertainLoading,
    error: uncertainError,
    refetch: refetchUncertain,
  } = useQuery<{
    uncertainEmails: UncertainEmail[];
    uncertainEmailsCount: number;
  }>(GET_UNCERTAIN_EMAILS, {
    variables: { limit: 50, offset: 0 },
    fetchPolicy: 'cache-and-network',
  });

  // OPS-132: Load more threads callback
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || threadsLoading) return;

    const currentCount = threadsData?.emailThreads.length || 0;
    setLoadingMore(true);

    try {
      await fetchMore({
        variables: { offset: currentCount, limit },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;

          // Check if we got fewer than limit - means no more to load
          if (fetchMoreResult.emailThreads.length < limit) {
            setHasMore(false);
          }

          // Merge new threads with existing ones
          return {
            ...prev,
            emailThreads: [...prev.emailThreads, ...fetchMoreResult.emailThreads],
          };
        },
      });
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, threadsLoading, threadsData, fetchMore, limit]);

  // Transform data into case-organized structure
  const organizedData = useMemo<MyEmailsByCase>(() => {
    const threads = threadsData?.emailThreads || [];

    // Group threads by case
    const caseMap = new Map<string, CaseWithThreads>();
    const unassignedThreads: ThreadPreview[] = [];

    for (const thread of threads) {
      // OPS-062: Aggregate case links from all emails in thread
      const { allCaseLinks, linkedCasesCount } = aggregateCaseLinks(thread.emails);

      const threadPreview: ThreadPreview = {
        id: thread.id,
        conversationId: thread.conversationId,
        subject: thread.subject,
        lastMessageDate: thread.lastMessageDate,
        messageCount: thread.messageCount,
        hasUnread: thread.hasUnread,
        hasAttachments: thread.hasAttachments,
        latestFrom: thread.emails[thread.emails.length - 1]?.from,
        // OPS-062: Multi-case support
        allCaseLinks,
        linkedCasesCount,
      };

      if (thread.case) {
        const caseId = thread.case.id;
        if (!caseMap.has(caseId)) {
          caseMap.set(caseId, {
            id: caseId,
            title: thread.case.title,
            caseNumber: thread.case.caseNumber,
            threads: [],
            unreadCount: 0,
            totalThreads: 0,
          });
        }

        const caseData = caseMap.get(caseId)!;
        caseData.threads.push(threadPreview);
        caseData.totalThreads += 1;
        if (thread.hasUnread) {
          caseData.unreadCount += 1;
        }
      } else {
        unassignedThreads.push(threadPreview);
      }
    }

    // Sort threads within each case by lastMessageDate (most recent first)
    for (const caseData of caseMap.values()) {
      caseData.threads.sort(
        (a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()
      );
    }

    // Convert map to array and sort cases by most recent activity
    const cases = Array.from(caseMap.values()).sort((a, b) => {
      const aLatest = a.threads[0]?.lastMessageDate || '';
      const bLatest = b.threads[0]?.lastMessageDate || '';
      return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    });

    // Create unassigned case entry if there are unassigned threads
    const unassignedCase: CaseWithThreads | null =
      unassignedThreads.length > 0
        ? {
            id: 'unassigned',
            title: 'Neatribuit',
            caseNumber: '',
            threads: unassignedThreads.sort(
              (a, b) =>
                new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()
            ),
            unreadCount: unassignedThreads.filter((t) => t.hasUnread).length,
            totalThreads: unassignedThreads.length,
          }
        : null;

    return {
      cases,
      unassignedCase,
      courtUnassigned: courtData?.unassignedCourtEmails || [],
      courtUnassignedCount: courtData?.unassignedCourtEmailsCount || 0,
      uncertain: uncertainData?.uncertainEmails || [],
      uncertainCount: uncertainData?.uncertainEmailsCount || 0,
    };
  }, [threadsData, courtData, uncertainData]);

  // Combined refetch function
  const refetch = async () => {
    await Promise.all([refetchThreads(), refetchCourt(), refetchUncertain()]);
  };

  return {
    data: organizedData,
    loading: threadsLoading || courtLoading || uncertainLoading,
    error: threadsError || courtError || uncertainError,
    refetch,
    // OPS-132: Load more support
    loadMore,
    hasMore,
    loadingMore,
  };
}

export default useMyEmailsByCase;
