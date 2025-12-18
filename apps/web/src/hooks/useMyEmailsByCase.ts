/**
 * useMyEmailsByCase Hook
 * OPS-041: /communications Case-Organized Redesign
 *
 * Provides email data organized by case for the case-organized /communications page.
 * Combines existing queries to structure data for the sidebar view.
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useMemo } from 'react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const EMAIL_ADDRESS_FRAGMENT = gql`
  fragment EmailAddressFieldsCase on EmailAddress {
    name
    address
  }
`;

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
      from {
        ...EmailAddressFieldsCase
      }
      receivedDateTime
      sentDateTime
      isRead
      hasAttachments
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

export interface ThreadPreview {
  id: string;
  conversationId: string;
  subject: string;
  lastMessageDate: string;
  messageCount: number;
  hasUnread: boolean;
  hasAttachments: boolean;
  latestFrom?: EmailAddress;
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
  // Load all threads by default (no practical limit)
  const { limit = 10000 } = options || {};

  // Fetch all email threads
  const {
    data: threadsData,
    loading: threadsLoading,
    error: threadsError,
    refetch: refetchThreads,
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
        from: EmailAddress;
        receivedDateTime: string;
        sentDateTime: string;
        isRead: boolean;
        hasAttachments: boolean;
      }>;
    }>;
  }>(GET_EMAIL_THREADS_BY_CASE, {
    variables: { limit, offset: 0 },
    fetchPolicy: 'cache-and-network',
  });

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

  // Transform data into case-organized structure
  const organizedData = useMemo<MyEmailsByCase>(() => {
    const threads = threadsData?.emailThreads || [];

    // Group threads by case
    const caseMap = new Map<string, CaseWithThreads>();
    const unassignedThreads: ThreadPreview[] = [];

    for (const thread of threads) {
      const threadPreview: ThreadPreview = {
        id: thread.id,
        conversationId: thread.conversationId,
        subject: thread.subject,
        lastMessageDate: thread.lastMessageDate,
        messageCount: thread.messageCount,
        hasUnread: thread.hasUnread,
        hasAttachments: thread.hasAttachments,
        latestFrom: thread.emails[thread.emails.length - 1]?.from,
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
  };
}

export default useMyEmailsByCase;
