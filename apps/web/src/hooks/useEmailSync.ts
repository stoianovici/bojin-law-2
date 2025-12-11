/**
 * Email Synchronization React Hooks
 * Story 5.1: Email Integration and Synchronization
 *
 * Provides hooks for email sync, threading, search, and categorization
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery, useSubscription } from '@apollo/client/react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const EMAIL_ADDRESS_FRAGMENT = gql`
  fragment EmailAddressFields on EmailAddress {
    name
    address
  }
`;

const EMAIL_FRAGMENT = gql`
  ${EMAIL_ADDRESS_FRAGMENT}
  fragment EmailFields on Email {
    id
    graphMessageId
    conversationId
    subject
    bodyPreview
    bodyContent
    bodyContentType
    from {
      ...EmailAddressFields
    }
    toRecipients {
      ...EmailAddressFields
    }
    ccRecipients {
      ...EmailAddressFields
    }
    receivedDateTime
    sentDateTime
    hasAttachments
    importance
    isRead
    case {
      id
      title
      caseNumber
    }
    attachments {
      id
      name
      contentType
      size
      downloadUrl
    }
  }
`;

const EMAIL_THREAD_FRAGMENT = gql`
  ${EMAIL_FRAGMENT}
  fragment EmailThreadFields on EmailThread {
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
      ...EmailFields
    }
  }
`;

const SYNC_STATUS_FRAGMENT = gql`
  fragment SyncStatusFields on EmailSyncStatus {
    status
    lastSyncAt
    emailCount
    pendingCategorization
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_EMAILS = gql`
  ${EMAIL_FRAGMENT}
  query GetEmails($filters: EmailFilters, $limit: Int, $offset: Int) {
    emails(filters: $filters, limit: $limit, offset: $offset) {
      emails {
        ...EmailFields
      }
      totalCount
      hasMore
    }
  }
`;

const GET_EMAIL = gql`
  ${EMAIL_FRAGMENT}
  query GetEmail($id: ID!) {
    email(id: $id) {
      ...EmailFields
    }
  }
`;

const GET_EMAIL_THREADS = gql`
  ${EMAIL_THREAD_FRAGMENT}
  query GetEmailThreads($filters: EmailThreadFilters, $limit: Int, $offset: Int) {
    emailThreads(filters: $filters, limit: $limit, offset: $offset) {
      ...EmailThreadFields
    }
  }
`;

const GET_EMAIL_THREAD = gql`
  ${EMAIL_THREAD_FRAGMENT}
  query GetEmailThread($conversationId: String!) {
    emailThread(conversationId: $conversationId) {
      ...EmailThreadFields
    }
  }
`;

const GET_EMAIL_SYNC_STATUS = gql`
  ${SYNC_STATUS_FRAGMENT}
  query GetEmailSyncStatus {
    emailSyncStatus {
      ...SyncStatusFields
    }
  }
`;

const GET_EMAIL_STATS = gql`
  query GetEmailStats {
    emailStats {
      totalEmails
      unreadEmails
      uncategorizedEmails
      emailsWithAttachments
      emailsByCase {
        caseId
        caseName
        count
      }
    }
  }
`;

const GET_EMAIL_SEARCH_SUGGESTIONS = gql`
  query GetEmailSearchSuggestions($prefix: String!) {
    emailSearchSuggestions(prefix: $prefix)
  }
`;

const GET_THREAD_PARTICIPANTS = gql`
  query GetThreadParticipants($conversationId: String!) {
    emailThreadParticipants(conversationId: $conversationId) {
      email
      name
      messageCount
      roles
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const START_EMAIL_SYNC = gql`
  ${SYNC_STATUS_FRAGMENT}
  mutation StartEmailSync {
    startEmailSync {
      ...SyncStatusFields
    }
  }
`;

const ASSIGN_EMAIL_TO_CASE = gql`
  ${EMAIL_FRAGMENT}
  mutation AssignEmailToCase($emailId: ID!, $caseId: ID!) {
    assignEmailToCase(emailId: $emailId, caseId: $caseId) {
      ...EmailFields
    }
  }
`;

const ASSIGN_THREAD_TO_CASE = gql`
  ${EMAIL_THREAD_FRAGMENT}
  mutation AssignThreadToCase($conversationId: String!, $caseId: ID!) {
    assignThreadToCase(conversationId: $conversationId, caseId: $caseId) {
      ...EmailThreadFields
    }
  }
`;

const MARK_EMAIL_READ = gql`
  ${EMAIL_FRAGMENT}
  mutation MarkEmailRead($emailId: ID!, $isRead: Boolean!) {
    markEmailRead(emailId: $emailId, isRead: $isRead) {
      ...EmailFields
    }
  }
`;

const MARK_THREAD_READ = gql`
  ${EMAIL_THREAD_FRAGMENT}
  mutation MarkThreadRead($conversationId: String!) {
    markThreadRead(conversationId: $conversationId) {
      ...EmailThreadFields
    }
  }
`;

const SYNC_EMAIL_ATTACHMENTS = gql`
  mutation SyncEmailAttachments($emailId: ID!) {
    syncEmailAttachments(emailId: $emailId) {
      id
      name
      contentType
      size
      downloadUrl
    }
  }
`;

const TRIGGER_EMAIL_CATEGORIZATION = gql`
  mutation TriggerEmailCategorization {
    triggerEmailCategorization
  }
`;

const CREATE_EMAIL_SUBSCRIPTION = gql`
  ${SYNC_STATUS_FRAGMENT}
  mutation CreateEmailSubscription {
    createEmailSubscription {
      ...SyncStatusFields
    }
  }
`;

// ============================================================================
// Subscriptions
// ============================================================================

const EMAIL_RECEIVED_SUBSCRIPTION = gql`
  ${EMAIL_FRAGMENT}
  subscription OnEmailReceived {
    emailReceived {
      ...EmailFields
    }
  }
`;

const EMAIL_SYNC_PROGRESS_SUBSCRIPTION = gql`
  ${SYNC_STATUS_FRAGMENT}
  subscription OnEmailSyncProgress {
    emailSyncProgress {
      ...SyncStatusFields
    }
  }
`;

const EMAIL_CATEGORIZED_SUBSCRIPTION = gql`
  subscription OnEmailCategorized {
    emailCategorized {
      emailId
      caseId
      confidence
      reasoning
    }
  }
`;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for email sync status and operations
 */
export function useEmailSync() {
  const { data, loading, error, refetch } = useQuery(GET_EMAIL_SYNC_STATUS, {
    fetchPolicy: 'cache-and-network',
  });

  const [startSync, { loading: syncing }] = useMutation(START_EMAIL_SYNC, {
    refetchQueries: [{ query: GET_EMAIL_SYNC_STATUS }],
  });

  const [createSubscription] = useMutation(CREATE_EMAIL_SUBSCRIPTION);

  // Subscribe to sync progress
  useSubscription(EMAIL_SYNC_PROGRESS_SUBSCRIPTION, {
    onData: ({ data: subData }) => {
      if (subData?.data?.emailSyncProgress) {
        refetch();
      }
    },
  });

  return {
    syncStatus: data?.emailSyncStatus,
    loading,
    error,
    syncing,
    startSync: async () => {
      const result = await startSync();
      return result.data?.startEmailSync;
    },
    createSubscription: async () => {
      const result = await createSubscription();
      return result.data?.createEmailSubscription;
    },
    refetch,
  };
}

/**
 * Hook for searching and listing emails
 */
export function useEmails(filters?: {
  caseId?: string;
  search?: string;
  hasAttachments?: boolean;
  isUnread?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  uncategorizedOnly?: boolean;
  importance?: string;
}, limit = 20, offset = 0) {
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_EMAILS, {
    variables: { filters, limit, offset },
    fetchPolicy: 'cache-and-network',
  });

  return {
    emails: data?.emails?.emails || [],
    totalCount: data?.emails?.totalCount || 0,
    hasMore: data?.emails?.hasMore || false,
    loading,
    error,
    refetch,
    fetchMore: () => {
      const currentCount = data?.emails?.emails?.length || 0;
      return fetchMore({
        variables: { offset: currentCount },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;
          return {
            emails: {
              ...fetchMoreResult.emails,
              emails: [...prev.emails.emails, ...fetchMoreResult.emails.emails],
            },
          };
        },
      });
    },
  };
}

/**
 * Hook for getting a single email
 */
export function useEmail(id: string) {
  const { data, loading, error, refetch } = useQuery(GET_EMAIL, {
    variables: { id },
    skip: !id,
  });

  const [markRead] = useMutation(MARK_EMAIL_READ);
  const [assignToCase] = useMutation(ASSIGN_EMAIL_TO_CASE);
  const [syncAttachments] = useMutation(SYNC_EMAIL_ATTACHMENTS);

  return {
    email: data?.email,
    loading,
    error,
    refetch,
    markRead: async (isRead: boolean) => {
      const result = await markRead({ variables: { emailId: id, isRead } });
      return result.data?.markEmailRead;
    },
    assignToCase: async (caseId: string) => {
      const result = await assignToCase({ variables: { emailId: id, caseId } });
      return result.data?.assignEmailToCase;
    },
    syncAttachments: async () => {
      const result = await syncAttachments({ variables: { emailId: id } });
      return result.data?.syncEmailAttachments;
    },
  };
}

/**
 * Hook for email threads
 */
export function useEmailThreads(filters?: {
  caseId?: string;
  hasUnread?: boolean;
  hasAttachments?: boolean;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}, limit = 20, offset = 0) {
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_EMAIL_THREADS, {
    variables: { filters, limit, offset },
    fetchPolicy: 'cache-and-network',
  });

  return {
    threads: data?.emailThreads || [],
    loading,
    error,
    refetch,
    fetchMore: () => {
      const currentCount = data?.emailThreads?.length || 0;
      return fetchMore({
        variables: { offset: currentCount },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;
          return {
            emailThreads: [...prev.emailThreads, ...fetchMoreResult.emailThreads],
          };
        },
      });
    },
  };
}

/**
 * Hook for a single email thread
 */
export function useEmailThread(conversationId: string) {
  const { data, loading, error, refetch } = useQuery(GET_EMAIL_THREAD, {
    variables: { conversationId },
    skip: !conversationId,
  });

  const [markRead] = useMutation(MARK_THREAD_READ);
  const [assignToCase] = useMutation(ASSIGN_THREAD_TO_CASE);

  return {
    thread: data?.emailThread,
    loading,
    error,
    refetch,
    markRead: async () => {
      const result = await markRead({ variables: { conversationId } });
      return result.data?.markThreadRead;
    },
    assignToCase: async (caseId: string) => {
      const result = await assignToCase({ variables: { conversationId, caseId } });
      return result.data?.assignThreadToCase;
    },
  };
}

/**
 * Hook for email statistics
 */
export function useEmailStats() {
  const { data, loading, error, refetch } = useQuery(GET_EMAIL_STATS, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 60000, // Refresh every minute
  });

  return {
    stats: data?.emailStats,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for email search suggestions
 */
export function useEmailSearchSuggestions(prefix: string) {
  const { data, loading } = useQuery(GET_EMAIL_SEARCH_SUGGESTIONS, {
    variables: { prefix },
    skip: !prefix || prefix.length < 2,
    fetchPolicy: 'cache-first',
  });

  return {
    suggestions: data?.emailSearchSuggestions || [],
    loading,
  };
}

/**
 * Hook for thread participants
 */
export function useThreadParticipants(conversationId: string) {
  const { data, loading, error } = useQuery(GET_THREAD_PARTICIPANTS, {
    variables: { conversationId },
    skip: !conversationId,
  });

  return {
    participants: data?.emailThreadParticipants || [],
    loading,
    error,
  };
}

/**
 * Hook for batch categorization (admin only)
 */
export function useEmailCategorization() {
  const [trigger, { loading, error }] = useMutation(TRIGGER_EMAIL_CATEGORIZATION, {
    refetchQueries: [{ query: GET_EMAIL_STATS }],
  });

  // Subscribe to categorization results
  const { data: subData } = useSubscription(EMAIL_CATEGORIZED_SUBSCRIPTION);

  return {
    trigger: async () => {
      const result = await trigger();
      return result.data?.triggerEmailCategorization || 0;
    },
    loading,
    error,
    lastCategorized: subData?.emailCategorized,
  };
}

/**
 * Hook for real-time email updates
 */
export function useEmailRealtime(onNewEmail?: (email: any) => void) {
  useSubscription(EMAIL_RECEIVED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data?.data?.emailReceived && onNewEmail) {
        onNewEmail(data.data.emailReceived);
      }
    },
  });
}
