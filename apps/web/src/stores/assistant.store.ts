/**
 * Assistant Store
 * Zustand store for managing the AI assistant UI state, including
 * conversation state, messages, pending actions, and context.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

/**
 * Message role in conversation
 */
export type MessageRole = 'User' | 'Assistant' | 'System';

/**
 * Status of a proposed action
 */
export type ActionStatus = 'Proposed' | 'Confirmed' | 'Executed' | 'Rejected' | 'Failed';

/**
 * A proposed action from the AI assistant
 */
export interface ProposedAction {
  type: string;
  displayText: string;
  payload: Record<string, unknown>;
  status: ActionStatus;
  requiresConfirmation: boolean;
  confirmationPrompt?: string;
  entityPreview?: Record<string, unknown>;
}

/**
 * A message in the conversation
 */
export interface AIMessage {
  id: string;
  role: MessageRole;
  content: string;
  intent?: string;
  confidence?: number;
  proposedAction?: ProposedAction;
  createdAt: string;
}

/**
 * Context for the assistant (current screen, case, etc.)
 */
export interface AssistantContext {
  currentScreen?: string;
  currentCaseId?: string;
  currentDocumentId?: string;
  selectedEmailId?: string;
}

/**
 * Assistant store state interface
 */
interface AssistantState {
  // UI State
  isOpen: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  error: string | null;

  // Conversation State
  conversationId: string | null;
  messages: AIMessage[];
  pendingAction: ProposedAction | null;

  // Context
  context: AssistantContext;

  // Computed (tracked as state for reactivity)
  hasUnreadMessages: boolean;
  unreadCount: number;

  // UI Actions
  toggleOpen: () => void;
  toggleExpanded: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Conversation Actions
  setConversation: (id: string, messages: AIMessage[]) => void;
  addMessage: (message: AIMessage) => void;
  setPendingAction: (action: ProposedAction | null) => void;
  clearConversation: () => void;
  markMessagesRead: () => void;

  // Context Actions
  setContext: (context: Partial<AssistantContext>) => void;
  clearContext: () => void;
}

// ============================================================================
// Store
// ============================================================================

/**
 * Assistant store with persistent UI preferences
 * Only persists isExpanded preference, not conversation state
 */
export const useAssistantStore = create<AssistantState>()(
  persist(
    (set, _get) => ({
      // Initial State
      isOpen: false,
      isExpanded: false,
      isLoading: false,
      error: null,

      conversationId: null,
      messages: [],
      pendingAction: null,

      context: {},

      hasUnreadMessages: false,
      unreadCount: 0,

      // UI Actions
      toggleOpen: () =>
        set((state) => {
          const willOpen = !state.isOpen;
          return {
            isOpen: willOpen,
            // Auto-expand when opening
            isExpanded: willOpen ? true : state.isExpanded,
            // Clear unread when opening
            hasUnreadMessages: willOpen ? false : state.hasUnreadMessages,
            unreadCount: willOpen ? 0 : state.unreadCount,
          };
        }),

      toggleExpanded: () =>
        set((state) => ({
          isExpanded: !state.isExpanded,
        })),

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      setError: (error: string | null) => set({ error }),

      // Conversation Actions
      setConversation: (id: string, messages: AIMessage[]) =>
        set({
          conversationId: id,
          messages,
          pendingAction: null,
        }),

      addMessage: (message: AIMessage) =>
        set((state) => {
          const isAssistantMessage = message.role === 'Assistant';
          // Set pending action if the message has one that requires confirmation
          const pendingAction = message.proposedAction?.requiresConfirmation
            ? message.proposedAction
            : null;

          return {
            messages: [...state.messages, message],
            pendingAction,
            // Track unread if assistant message and chat is closed
            hasUnreadMessages: !state.isOpen && isAssistantMessage,
            unreadCount:
              !state.isOpen && isAssistantMessage ? state.unreadCount + 1 : state.unreadCount,
          };
        }),

      setPendingAction: (action: ProposedAction | null) => set({ pendingAction: action }),

      clearConversation: () =>
        set({
          conversationId: null,
          messages: [],
          pendingAction: null,
        }),

      markMessagesRead: () =>
        set({
          hasUnreadMessages: false,
          unreadCount: 0,
        }),

      // Context Actions
      setContext: (context: Partial<AssistantContext>) =>
        set((state) => ({
          context: { ...state.context, ...context },
        })),

      clearContext: () => set({ context: {} }),
    }),
    {
      name: 'assistant-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist UI preferences, not conversation state
      partialize: (state) => ({
        isExpanded: state.isExpanded,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Hook to check if assistant is open
 */
export const useIsAssistantOpen = () => useAssistantStore((state) => state.isOpen);

/**
 * Hook to get assistant messages
 */
export const useAssistantMessages = () => useAssistantStore((state) => state.messages);

/**
 * Hook to get pending action
 */
export const usePendingAction = () => useAssistantStore((state) => state.pendingAction);

/**
 * Hook to get assistant context
 */
export const useAssistantContext = () => useAssistantStore((state) => state.context);

/**
 * Hook to get unread message count
 */
export const useUnreadCount = () => useAssistantStore((state) => state.unreadCount);

/**
 * Hook to check if there are unread messages
 */
export const useHasUnreadMessages = () => useAssistantStore((state) => state.hasUnreadMessages);

/**
 * Hook to get loading state
 */
export const useAssistantLoading = () => useAssistantStore((state) => state.isLoading);

/**
 * Hook to get error state
 */
export const useAssistantError = () => useAssistantStore((state) => state.error);

/**
 * Hook to get conversation ID
 */
export const useConversationId = () => useAssistantStore((state) => state.conversationId);
