/**
 * useAssistant Hook
 * OPS-070: useAssistant Hook
 *
 * React hook that connects the Zustand store to GraphQL mutations and provides
 * a clean API for assistant components. Handles message sending, action
 * confirmations, and conversation state management.
 */

import { gql } from '@apollo/client';
import { useMutation, useLazyQuery } from '@apollo/client/react';
import { useCallback, useEffect, useState } from 'react';
import {
  useAssistantStore,
  type AIMessage,
  type ProposedAction,
  type AssistantContext,
} from '../stores/assistant.store';
import { useAIAssistant } from '../contexts/AIAssistantContext';

// ============================================================================
// GraphQL Operations
// ============================================================================

const AI_MESSAGE_FRAGMENT = gql`
  fragment AIMessageFields on AIMessage {
    id
    role
    content
    intent
    confidence
    proposedAction {
      type
      displayText
      payload
      status
      requiresConfirmation
      confirmationPrompt
      entityPreview
      editableFields {
        key
        label
        type
        required
        placeholder
        suggestion
        defaultValue
        quickOptions {
          value
          label
        }
      }
    }
    createdAt
  }
`;

const GET_ACTIVE_CONVERSATION = gql`
  ${AI_MESSAGE_FRAGMENT}
  query GetActiveConversation($caseId: ID) {
    activeConversation(caseId: $caseId) {
      id
      status
      messages {
        ...AIMessageFields
      }
    }
  }
`;

const SEND_MESSAGE = gql`
  ${AI_MESSAGE_FRAGMENT}
  mutation SendAssistantMessage($input: SendMessageInput!) {
    sendAssistantMessage(input: $input) {
      message {
        ...AIMessageFields
      }
      conversation {
        id
        status
      }
      suggestedFollowUps
    }
  }
`;

const CONFIRM_ACTION = gql`
  mutation ConfirmAction($input: ConfirmActionInput!) {
    confirmAction(input: $input) {
      success
      message
      entityId
      entityType
      navigationUrl
      error
    }
  }
`;

const GET_MORNING_BRIEFING = gql`
  query GetMorningBriefing {
    morningBriefing {
      message
      urgentTasks {
        id
        title
        priority
        dueDate
        caseTitle
        isOverdue
      }
      todayTasks {
        id
        title
        priority
        dueDate
        caseTitle
        isOverdue
      }
      upcomingDeadlines {
        id
        title
        dueDate
        caseTitle
        daysUntilDue
      }
      unreadEmailsCount
      aiSummary
    }
  }
`;

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of retry attempts for retryable errors
 */
const MAX_RETRIES = 2;

/**
 * Base delay for exponential backoff (ms)
 */
const BASE_DELAY = 1000;

/**
 * Romanian error messages for the frontend
 */
const ERROR_MESSAGES = {
  GENERIC: 'A apărut o eroare. Încercați din nou.',
  NETWORK: 'Verificați conexiunea la internet.',
  RATE_LIMIT: 'Prea multe cereri. Așteptați un moment.',
  SERVICE_ERROR: 'Serviciul nu este disponibil. Încercați din nou.',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Delay helper for retry logic
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if an error is retryable (network/timeout issues)
 */
const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('503') ||
      message.includes('fetch') ||
      message.includes('econnrefused') ||
      message.includes('service unavailable')
    );
  }
  return false;
};

/**
 * Categorize error and return appropriate Romanian message
 */
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('429') || message.includes('too many')) {
      return ERROR_MESSAGES.RATE_LIMIT;
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return ERROR_MESSAGES.NETWORK;
    }

    if (message.includes('503') || message.includes('service') || message.includes('unavailable')) {
      return ERROR_MESSAGES.SERVICE_ERROR;
    }

    // Return the original message if it's already in Romanian or is specific
    if (message.includes('nu am') || message.includes('nu aveți') || message.includes('eroare')) {
      return error.message;
    }
  }

  return ERROR_MESSAGES.GENERIC;
};

// ============================================================================
// Types
// ============================================================================

/**
 * Result from executing a confirmed action
 */
export interface ActionResult {
  success: boolean;
  message: string;
  entityId?: string;
  entityType?: string;
  navigationUrl?: string;
  error?: string;
}

/**
 * Morning briefing data
 */
export interface MorningBriefingData {
  message: string;
  urgentTasks: {
    id: string;
    title: string;
    priority: string;
    dueDate: string | null;
    caseTitle: string | null;
    isOverdue: boolean;
  }[];
  todayTasks: {
    id: string;
    title: string;
    priority: string;
    dueDate: string | null;
    caseTitle: string | null;
    isOverdue: boolean;
  }[];
  upcomingDeadlines: {
    id: string;
    title: string;
    dueDate: string;
    caseTitle: string | null;
    daysUntilDue: number;
  }[];
  unreadEmailsCount: number;
  aiSummary?: string;
}

/**
 * GraphQL response for active conversation query
 */
interface ActiveConversationData {
  activeConversation: {
    id: string;
    status: string;
    messages: AIMessage[];
  } | null;
}

/**
 * GraphQL response for send message mutation
 */
interface SendMessageData {
  sendAssistantMessage: {
    message: AIMessage;
    conversation: {
      id: string;
      status: string;
    };
    suggestedFollowUps: string[];
  };
}

/**
 * GraphQL response for confirm action mutation
 */
interface ConfirmActionData {
  confirmAction: ActionResult;
}

/**
 * GraphQL response for morning briefing query
 */
interface MorningBriefingResponse {
  morningBriefing: MorningBriefingData;
}

/**
 * Return type of useAssistant hook
 */
export interface UseAssistantReturn {
  // State
  isOpen: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  error: string | null;
  messages: AIMessage[];
  pendingAction: ProposedAction | null;
  suggestedFollowUps: string[];
  unreadCount: number;
  briefingLoading: boolean;

  // Actions
  toggleOpen: () => void;
  toggleExpanded: () => void;
  sendMessage: (content: string) => Promise<void>;
  confirmAction: (
    confirmed: boolean,
    modifications?: Record<string, unknown>
  ) => Promise<ActionResult>;
  clearConversation: () => void;
  clearError: () => void;
  setContext: (context: Partial<AssistantContext>) => void;
  requestBriefing: () => Promise<void>;

  // Computed
  hasActiveConversation: boolean;
  hasPendingConfirmation: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for interacting with the AI assistant.
 * Connects the Zustand store to GraphQL operations.
 */
export function useAssistant(): UseAssistantReturn {
  const store = useAssistantStore();
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Get context from AIAssistantContext (set by pages)
  const { context: aiContext } = useAIAssistant();

  const [sendMessageMutation] = useMutation<SendMessageData>(SEND_MESSAGE);
  const [confirmActionMutation] = useMutation<ConfirmActionData>(CONFIRM_ACTION, {
    // Invalidate cache entries so fresh data is fetched when navigating to those pages
    update: (cache, { data }) => {
      if (data?.confirmAction.success) {
        // Evict all task-related cache entries
        cache.evict({ fieldName: 'tasks' });
        cache.evict({ fieldName: 'myTasks' });
        cache.evict({ fieldName: 'tasksByCase' });
        // Also evict case-related entries for case updates
        cache.evict({ fieldName: 'cases' });
        cache.evict({ fieldName: 'caseTimeline' });
        // Trigger garbage collection to clean up orphaned references
        cache.gc();
      }
    },
  });
  const [loadConversation] = useLazyQuery<ActiveConversationData>(GET_ACTIVE_CONVERSATION);
  const [loadBriefing] = useLazyQuery<MorningBriefingResponse>(GET_MORNING_BRIEFING);

  // Extract setContext to avoid stale closures and infinite loops
  const setStoreContext = store.setContext;

  // Sync AIAssistantContext to Zustand store
  useEffect(() => {
    // Map section context to store context
    if (aiContext.section === 'case' && aiContext.entityId) {
      setStoreContext({ currentCaseId: aiContext.entityId, currentScreen: 'case-workspace' });
    } else {
      setStoreContext({ currentCaseId: undefined, currentScreen: aiContext.section });
    }
  }, [aiContext.section, aiContext.entityId, setStoreContext]);

  // Extract stable values to avoid stale closures
  const isOpen = store.isOpen;
  const conversationId = store.conversationId;
  const currentCaseId = store.context.currentCaseId;
  const setConversation = store.setConversation;

  // Load existing conversation on mount when opening
  useEffect(() => {
    const fetchConversation = async () => {
      if (isOpen && !conversationId) {
        try {
          const result = await loadConversation({
            variables: { caseId: currentCaseId },
          });
          if (result.data?.activeConversation) {
            setConversation(
              result.data.activeConversation.id,
              result.data.activeConversation.messages
            );
          }
        } catch {
          // Silently handle - conversation will be created on first message
        }
      }
    };
    fetchConversation();
  }, [isOpen, conversationId, currentCaseId, loadConversation, setConversation]);

  /**
   * Send a message to the AI assistant with retry logic.
   * Implements exponential backoff for retryable errors.
   */
  const sendMessage = useCallback(
    async (content: string, retryCount = 0) => {
      // Only set loading and add user message on first attempt
      if (retryCount === 0) {
        store.setLoading(true);
        store.setError(null);

        // Optimistically add user message
        store.addMessage({
          id: `temp-${Date.now()}`,
          role: 'User',
          content,
          createdAt: new Date().toISOString(),
        });
      }

      try {
        const result = await sendMessageMutation({
          variables: {
            input: {
              conversationId: store.conversationId,
              content,
              caseId: store.context.currentCaseId,
              context: store.context,
            },
          },
        });

        const response = result.data?.sendAssistantMessage;
        if (response) {
          // Update conversation ID if new
          if (!store.conversationId) {
            store.setConversation(response.conversation.id, []);
          }

          // Add assistant message
          store.addMessage(response.message);

          // Update suggested follow-ups from response
          setSuggestedFollowUps(response.suggestedFollowUps || []);
        }
      } catch (error) {
        // Retry logic with exponential backoff for retryable errors
        if (retryCount < MAX_RETRIES && isRetryableError(error)) {
          console.log(`[useAssistant] Retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          await delay(BASE_DELAY * Math.pow(2, retryCount)); // Exponential backoff
          return sendMessage(content, retryCount + 1);
        }

        // Use categorized error message
        store.setError(getErrorMessage(error));
      } finally {
        store.setLoading(false);
      }
    },
    [store, sendMessageMutation]
  );

  /**
   * Confirm or reject a proposed action
   */
  const confirmAction = useCallback(
    async (confirmed: boolean, modifications?: Record<string, unknown>): Promise<ActionResult> => {
      if (!store.pendingAction) {
        return { success: false, message: 'Nu există acțiune în așteptare.' };
      }

      store.setLoading(true);

      try {
        // Find the LAST (most recent) message with the pending action
        // Using reverse + find since findLast may not be available in all environments
        const messageId = [...store.messages]
          .reverse()
          .find((m) => m.proposedAction?.status === 'Proposed')?.id;

        if (!messageId) {
          throw new Error('Mesajul cu acțiunea nu a fost găsit.');
        }

        const result = await confirmActionMutation({
          variables: {
            input: {
              messageId,
              confirmed,
              modifications,
            },
          },
        });

        const actionResult = result.data?.confirmAction;

        if (!actionResult) {
          throw new Error('Nu s-a primit răspuns de la server.');
        }

        // Clear pending action
        store.setPendingAction(null);

        // Add confirmation message
        store.addMessage({
          id: `confirm-${Date.now()}`,
          role: 'Assistant',
          content: actionResult.message,
          createdAt: new Date().toISOString(),
        });

        return actionResult;
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        store.setError(errorMessage);
        return {
          success: false,
          message: errorMessage,
          error: errorMessage,
        };
      } finally {
        store.setLoading(false);
      }
    },
    [store, confirmActionMutation]
  );

  /**
   * Request the morning briefing and display it as an assistant message
   */
  const requestBriefing = useCallback(async () => {
    setBriefingLoading(true);
    store.setError(null);

    try {
      const result = await loadBriefing();

      if (result.data?.morningBriefing) {
        const briefing = result.data.morningBriefing;

        // Add the briefing as an assistant message
        store.addMessage({
          id: `briefing-${Date.now()}`,
          role: 'Assistant',
          content: briefing.message,
          intent: 'MorningBriefing',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      store.setError(getErrorMessage(error));
    } finally {
      setBriefingLoading(false);
    }
  }, [store, loadBriefing]);

  /**
   * Clear the current error message
   */
  const clearError = useCallback(() => {
    store.setError(null);
  }, [store]);

  return {
    // State
    isOpen: store.isOpen,
    isExpanded: store.isExpanded,
    isLoading: store.isLoading,
    error: store.error,
    messages: store.messages,
    pendingAction: store.pendingAction,
    suggestedFollowUps,
    unreadCount: store.unreadCount,
    briefingLoading,

    // Actions
    toggleOpen: store.toggleOpen,
    toggleExpanded: store.toggleExpanded,
    sendMessage,
    confirmAction,
    clearConversation: store.clearConversation,
    clearError,
    setContext: store.setContext,
    requestBriefing,

    // Computed
    hasActiveConversation: !!store.conversationId,
    hasPendingConfirmation: !!store.pendingAction,
  };
}
