/**
 * Email Synchronization React Hooks
 * Story 5.1: Email Integration and Synchronization
 *
 * Provides hooks for email sync, threading, search, and categorization
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery, useSubscription } from '@apollo/client/react';

// ============================================================================
// Types
// ============================================================================

interface EmailAddress {
  name?: string;
  address: string;
}

interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  downloadUrl?: string;
}

interface CaseReference {
  id: string;
  title: string;
  caseNumber: string;
}

// OPS-062: Multi-case email support types
type ClassificationMatchType =
  | 'Actor'
  | 'ReferenceNumber'
  | 'Keyword'
  | 'Semantic'
  | 'GlobalSource'
  | 'Manual'
  | 'ThreadContinuity';

interface EmailCaseLink {
  id: string;
  caseId: string;
  confidence: number | null;
  matchType: ClassificationMatchType | null;
  linkedAt: string;
  linkedBy: string;
  isPrimary: boolean;
  case: CaseReference;
}

interface Email {
  id: string;
  graphMessageId: string;
  conversationId?: string;
  subject: string;
  bodyPreview: string;
  bodyContent: string;
  bodyContentType: string;
  bodyContentClean?: string; // OPS-090: AI-cleaned content
  folderType?: string | null; // OPS-091: 'inbox' or 'sent'
  from: EmailAddress;
  toRecipients: EmailAddress[];
  ccRecipients: EmailAddress[];
  receivedDateTime: string;
  sentDateTime: string;
  hasAttachments: boolean;
  importance: string;
  isRead: boolean;
  case?: CaseReference;
  // OPS-062: Multi-case support
  caseLinks?: EmailCaseLink[];
  cases?: CaseReference[];
  primaryCase?: CaseReference;
  attachments: EmailAttachment[];
}

interface EmailThread {
  id: string;
  conversationId: string;
  subject: string;
  participantCount: number;
  messageCount: number;
  hasUnread: boolean;
  hasAttachments: boolean;
  lastMessageDate: string;
  firstMessageDate: string;
  case?: CaseReference;
  emails: Email[];
}

interface EmailSyncStatus {
  status: string;
  lastSyncAt?: string;
  emailCount: number;
  pendingCategorization: number;
}

interface EmailStats {
  totalEmails: number;
  unreadEmails: number;
  uncategorizedEmails: number;
  emailsWithAttachments: number;
  emailsByCase: Array<{
    caseId: string;
    caseName: string;
    count: number;
  }>;
}

interface EmailThreadParticipant {
  email: string;
  name?: string;
  messageCount: number;
  roles: string[];
}

interface EmailCategorizationResult {
  emailId: string;
  caseId: string;
  confidence: number;
  reasoning: string;
}

// Query Response Types
interface GetEmailsData {
  emails: {
    emails: Email[];
    totalCount: number;
    hasMore: boolean;
  };
}

interface GetEmailData {
  email: Email;
}

interface GetEmailThreadsData {
  emailThreads: EmailThread[];
}

interface GetEmailThreadData {
  emailThread: EmailThread;
}

interface GetEmailSyncStatusData {
  emailSyncStatus: EmailSyncStatus;
}

interface GetEmailStatsData {
  emailStats: EmailStats;
}

interface GetEmailSearchSuggestionsData {
  emailSearchSuggestions: string[];
}

interface GetThreadParticipantsData {
  emailThreadParticipants: EmailThreadParticipant[];
}

// Mutation Response Types
interface StartEmailSyncData {
  startEmailSync: EmailSyncStatus;
}

interface CreateEmailSubscriptionData {
  createEmailSubscription: EmailSyncStatus;
}

interface MarkEmailReadData {
  markEmailRead: Email;
}

interface AssignEmailToCaseData {
  assignEmailToCase: Email;
}

interface SyncEmailAttachmentsData {
  syncEmailAttachments: EmailAttachment[];
}

interface MarkThreadReadData {
  markThreadRead: EmailThread;
}

interface AssignThreadToCaseData {
  assignThreadToCase: EmailThread;
}

interface TriggerEmailCategorizationData {
  triggerEmailCategorization: number;
}

interface PermanentlyDeleteEmailData {
  permanentlyDeleteEmail: {
    success: boolean;
    attachmentsDeleted: number;
  };
}

interface BulkDeleteCaseEmailsData {
  bulkDeleteCaseEmails: {
    emailsDeleted: number;
    attachmentsDeleted: number;
    success: boolean;
  };
}

// OPS-062: Multi-Case Email Mutation Data Types
interface LinkEmailToCaseData {
  linkEmailToCase: EmailCaseLink;
}

interface UnlinkEmailFromCaseData {
  unlinkEmailFromCase: boolean;
}

// Subscription Data Types
interface EmailReceivedSubscriptionData {
  emailReceived: Email;
}

interface EmailSyncProgressSubscriptionData {
  emailSyncProgress: EmailSyncStatus;
}

interface EmailCategorizedSubscriptionData {
  emailCategorized: EmailCategorizationResult;
}

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
    bodyContentClean
    folderType
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
    primaryCase {
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

const PERMANENTLY_DELETE_EMAIL = gql`
  mutation PermanentlyDeleteEmail($emailId: ID!) {
    permanentlyDeleteEmail(emailId: $emailId) {
      success
      attachmentsDeleted
    }
  }
`;

const BULK_DELETE_CASE_EMAILS = gql`
  mutation BulkDeleteCaseEmails($caseId: ID!) {
    bulkDeleteCaseEmails(caseId: $caseId) {
      emailsDeleted
      attachmentsDeleted
      success
    }
  }
`;

// ============================================================================
// OPS-062: Multi-Case Email Link/Unlink Mutations
// ============================================================================

const LINK_EMAIL_TO_CASE = gql`
  mutation LinkEmailToCase($emailId: ID!, $caseId: ID!, $isPrimary: Boolean) {
    linkEmailToCase(emailId: $emailId, caseId: $caseId, isPrimary: $isPrimary) {
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
`;

const UNLINK_EMAIL_FROM_CASE = gql`
  mutation UnlinkEmailFromCase($emailId: ID!, $caseId: ID!) {
    unlinkEmailFromCase(emailId: $emailId, caseId: $caseId)
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
  const { data, loading, error, refetch } = useQuery<GetEmailSyncStatusData>(
    GET_EMAIL_SYNC_STATUS,
    {
      fetchPolicy: 'cache-and-network',
    }
  );

  const [startSync, { loading: syncing }] = useMutation<StartEmailSyncData>(START_EMAIL_SYNC, {
    refetchQueries: [{ query: GET_EMAIL_SYNC_STATUS }],
  });

  const [createSubscription] = useMutation<CreateEmailSubscriptionData>(CREATE_EMAIL_SUBSCRIPTION);

  // Subscribe to sync progress
  useSubscription<EmailSyncProgressSubscriptionData>(EMAIL_SYNC_PROGRESS_SUBSCRIPTION, {
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
export function useEmails(
  filters?: {
    caseId?: string;
    search?: string;
    hasAttachments?: boolean;
    isUnread?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    uncategorizedOnly?: boolean;
    importance?: string;
  },
  limit = 20,
  offset = 0
) {
  const { data, loading, error, refetch, fetchMore } = useQuery<GetEmailsData>(GET_EMAILS, {
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
        updateQuery: (
          prev: GetEmailsData,
          { fetchMoreResult }: { fetchMoreResult?: GetEmailsData }
        ) => {
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
  const { data, loading, error, refetch } = useQuery<GetEmailData>(GET_EMAIL, {
    variables: { id },
    skip: !id,
  });

  const [markRead] = useMutation<MarkEmailReadData>(MARK_EMAIL_READ);
  const [assignToCase] = useMutation<AssignEmailToCaseData>(ASSIGN_EMAIL_TO_CASE);
  const [syncAttachments] = useMutation<SyncEmailAttachmentsData>(SYNC_EMAIL_ATTACHMENTS);

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
export function useEmailThreads(
  filters?: {
    caseId?: string;
    hasUnread?: boolean;
    hasAttachments?: boolean;
    search?: string;
    dateFrom?: Date;
    dateTo?: Date;
  },
  limit = 20,
  offset = 0
) {
  const { data, loading, error, refetch, fetchMore } = useQuery<GetEmailThreadsData>(
    GET_EMAIL_THREADS,
    {
      variables: { filters, limit, offset },
      fetchPolicy: 'cache-and-network',
    }
  );

  return {
    threads: data?.emailThreads || [],
    loading,
    error,
    refetch,
    fetchMore: () => {
      const currentCount = data?.emailThreads?.length || 0;
      return fetchMore({
        variables: { offset: currentCount },
        updateQuery: (
          prev: GetEmailThreadsData,
          { fetchMoreResult }: { fetchMoreResult?: GetEmailThreadsData }
        ) => {
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
  const { data, loading, error, refetch } = useQuery<GetEmailThreadData>(GET_EMAIL_THREAD, {
    variables: { conversationId },
    skip: !conversationId,
  });

  const [markRead] = useMutation<MarkThreadReadData>(MARK_THREAD_READ);
  const [assignToCase] = useMutation<AssignThreadToCaseData>(ASSIGN_THREAD_TO_CASE);

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
  const { data, loading, error, refetch } = useQuery<GetEmailStatsData>(GET_EMAIL_STATS, {
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
  const { data, loading } = useQuery<GetEmailSearchSuggestionsData>(GET_EMAIL_SEARCH_SUGGESTIONS, {
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
  const { data, loading, error } = useQuery<GetThreadParticipantsData>(GET_THREAD_PARTICIPANTS, {
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
  const [trigger, { loading, error }] = useMutation<TriggerEmailCategorizationData>(
    TRIGGER_EMAIL_CATEGORIZATION,
    {
      refetchQueries: [{ query: GET_EMAIL_STATS }],
    }
  );

  // Subscribe to categorization results
  const { data: subData } = useSubscription<EmailCategorizedSubscriptionData>(
    EMAIL_CATEGORIZED_SUBSCRIPTION
  );

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
export function useEmailRealtime(onNewEmail?: (email: Email) => void) {
  useSubscription<EmailReceivedSubscriptionData>(EMAIL_RECEIVED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data?.data?.emailReceived && onNewEmail) {
        onNewEmail(data.data.emailReceived);
      }
    },
  });
}

/**
 * Hook for permanently deleting emails (Partners/BusinessOwners only)
 */
export function useDeleteEmail() {
  const [deleteEmail, { loading, error }] = useMutation<PermanentlyDeleteEmailData>(
    PERMANENTLY_DELETE_EMAIL,
    {
      refetchQueries: [{ query: GET_EMAIL_STATS }, { query: GET_EMAIL_THREADS }],
    }
  );

  return {
    deleteEmail: async (emailId: string) => {
      const result = await deleteEmail({ variables: { emailId } });
      return result.data?.permanentlyDeleteEmail;
    },
    loading,
    error,
  };
}

/**
 * Hook for bulk deleting all emails for a case (Partners/BusinessOwners only)
 */
export function useBulkDeleteCaseEmails() {
  const [bulkDelete, { loading, error }] = useMutation<BulkDeleteCaseEmailsData>(
    BULK_DELETE_CASE_EMAILS,
    {
      refetchQueries: [{ query: GET_EMAIL_STATS }, { query: GET_EMAIL_THREADS }],
    }
  );

  return {
    bulkDeleteCaseEmails: async (caseId: string) => {
      const result = await bulkDelete({ variables: { caseId } });
      return result.data?.bulkDeleteCaseEmails;
    },
    loading,
    error,
  };
}

/**
 * Hook for linking/unlinking emails to/from cases (OPS-062: Multi-Case Support)
 * Allows emails to be associated with multiple cases
 */
export function useEmailCaseLinks() {
  const [linkMutation, { loading: linking, error: linkError }] = useMutation<LinkEmailToCaseData>(
    LINK_EMAIL_TO_CASE,
    {
      refetchQueries: [{ query: GET_EMAIL_THREADS }],
    }
  );

  const [unlinkMutation, { loading: unlinking, error: unlinkError }] =
    useMutation<UnlinkEmailFromCaseData>(UNLINK_EMAIL_FROM_CASE, {
      refetchQueries: [{ query: GET_EMAIL_THREADS }],
    });

  return {
    /**
     * Link an email to an additional case
     * @param emailId - The email to link
     * @param caseId - The case to link to
     * @param isPrimary - Whether to set this as the primary case (default: false)
     */
    linkEmailToCase: async (emailId: string, caseId: string, isPrimary = false) => {
      const result = await linkMutation({
        variables: { emailId, caseId, isPrimary },
      });
      return result.data?.linkEmailToCase;
    },

    /**
     * Unlink an email from a case
     * @param emailId - The email to unlink
     * @param caseId - The case to unlink from
     * @returns true if successful
     */
    unlinkEmailFromCase: async (emailId: string, caseId: string) => {
      const result = await unlinkMutation({
        variables: { emailId, caseId },
      });
      return result.data?.unlinkEmailFromCase ?? false;
    },

    linking,
    unlinking,
    loading: linking || unlinking,
    error: linkError || unlinkError,
  };
}

// Re-export types for external use
export type { EmailCaseLink, ClassificationMatchType };
