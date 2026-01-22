/**
 * Team Chat Hook
 * Provides GraphQL operations for real-time team chat
 *
 * Mesaje de chat pentru echipă cu suport pentru:
 * - Încărcarea mesajelor existente
 * - Trimiterea mesajelor noi
 * - Ștergerea mesajelor
 * - Indicatori de scriere în timp real
 * - Actualizări în timp real prin subscriptions
 */

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { useAuth } from './useAuth';

// ============================================================================
// Types
// ============================================================================

export interface TeamChatAuthor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface ChatAttachment {
  type: 'document';
  id: string;
  name: string;
  url?: string;
}

export interface TeamChatMessage {
  id: string;
  content: string;
  author: TeamChatAuthor;
  parentId: string | null;
  mentions: string[];
  type: 'User' | 'System';
  attachments?: ChatAttachment[];
  activityType?: string;
  activityRef?: string;
  createdAt: string;
  expiresAt: string;
  replies: TeamChatMessage[];
}

export interface TypingUser {
  userId: string;
  userName: string;
}

export interface SendMessageOptions {
  content: string;
  parentId?: string | null;
  mentions?: string[];
  attachments?: ChatAttachment[];
}

export interface UseTeamChatResult {
  messages: TeamChatMessage[];
  loading: boolean;
  error?: Error;
  sending: boolean;
  typingUsers: TypingUser[];
  sendMessage: (content: string, options?: Omit<SendMessageOptions, 'content'>) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  setTyping: (isTyping: boolean) => void;
  refetch: () => void;
  currentUserId?: string;
}

// ============================================================================
// GraphQL Fragments
// ============================================================================

const TEAM_CHAT_AUTHOR_FRAGMENT = gql`
  fragment TeamChatAuthorFields on User {
    id
    email
    firstName
    lastName
  }
`;

const TEAM_CHAT_MESSAGE_FRAGMENT = gql`
  fragment TeamChatMessageFields on TeamChatMessage {
    id
    content
    author {
      ...TeamChatAuthorFields
    }
    parentId
    mentions
    type
    attachments
    activityType
    activityRef
    createdAt
    expiresAt
    replies {
      id
      content
      author {
        ...TeamChatAuthorFields
      }
      parentId
      mentions
      type
      attachments
      activityType
      activityRef
      createdAt
      expiresAt
    }
  }
  ${TEAM_CHAT_AUTHOR_FRAGMENT}
`;

// ============================================================================
// GraphQL Operations
// ============================================================================

const TEAM_CHAT_MESSAGES = gql`
  query TeamChatMessages($limit: Int, $offset: Int, $parentId: ID) {
    teamChatMessages(limit: $limit, offset: $offset, parentId: $parentId) {
      ...TeamChatMessageFields
    }
  }
  ${TEAM_CHAT_MESSAGE_FRAGMENT}
`;

const SEND_TEAM_CHAT_MESSAGE = gql`
  mutation SendTeamChatMessage(
    $content: String!
    $parentId: ID
    $mentions: [String!]
    $attachments: [TeamChatAttachmentInput!]
  ) {
    sendTeamChatMessage(
      content: $content
      parentId: $parentId
      mentions: $mentions
      attachments: $attachments
    ) {
      ...TeamChatMessageFields
    }
  }
  ${TEAM_CHAT_MESSAGE_FRAGMENT}
`;

const DELETE_TEAM_CHAT_MESSAGE = gql`
  mutation DeleteTeamChatMessage($id: ID!) {
    deleteTeamChatMessage(id: $id)
  }
`;

const SET_TEAM_CHAT_TYPING = gql`
  mutation SetTeamChatTyping($isTyping: Boolean!) {
    setTeamChatTyping(isTyping: $isTyping)
  }
`;

const TEAM_CHAT_MESSAGE_RECEIVED = gql`
  subscription TeamChatMessageReceived {
    teamChatMessageReceived {
      ...TeamChatMessageFields
    }
  }
  ${TEAM_CHAT_MESSAGE_FRAGMENT}
`;

const TEAM_CHAT_MESSAGE_DELETED = gql`
  subscription TeamChatMessageDeleted {
    teamChatMessageDeleted
  }
`;

const TEAM_CHAT_TYPING_UPDATED = gql`
  subscription TeamChatTypingUpdated {
    teamChatTypingUpdated {
      userId
      userName
    }
  }
`;

// ============================================================================
// Query Response Types
// ============================================================================

interface TeamChatMessagesData {
  teamChatMessages: TeamChatMessage[];
}

interface SendTeamChatMessageData {
  sendTeamChatMessage: TeamChatMessage;
}

interface DeleteTeamChatMessageData {
  deleteTeamChatMessage: boolean;
}

interface TeamChatMessageReceivedData {
  teamChatMessageReceived: TeamChatMessage;
}

interface TeamChatMessageDeletedData {
  teamChatMessageDeleted: string;
}

interface TeamChatTypingUpdatedData {
  teamChatTypingUpdated: TypingUser[];
}

// ============================================================================
// Hook
// ============================================================================

export function useTeamChat(options?: {
  limit?: number;
  parentId?: string | null;
}): UseTeamChatResult {
  const { user } = useAuth();
  const currentUserId = user?.id;

  // ============================================================================
  // Query - Încărcarea mesajelor inițiale
  // ============================================================================

  const { data, loading, error, refetch } = useQuery<TeamChatMessagesData>(TEAM_CHAT_MESSAGES, {
    variables: {
      limit: options?.limit ?? 50,
      offset: 0,
      parentId: options?.parentId ?? null,
    },
    fetchPolicy: 'cache-and-network',
  });

  // ============================================================================
  // Mutations
  // ============================================================================

  const [sendMessageMutation, { loading: sending }] = useMutation<SendTeamChatMessageData>(
    SEND_TEAM_CHAT_MESSAGE,
    {
      // Actualizare optimistă a cache-ului după trimiterea unui mesaj
      update(cache, { data: mutationData }) {
        if (!mutationData?.sendTeamChatMessage) return;

        const existingData = cache.readQuery<TeamChatMessagesData>({
          query: TEAM_CHAT_MESSAGES,
          variables: {
            limit: options?.limit ?? 50,
            offset: 0,
            parentId: options?.parentId ?? null,
          },
        });

        if (existingData) {
          cache.writeQuery({
            query: TEAM_CHAT_MESSAGES,
            variables: {
              limit: options?.limit ?? 50,
              offset: 0,
              parentId: options?.parentId ?? null,
            },
            data: {
              teamChatMessages: [
                ...existingData.teamChatMessages,
                mutationData.sendTeamChatMessage,
              ],
            },
          });
        }
      },
    }
  );

  const [deleteMessageMutation] = useMutation<DeleteTeamChatMessageData>(DELETE_TEAM_CHAT_MESSAGE, {
    // Actualizare optimistă a cache-ului după ștergerea unui mesaj
    update(cache, { data: mutationData }, { variables }) {
      if (!mutationData?.deleteTeamChatMessage || !variables?.id) return;

      const existingData = cache.readQuery<TeamChatMessagesData>({
        query: TEAM_CHAT_MESSAGES,
        variables: {
          limit: options?.limit ?? 50,
          offset: 0,
          parentId: options?.parentId ?? null,
        },
      });

      if (existingData) {
        cache.writeQuery({
          query: TEAM_CHAT_MESSAGES,
          variables: {
            limit: options?.limit ?? 50,
            offset: 0,
            parentId: options?.parentId ?? null,
          },
          data: {
            teamChatMessages: existingData.teamChatMessages.filter(
              (msg) => msg.id !== variables.id
            ),
          },
        });
      }
    },
  });

  const [setTypingMutation] = useMutation(SET_TEAM_CHAT_TYPING);

  // ============================================================================
  // Subscriptions - Actualizări în timp real
  // ============================================================================

  // Subscription pentru mesaje noi primite
  useSubscription<TeamChatMessageReceivedData>(TEAM_CHAT_MESSAGE_RECEIVED, {
    onData: ({ client, data: subscriptionData }) => {
      const newMessage = subscriptionData.data?.teamChatMessageReceived;
      if (!newMessage) return;

      // Nu adăugăm mesajele trimise de utilizatorul curent (sunt deja în cache)
      if (newMessage.author.id === currentUserId) return;

      const existingData = client.readQuery<TeamChatMessagesData>({
        query: TEAM_CHAT_MESSAGES,
        variables: {
          limit: options?.limit ?? 50,
          offset: 0,
          parentId: options?.parentId ?? null,
        },
      });

      if (existingData) {
        // Verificăm dacă mesajul există deja pentru a evita duplicate
        const messageExists = existingData.teamChatMessages.some((msg) => msg.id === newMessage.id);
        if (messageExists) return;

        client.writeQuery({
          query: TEAM_CHAT_MESSAGES,
          variables: {
            limit: options?.limit ?? 50,
            offset: 0,
            parentId: options?.parentId ?? null,
          },
          data: {
            teamChatMessages: [...existingData.teamChatMessages, newMessage],
          },
        });
      }
    },
  });

  // Subscription pentru mesaje șterse
  useSubscription<TeamChatMessageDeletedData>(TEAM_CHAT_MESSAGE_DELETED, {
    onData: ({ client, data: subscriptionData }) => {
      const deletedMessageId = subscriptionData.data?.teamChatMessageDeleted;
      if (!deletedMessageId) return;

      const existingData = client.readQuery<TeamChatMessagesData>({
        query: TEAM_CHAT_MESSAGES,
        variables: {
          limit: options?.limit ?? 50,
          offset: 0,
          parentId: options?.parentId ?? null,
        },
      });

      if (existingData) {
        client.writeQuery({
          query: TEAM_CHAT_MESSAGES,
          variables: {
            limit: options?.limit ?? 50,
            offset: 0,
            parentId: options?.parentId ?? null,
          },
          data: {
            teamChatMessages: existingData.teamChatMessages.filter(
              (msg) => msg.id !== deletedMessageId
            ),
          },
        });
      }
    },
  });

  // Subscription pentru indicatorii de scriere
  const { data: typingData } = useSubscription<TeamChatTypingUpdatedData>(TEAM_CHAT_TYPING_UPDATED);

  // ============================================================================
  // Wrapper Functions
  // ============================================================================

  const sendMessage = useCallback(
    async (content: string, messageOptions?: Omit<SendMessageOptions, 'content'>) => {
      await sendMessageMutation({
        variables: {
          content,
          parentId: messageOptions?.parentId ?? null,
          mentions: messageOptions?.mentions ?? [],
          attachments: messageOptions?.attachments ?? null,
        },
      });
    },
    [sendMessageMutation]
  );

  const deleteMessage = useCallback(
    async (id: string) => {
      await deleteMessageMutation({ variables: { id } });
    },
    [deleteMessageMutation]
  );

  // ============================================================================
  // Debounced Typing Indicator
  // Indicator de scriere cu auto-clear după 3 secunde
  // ============================================================================

  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const setTyping = useCallback(
    (isTyping: boolean) => {
      // Anulăm timeout-ul existent
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      setTypingMutation({ variables: { isTyping } });

      // Auto-clear typing după 3 secunde pentru a preveni indicatorii blocați
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          setTypingMutation({ variables: { isTyping: false } });
        }, 3000);
      }
    },
    [setTypingMutation]
  );

  // Cleanup la unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Asigurăm că indicatorul de scriere este dezactivat la unmount
      setTypingMutation({ variables: { isTyping: false } }).catch(() => {
        // Ignorăm erorile la cleanup
      });
    };
  }, [setTypingMutation]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Filtrăm utilizatorul curent din lista de utilizatori care scriu
  const filteredTypingUsers = useMemo(() => {
    const users = typingData?.teamChatTypingUpdated || [];
    return users.filter((user) => user.userId !== currentUserId);
  }, [typingData?.teamChatTypingUpdated, currentUserId]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    messages: data?.teamChatMessages || [],
    loading,
    error: error as Error | undefined,
    sending,
    typingUsers: filteredTypingUsers,
    sendMessage,
    deleteMessage,
    setTyping,
    refetch,
    currentUserId,
  };
}
