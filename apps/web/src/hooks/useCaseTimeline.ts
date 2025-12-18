/**
 * Case Timeline React Hooks
 * Story 5.5: Multi-Channel Communication Hub (AC: 1, 4)
 *
 * Provides hooks for unified communication timeline with multi-channel support
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useState } from 'react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const RECIPIENT_INFO_FRAGMENT = gql`
  fragment RecipientInfoFields on RecipientInfo {
    id
    name
    email
    type
  }
`;

const COMMUNICATION_ATTACHMENT_FRAGMENT = gql`
  fragment CommunicationAttachmentFields on CommunicationAttachment {
    id
    fileName
    fileSize
    mimeType
    downloadUrl
    documentId
  }
`;

const TIMELINE_ENTRY_FRAGMENT = gql`
  ${RECIPIENT_INFO_FRAGMENT}
  ${COMMUNICATION_ATTACHMENT_FRAGMENT}
  fragment TimelineEntryFields on TimelineEntry {
    id
    channelType
    direction
    subject
    bodyPreview
    body
    htmlBody
    senderName
    senderEmail
    recipients {
      ...RecipientInfoFields
    }
    hasAttachments
    attachments {
      ...CommunicationAttachmentFields
    }
    isPrivate
    privacyLevel
    sentAt
    parentId
    childCount
    case {
      id
      title
      caseNumber
    }
    metadata
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_CASE_TIMELINE = gql`
  ${TIMELINE_ENTRY_FRAGMENT}
  query GetCaseTimeline($filter: TimelineFilter!, $first: Int, $after: String) {
    caseTimeline(filter: $filter, first: $first, after: $after) {
      entries {
        ...TimelineEntryFields
      }
      totalCount
      hasMore
      cursor
    }
  }
`;

const GET_COMMUNICATION_ENTRY = gql`
  ${TIMELINE_ENTRY_FRAGMENT}
  query GetCommunicationEntry($id: ID!) {
    communicationEntry(id: $id) {
      ...TimelineEntryFields
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const CREATE_INTERNAL_NOTE = gql`
  ${TIMELINE_ENTRY_FRAGMENT}
  mutation CreateInternalNote($input: CreateInternalNoteInput!) {
    createInternalNote(input: $input) {
      ...TimelineEntryFields
    }
  }
`;

const UPDATE_INTERNAL_NOTE = gql`
  ${TIMELINE_ENTRY_FRAGMENT}
  mutation UpdateInternalNote($id: ID!, $body: String!) {
    updateInternalNote(id: $id, body: $body) {
      ...TimelineEntryFields
    }
  }
`;

const DELETE_INTERNAL_NOTE = gql`
  mutation DeleteInternalNote($id: ID!) {
    deleteInternalNote(id: $id)
  }
`;

const UPDATE_COMMUNICATION_PRIVACY = gql`
  ${TIMELINE_ENTRY_FRAGMENT}
  mutation UpdateCommunicationPrivacy($input: UpdatePrivacyInput!) {
    updateCommunicationPrivacy(input: $input) {
      ...TimelineEntryFields
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export type CommunicationChannel =
  | 'Email'
  | 'InternalNote'
  | 'WhatsApp'
  | 'Phone'
  | 'Meeting'
  | 'SMS';

export type CommunicationDirection = 'Inbound' | 'Outbound' | 'Internal';

export type PrivacyLevel = 'Normal' | 'Confidential' | 'AttorneyOnly' | 'PartnerOnly';

export interface TimelineFilter {
  caseId: string;
  channelTypes?: CommunicationChannel[];
  direction?: CommunicationDirection;
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
  includePrivate?: boolean;
}

export interface RecipientInfo {
  id?: string;
  name: string;
  email: string;
  type: 'to' | 'cc' | 'bcc';
}

export interface CommunicationAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
  documentId?: string;
}

export interface TimelineEntry {
  id: string;
  channelType: CommunicationChannel;
  direction: CommunicationDirection;
  subject?: string;
  bodyPreview: string;
  body: string;
  htmlBody?: string;
  senderName: string;
  senderEmail?: string;
  recipients: RecipientInfo[];
  hasAttachments: boolean;
  attachments: CommunicationAttachment[];
  isPrivate: boolean;
  privacyLevel: PrivacyLevel;
  sentAt: string;
  parentId?: string;
  childCount: number;
  case?: {
    id: string;
    title: string;
    caseNumber: string;
  };
  metadata?: Record<string, unknown>;
}

export interface CreateInternalNoteInput {
  caseId: string;
  body: string;
  isPrivate?: boolean;
  privacyLevel?: PrivacyLevel;
  allowedViewers?: string[];
  attachmentIds?: string[];
}

// GraphQL Response Types
interface GetCaseTimelineData {
  caseTimeline: {
    entries: TimelineEntry[];
    totalCount: number;
    hasMore: boolean;
    cursor: string | null;
  };
}

interface GetCommunicationEntryData {
  communicationEntry: TimelineEntry;
}

interface CreateInternalNoteData {
  createInternalNote: TimelineEntry;
}

interface UpdateInternalNoteData {
  updateInternalNote: TimelineEntry;
}

interface DeleteInternalNoteData {
  deleteInternalNote: boolean;
}

interface UpdateCommunicationPrivacyData {
  updateCommunicationPrivacy: TimelineEntry;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching paginated case timeline with infinite scroll support
 */
export function useCaseTimeline(caseId: string, filter?: Omit<TimelineFilter, 'caseId'>) {
  const [localEntries, setLocalEntries] = useState<TimelineEntry[]>([]);

  const timelineFilter: TimelineFilter = {
    caseId,
    ...filter,
  };

  const { data, loading, error, refetch, fetchMore } = useQuery<GetCaseTimelineData>(
    GET_CASE_TIMELINE,
    {
      variables: {
        filter: timelineFilter,
        first: 20,
      },
      skip: !caseId,
      fetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: true,
    }
  );

  const entries = data?.caseTimeline?.entries || [];
  const totalCount = data?.caseTimeline?.totalCount || 0;
  const hasMore = data?.caseTimeline?.hasMore || false;
  const cursor = data?.caseTimeline?.cursor;

  const loadMore = useCallback(async () => {
    if (!hasMore || !cursor || loading) return;

    try {
      await fetchMore({
        variables: {
          filter: timelineFilter,
          first: 20,
          after: cursor,
        },
        updateQuery: (
          prev: GetCaseTimelineData,
          { fetchMoreResult }: { fetchMoreResult?: GetCaseTimelineData }
        ) => {
          if (!fetchMoreResult) return prev;
          return {
            caseTimeline: {
              ...fetchMoreResult.caseTimeline,
              entries: [...prev.caseTimeline.entries, ...fetchMoreResult.caseTimeline.entries],
            },
          };
        },
      });
    } catch (err) {
      console.error('Error loading more timeline entries:', err);
    }
  }, [hasMore, cursor, loading, fetchMore, timelineFilter]);

  // Optimistic update helper
  const addOptimisticEntry = useCallback((entry: TimelineEntry) => {
    setLocalEntries((prev) => [entry, ...prev]);
  }, []);

  const removeOptimisticEntry = useCallback((entryId: string) => {
    setLocalEntries((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  // Combine fetched entries with optimistic local entries
  const allEntries = [...localEntries, ...entries];

  return {
    entries: allEntries,
    totalCount,
    hasMore,
    loading,
    error,
    refetch,
    loadMore,
    addOptimisticEntry,
    removeOptimisticEntry,
  };
}

/**
 * Hook for fetching a single timeline entry
 */
export function useTimelineEntry(id: string) {
  const { data, loading, error, refetch } = useQuery<GetCommunicationEntryData>(
    GET_COMMUNICATION_ENTRY,
    {
      variables: { id },
      skip: !id,
    }
  );

  return {
    entry: data?.communicationEntry,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for creating internal notes
 */
export function useCreateInternalNote(caseId: string) {
  const [createNote, { loading, error }] = useMutation<CreateInternalNoteData>(
    CREATE_INTERNAL_NOTE,
    {
      refetchQueries: [
        {
          query: GET_CASE_TIMELINE,
          variables: { filter: { caseId }, first: 20 },
        },
      ],
    }
  );

  const create = useCallback(
    async (input: Omit<CreateInternalNoteInput, 'caseId'>) => {
      const result = await createNote({
        variables: {
          input: {
            caseId,
            ...input,
          },
        },
        optimisticResponse: {
          createInternalNote: {
            id: `temp-${Date.now()}`,
            channelType: 'InternalNote',
            direction: 'Internal',
            subject: undefined,
            bodyPreview: input.body.substring(0, 200),
            body: input.body,
            htmlBody: undefined,
            senderName: 'You',
            senderEmail: undefined,
            recipients: [],
            hasAttachments: false,
            attachments: [],
            isPrivate: input.isPrivate || false,
            privacyLevel: input.privacyLevel || 'Normal',
            sentAt: new Date().toISOString(),
            parentId: undefined,
            childCount: 0,
            case: undefined,
            metadata: undefined,
          } as TimelineEntry & { __typename?: string },
        },
      });

      return result.data?.createInternalNote;
    },
    [createNote, caseId]
  );

  return {
    create,
    loading,
    error,
  };
}

/**
 * Hook for updating internal notes
 */
export function useUpdateInternalNote() {
  const [updateNote, { loading, error }] =
    useMutation<UpdateInternalNoteData>(UPDATE_INTERNAL_NOTE);

  const update = useCallback(
    async (id: string, body: string) => {
      const result = await updateNote({
        variables: { id, body },
      });

      return result.data?.updateInternalNote;
    },
    [updateNote]
  );

  return {
    update,
    loading,
    error,
  };
}

/**
 * Hook for deleting internal notes
 */
export function useDeleteInternalNote(caseId: string) {
  const [deleteNote, { loading, error }] = useMutation<DeleteInternalNoteData>(
    DELETE_INTERNAL_NOTE,
    {
      refetchQueries: [
        {
          query: GET_CASE_TIMELINE,
          variables: { filter: { caseId }, first: 20 },
        },
      ],
    }
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await deleteNote({
        variables: { id },
      });

      return result.data?.deleteInternalNote;
    },
    [deleteNote]
  );

  return {
    remove,
    loading,
    error,
  };
}

/**
 * Hook for updating communication privacy
 */
export function useUpdateCommunicationPrivacy() {
  const [updatePrivacy, { loading, error }] = useMutation<UpdateCommunicationPrivacyData>(
    UPDATE_COMMUNICATION_PRIVACY
  );

  const update = useCallback(
    async (communicationId: string, privacyLevel: PrivacyLevel, allowedViewers?: string[]) => {
      const result = await updatePrivacy({
        variables: {
          input: {
            communicationId,
            privacyLevel,
            allowedViewers,
          },
        },
      });

      return result.data?.updateCommunicationPrivacy;
    },
    [updatePrivacy]
  );

  return {
    update,
    loading,
    error,
  };
}

/**
 * Hook for timeline with real-time polling (alternative to subscriptions)
 */
export function useCaseTimelineWithPolling(
  caseId: string,
  filter?: Omit<TimelineFilter, 'caseId'>,
  pollIntervalMs = 30000
) {
  const timelineFilter: TimelineFilter = {
    caseId,
    ...filter,
  };

  const { data, loading, error, refetch, startPolling, stopPolling } =
    useQuery<GetCaseTimelineData>(GET_CASE_TIMELINE, {
      variables: {
        filter: timelineFilter,
        first: 20,
      },
      skip: !caseId,
      fetchPolicy: 'cache-and-network',
      pollInterval: pollIntervalMs,
    });

  const entries = data?.caseTimeline?.entries || [];
  const totalCount = data?.caseTimeline?.totalCount || 0;
  const hasMore = data?.caseTimeline?.hasMore || false;

  return {
    entries,
    totalCount,
    hasMore,
    loading,
    error,
    refetch,
    startPolling,
    stopPolling,
  };
}

/**
 * Utility hook for channel icons and colors
 */
export function useChannelMetadata() {
  const getChannelIcon = useCallback((channel: CommunicationChannel): string => {
    switch (channel) {
      case 'Email':
        return 'mail';
      case 'InternalNote':
        return 'file-text';
      case 'WhatsApp':
        return 'message-circle';
      case 'Phone':
        return 'phone';
      case 'Meeting':
        return 'calendar';
      case 'SMS':
        return 'smartphone';
      default:
        return 'message-square';
    }
  }, []);

  const getChannelColor = useCallback((channel: CommunicationChannel): string => {
    switch (channel) {
      case 'Email':
        return 'text-blue-500';
      case 'InternalNote':
        return 'text-gray-500';
      case 'WhatsApp':
        return 'text-green-500';
      case 'Phone':
        return 'text-purple-500';
      case 'Meeting':
        return 'text-orange-500';
      case 'SMS':
        return 'text-indigo-500';
      default:
        return 'text-gray-500';
    }
  }, []);

  const getChannelLabel = useCallback((channel: CommunicationChannel): string => {
    switch (channel) {
      case 'Email':
        return 'Email';
      case 'InternalNote':
        return 'Notă Internă';
      case 'WhatsApp':
        return 'WhatsApp';
      case 'Phone':
        return 'Apel Telefonic';
      case 'Meeting':
        return 'Întâlnire';
      case 'SMS':
        return 'SMS';
      default:
        return 'Necunoscut';
    }
  }, []);

  const isChannelDisabled = useCallback((channel: CommunicationChannel): boolean => {
    // WhatsApp and SMS are planned for future
    return channel === 'WhatsApp' || channel === 'SMS';
  }, []);

  return {
    getChannelIcon,
    getChannelColor,
    getChannelLabel,
    isChannelDisabled,
  };
}

/**
 * Utility hook for privacy level display
 */
export function usePrivacyMetadata() {
  const getPrivacyIcon = useCallback((level: PrivacyLevel): string => {
    switch (level) {
      case 'Normal':
        return 'eye';
      case 'Confidential':
        return 'lock';
      case 'AttorneyOnly':
        return 'briefcase';
      case 'PartnerOnly':
        return 'crown';
      default:
        return 'eye';
    }
  }, []);

  const getPrivacyColor = useCallback((level: PrivacyLevel): string => {
    switch (level) {
      case 'Normal':
        return 'text-gray-500';
      case 'Confidential':
        return 'text-yellow-500';
      case 'AttorneyOnly':
        return 'text-orange-500';
      case 'PartnerOnly':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  }, []);

  const getPrivacyLabel = useCallback((level: PrivacyLevel): string => {
    switch (level) {
      case 'Normal':
        return 'Toți membrii echipei';
      case 'Confidential':
        return 'Doar selectați';
      case 'AttorneyOnly':
        return 'Doar avocați';
      case 'PartnerOnly':
        return 'Doar parteneri';
      default:
        return 'Necunoscut';
    }
  }, []);

  return {
    getPrivacyIcon,
    getPrivacyColor,
    getPrivacyLabel,
  };
}
