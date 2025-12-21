/**
 * Tests for useAssistant hook
 * OPS-070: useAssistant Hook
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing/react';
import { gql } from '@apollo/client';
import { useAssistant } from './useAssistant';
import { useAssistantStore, type AIMessage } from '../stores/assistant.store';

// ============================================================================
// GraphQL Mocks
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

// ============================================================================
// Helpers
// ============================================================================

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Create mock message
const createMockMessage = (overrides: Partial<AIMessage> = {}): AIMessage => ({
  id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  role: 'User',
  content: 'Test message',
  createdAt: new Date().toISOString(),
  ...overrides,
});

// Initial state for resetting store
const initialState = {
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
};

// Wrapper component for providing Apollo MockedProvider
const createWrapper = (mocks: MockedResponse[] = []) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MockedProvider mocks={mocks} addTypename={false}>
        {children}
      </MockedProvider>
    );
  };
};

// ============================================================================
// Tests
// ============================================================================

describe('useAssistant', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useAssistantStore.setState(initialState);
  });

  describe('Initial State', () => {
    it('returns initial state from store', () => {
      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.isExpanded).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.pendingAction).toBeNull();
      expect(result.current.suggestedFollowUps).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.hasActiveConversation).toBe(false);
      expect(result.current.hasPendingConfirmation).toBe(false);
    });
  });

  describe('toggleOpen', () => {
    it('opens the assistant', () => {
      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.toggleOpen();
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('toggleExpanded', () => {
    it('toggles expanded state', () => {
      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.toggleExpanded();
      });

      expect(result.current.isExpanded).toBe(true);

      act(() => {
        result.current.toggleExpanded();
      });

      expect(result.current.isExpanded).toBe(false);
    });
  });

  describe('setContext', () => {
    it('sets context values', () => {
      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setContext({ currentCaseId: 'case-123' });
      });

      // The context is stored in the Zustand store, not returned directly
      const store = useAssistantStore.getState();
      expect(store.context.currentCaseId).toBe('case-123');
    });
  });

  describe('clearConversation', () => {
    it('clears conversation state', () => {
      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper(),
      });

      // Set up some conversation state
      act(() => {
        useAssistantStore.getState().setConversation('conv-123', [createMockMessage()]);
      });

      expect(result.current.hasActiveConversation).toBe(true);

      act(() => {
        result.current.clearConversation();
      });

      expect(result.current.hasActiveConversation).toBe(false);
      expect(result.current.messages).toEqual([]);
    });
  });

  describe('sendMessage', () => {
    it('sends message and adds optimistic message immediately', async () => {
      // Test that the optimistic user message is added immediately
      // Apollo mocking for mutations is complex - focus on testing the hook behavior
      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper([]),
      });

      // Before sending, no messages
      expect(result.current.messages).toEqual([]);

      // Send a message - this should add an optimistic user message
      // The mutation will fail (no mock), but optimistic update should happen
      await act(async () => {
        // Don't await the sendMessage as it will throw due to no mock
        result.current.sendMessage('Hello AI').catch(() => {
          // Expected to fail - no mock configured
        });
      });

      // Wait for the optimistic update to apply
      await waitFor(() => {
        expect(result.current.messages.length).toBe(1);
      });

      // Check the optimistic user message was added
      expect(result.current.messages[0].content).toBe('Hello AI');
      expect(result.current.messages[0].role).toBe('User');
    });

    it('handles send message error', async () => {
      const mockError = {
        request: {
          query: SEND_MESSAGE,
          variables: {
            input: {
              conversationId: null,
              content: 'Hello AI',
              caseId: undefined,
              context: {},
            },
          },
        },
        error: new Error('Network error'),
      };

      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper([mockError]),
      });

      await act(async () => {
        await result.current.sendMessage('Hello AI');
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('confirmAction', () => {
    it('confirms action and clears pending', async () => {
      const mockConfirm = {
        request: {
          query: CONFIRM_ACTION,
          variables: {
            input: {
              messageId: 'msg-with-action',
              confirmed: true,
              modifications: undefined,
            },
          },
        },
        result: {
          data: {
            confirmAction: {
              success: true,
              message: 'Sarcina a fost creată cu succes.',
              entityId: 'task-123',
              entityType: 'Task',
              navigationUrl: '/tasks/task-123',
              error: null,
            },
          },
        },
      };

      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper([mockConfirm]),
      });

      // Set up a message with pending action
      act(() => {
        useAssistantStore.getState().addMessage({
          id: 'msg-with-action',
          role: 'Assistant',
          content: 'I can create a task for you.',
          createdAt: new Date().toISOString(),
          proposedAction: {
            type: 'CreateTask',
            displayText: 'Create task',
            payload: { title: 'Test task' },
            status: 'Proposed',
            requiresConfirmation: true,
            confirmationPrompt: 'Create this task?',
          },
        });
      });

      expect(result.current.hasPendingConfirmation).toBe(true);

      let actionResult;
      await act(async () => {
        actionResult = await result.current.confirmAction(true);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(actionResult).toEqual({
        success: true,
        message: 'Sarcina a fost creată cu succes.',
        entityId: 'task-123',
        entityType: 'Task',
        navigationUrl: '/tasks/task-123',
        error: null,
      });
      expect(result.current.hasPendingConfirmation).toBe(false);
    });

    it('rejects action and adds message', async () => {
      const mockReject = {
        request: {
          query: CONFIRM_ACTION,
          variables: {
            input: {
              messageId: 'msg-with-action',
              confirmed: false,
              modifications: undefined,
            },
          },
        },
        result: {
          data: {
            confirmAction: {
              success: true,
              message: 'Acțiune anulată.',
              entityId: null,
              entityType: null,
              navigationUrl: null,
              error: null,
            },
          },
        },
      };

      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper([mockReject]),
      });

      // Set up a message with pending action
      act(() => {
        useAssistantStore.getState().addMessage({
          id: 'msg-with-action',
          role: 'Assistant',
          content: 'I can create a task for you.',
          createdAt: new Date().toISOString(),
          proposedAction: {
            type: 'CreateTask',
            displayText: 'Create task',
            payload: { title: 'Test task' },
            status: 'Proposed',
            requiresConfirmation: true,
            confirmationPrompt: 'Create this task?',
          },
        });
      });

      await act(async () => {
        await result.current.confirmAction(false);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasPendingConfirmation).toBe(false);
    });

    it('returns error when no pending action', async () => {
      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper(),
      });

      let actionResult;
      await act(async () => {
        actionResult = await result.current.confirmAction(true);
      });

      expect(actionResult).toEqual({
        success: false,
        message: 'Nu există acțiune în așteptare.',
      });
    });
  });

  describe('loadConversation on open', () => {
    it('loads conversation when opened', async () => {
      const mockConversation = {
        request: {
          query: GET_ACTIVE_CONVERSATION,
          variables: { caseId: undefined },
        },
        result: {
          data: {
            activeConversation: {
              id: 'conv-existing-1',
              status: 'Active',
              messages: [
                {
                  id: 'msg-1',
                  role: 'User',
                  content: 'Previous message',
                  intent: null,
                  confidence: null,
                  proposedAction: null,
                  createdAt: new Date().toISOString(),
                },
                {
                  id: 'msg-2',
                  role: 'Assistant',
                  content: 'Previous response',
                  intent: 'GeneralChat',
                  confidence: 0.9,
                  proposedAction: null,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          },
        },
      };

      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper([mockConversation]),
      });

      // Open the assistant
      act(() => {
        result.current.toggleOpen();
      });

      await waitFor(() => {
        expect(result.current.hasActiveConversation).toBe(true);
      });

      expect(result.current.messages).toHaveLength(2);
    });

    it('updates context without resetting conversation', () => {
      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper(),
      });

      // Set up conversation
      act(() => {
        useAssistantStore.getState().setConversation('conv-123', [createMockMessage()]);
      });

      expect(result.current.hasActiveConversation).toBe(true);
      expect(result.current.messages).toHaveLength(1);

      // Update context
      act(() => {
        result.current.setContext({ currentScreen: '/cases' });
      });

      // Conversation should still be there
      expect(result.current.hasActiveConversation).toBe(true);
      expect(result.current.messages).toHaveLength(1);
    });
  });

  describe('computed properties', () => {
    it('hasActiveConversation returns true when conversation exists', () => {
      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasActiveConversation).toBe(false);

      act(() => {
        useAssistantStore.getState().setConversation('conv-123', []);
      });

      expect(result.current.hasActiveConversation).toBe(true);
    });

    it('hasPendingConfirmation returns true when action pending', () => {
      const { result } = renderHook(() => useAssistant(), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasPendingConfirmation).toBe(false);

      act(() => {
        useAssistantStore.getState().setPendingAction({
          type: 'CreateTask',
          displayText: 'Create task',
          payload: {},
          status: 'Proposed',
          requiresConfirmation: true,
        });
      });

      expect(result.current.hasPendingConfirmation).toBe(true);
    });
  });
});
