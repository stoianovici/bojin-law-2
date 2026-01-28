/**
 * Team Chat Hook
 * Manages real-time team chat with subscriptions
 */

import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { useAuthStore } from '@/store/auth';
import { useRealtimeStore, ChatMessage, TypingUser } from '@/store/realtime';
import { GET_TEAM_CHAT_MESSAGES } from '@/graphql/queries';
import {
  SEND_TEAM_CHAT_MESSAGE,
  DELETE_TEAM_CHAT_MESSAGE,
  SET_TEAM_CHAT_TYPING,
} from '@/graphql/mutations';
import {
  TEAM_CHAT_MESSAGE_RECEIVED,
  TEAM_CHAT_MESSAGE_DELETED,
  TEAM_CHAT_TYPING_UPDATED,
} from '@/graphql/subscriptions';

// ============================================================================
// Types
// ============================================================================

interface TeamChatMessagesData {
  teamChatMessages: ChatMessage[];
}

interface SendTeamChatMessageData {
  sendTeamChatMessage: ChatMessage;
}

interface TeamChatMessageReceivedData {
  teamChatMessageReceived: ChatMessage;
}

interface TeamChatMessageDeletedData {
  teamChatMessageDeleted: string;
}

interface TeamChatTypingUpdatedData {
  teamChatTypingUpdated: TypingUser[];
}

export interface UseTeamChatResult {
  messages: ChatMessage[];
  loading: boolean;
  error?: Error;
  sending: boolean;
  typingUsers: TypingUser[];
  sendMessage: (content: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  setTyping: (isTyping: boolean) => void;
  refetch: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useTeamChat(): UseTeamChatResult {
  const { user } = useAuthStore();
  const currentUserId = user?.id;

  const {
    chatMessages,
    typingUsers,
    setChatMessages,
    addChatMessage,
    removeChatMessage,
    setTypingUsers,
  } = useRealtimeStore();

  // ============================================================================
  // Query - Load initial messages
  // ============================================================================

  const { data, loading, error, refetch } = useQuery<TeamChatMessagesData>(GET_TEAM_CHAT_MESSAGES, {
    variables: { limit: 50, offset: 0 },
    fetchPolicy: 'cache-and-network',
  });

  // Sync query data to store
  useEffect(() => {
    if (data?.teamChatMessages) {
      setChatMessages(data.teamChatMessages);
    }
  }, [data, setChatMessages]);

  // ============================================================================
  // Mutations
  // ============================================================================

  const [sendMessageMutation, { loading: sending }] =
    useMutation<SendTeamChatMessageData>(SEND_TEAM_CHAT_MESSAGE);

  const [deleteMessageMutation] = useMutation<{ deleteTeamChatMessage: boolean }>(
    DELETE_TEAM_CHAT_MESSAGE
  );

  const [setTypingMutation] = useMutation(SET_TEAM_CHAT_TYPING);

  // ============================================================================
  // Subscriptions
  // ============================================================================

  // New message subscription
  const { data: newMessageData } = useSubscription<TeamChatMessageReceivedData>(
    TEAM_CHAT_MESSAGE_RECEIVED
  );

  useEffect(() => {
    const newMessage = newMessageData?.teamChatMessageReceived;
    if (!newMessage) return;
    // Don't add messages from current user (already added via mutation)
    if (newMessage.author.id === currentUserId) return;
    addChatMessage(newMessage);
  }, [newMessageData, currentUserId, addChatMessage]);

  // Deleted message subscription
  const { data: deletedMessageData } =
    useSubscription<TeamChatMessageDeletedData>(TEAM_CHAT_MESSAGE_DELETED);

  useEffect(() => {
    const deletedMessageId = deletedMessageData?.teamChatMessageDeleted;
    if (deletedMessageId) {
      removeChatMessage(deletedMessageId);
    }
  }, [deletedMessageData, removeChatMessage]);

  // Typing indicator subscription
  const { data: typingData } = useSubscription<TeamChatTypingUpdatedData>(TEAM_CHAT_TYPING_UPDATED);

  useEffect(() => {
    const users = typingData?.teamChatTypingUpdated || [];
    // Filter out current user
    setTypingUsers(users.filter((u) => u.userId !== currentUserId));
  }, [typingData, currentUserId, setTypingUsers]);

  // ============================================================================
  // Actions
  // ============================================================================

  const sendMessage = useCallback(
    async (content: string) => {
      const result = await sendMessageMutation({
        variables: { content, parentId: null, mentions: [] },
      });
      if (result.data?.sendTeamChatMessage) {
        addChatMessage(result.data.sendTeamChatMessage);
      }
    },
    [sendMessageMutation, addChatMessage]
  );

  const deleteMessage = useCallback(
    async (id: string) => {
      await deleteMessageMutation({ variables: { id } });
      removeChatMessage(id);
    },
    [deleteMessageMutation, removeChatMessage]
  );

  // ============================================================================
  // Debounced Typing Indicator
  // ============================================================================

  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      setTypingMutation({ variables: { isTyping } });

      // Auto-clear after 3 seconds
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          setTypingMutation({ variables: { isTyping: false } });
        }, 3000);
      }
    },
    [setTypingMutation]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setTypingMutation({ variables: { isTyping: false } }).catch(() => {});
    };
  }, [setTypingMutation]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    messages: chatMessages,
    loading,
    error: error as Error | undefined,
    sending,
    typingUsers,
    sendMessage,
    deleteMessage,
    setTyping,
    refetch,
  };
}
