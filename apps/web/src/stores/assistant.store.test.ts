/**
 * Tests for assistant.store
 */

import { renderHook, act } from '@testing-library/react';
import {
  useAssistantStore,
  useIsAssistantOpen,
  useAssistantMessages,
  usePendingAction,
  useAssistantContext,
  useUnreadCount,
  useHasUnreadMessages,
  useAssistantLoading,
  useAssistantError,
  useConversationId,
  type AIMessage,
  type ProposedAction,
} from './assistant.store';

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

// Helper to create mock messages
const createMockMessage = (overrides: Partial<AIMessage> = {}): AIMessage => ({
  id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  role: 'User',
  content: 'Test message',
  createdAt: new Date().toISOString(),
  ...overrides,
});

// Helper to create mock actions
const createMockAction = (overrides: Partial<ProposedAction> = {}): ProposedAction => ({
  type: 'CREATE_TASK',
  displayText: 'Create new task',
  payload: { title: 'Test task' },
  status: 'Proposed',
  requiresConfirmation: true,
  confirmationPrompt: 'Create this task?',
  ...overrides,
});

// Initial state for resetting
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

describe('useAssistantStore', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();
    // Reset store state directly
    useAssistantStore.setState(initialState);
  });

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const { result } = renderHook(() => useAssistantStore());

      expect(result.current.isOpen).toBe(false);
      expect(result.current.isExpanded).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.conversationId).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.pendingAction).toBeNull();
      expect(result.current.context).toEqual({});
      expect(result.current.hasUnreadMessages).toBe(false);
      expect(result.current.unreadCount).toBe(0);
    });
  });

  describe('toggleOpen', () => {
    it('opens the assistant', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.toggleOpen();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('closes the assistant', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.toggleOpen(); // Open
        result.current.toggleOpen(); // Close
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('auto-expands when opening', () => {
      const { result } = renderHook(() => useAssistantStore());

      expect(result.current.isExpanded).toBe(false);

      act(() => {
        result.current.toggleOpen();
      });

      expect(result.current.isExpanded).toBe(true);
    });

    it('clears unread messages when opening', () => {
      const { result } = renderHook(() => useAssistantStore());

      // Add a message while closed to create unread
      act(() => {
        result.current.addMessage(createMockMessage({ role: 'Assistant' }));
      });

      expect(result.current.hasUnreadMessages).toBe(true);
      expect(result.current.unreadCount).toBe(1);

      act(() => {
        result.current.toggleOpen();
      });

      expect(result.current.hasUnreadMessages).toBe(false);
      expect(result.current.unreadCount).toBe(0);
    });

    it('preserves expanded state when closing', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.toggleOpen(); // Open (auto-expands)
      });

      expect(result.current.isExpanded).toBe(true);

      act(() => {
        result.current.toggleOpen(); // Close
      });

      expect(result.current.isExpanded).toBe(true); // Still expanded
    });
  });

  describe('toggleExpanded', () => {
    it('toggles expanded state', () => {
      const { result } = renderHook(() => useAssistantStore());

      expect(result.current.isExpanded).toBe(false);

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

  describe('setLoading', () => {
    it('sets loading state', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('sets error message', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.setError('Something went wrong');
      });

      expect(result.current.error).toBe('Something went wrong');
    });

    it('clears error when set to null', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.setError('Error');
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('setConversation', () => {
    it('sets conversation ID and messages', () => {
      const { result } = renderHook(() => useAssistantStore());
      const messages = [createMockMessage(), createMockMessage({ role: 'Assistant' })];

      act(() => {
        result.current.setConversation('conv-123', messages);
      });

      expect(result.current.conversationId).toBe('conv-123');
      expect(result.current.messages).toEqual(messages);
    });

    it('clears pending action when setting conversation', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.setPendingAction(createMockAction());
      });

      expect(result.current.pendingAction).not.toBeNull();

      act(() => {
        result.current.setConversation('conv-123', []);
      });

      expect(result.current.pendingAction).toBeNull();
    });
  });

  describe('addMessage', () => {
    it('adds a message to the list', () => {
      const { result } = renderHook(() => useAssistantStore());
      const message = createMockMessage();

      act(() => {
        result.current.addMessage(message);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual(message);
    });

    it('tracks unread for assistant messages when closed', () => {
      const { result } = renderHook(() => useAssistantStore());

      // Assistant is closed by default
      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.addMessage(createMockMessage({ role: 'Assistant' }));
      });

      expect(result.current.hasUnreadMessages).toBe(true);
      expect(result.current.unreadCount).toBe(1);

      act(() => {
        result.current.addMessage(createMockMessage({ role: 'Assistant' }));
      });

      expect(result.current.unreadCount).toBe(2);
    });

    it('does not track unread for user messages', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.addMessage(createMockMessage({ role: 'User' }));
      });

      expect(result.current.hasUnreadMessages).toBe(false);
      expect(result.current.unreadCount).toBe(0);
    });

    it('does not track unread when assistant is open', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.toggleOpen(); // Open
      });

      act(() => {
        result.current.addMessage(createMockMessage({ role: 'Assistant' }));
      });

      expect(result.current.hasUnreadMessages).toBe(false);
      expect(result.current.unreadCount).toBe(0);
    });

    it('sets pending action from message with requiresConfirmation', () => {
      const { result } = renderHook(() => useAssistantStore());
      const action = createMockAction({ requiresConfirmation: true });
      const message = createMockMessage({
        role: 'Assistant',
        proposedAction: action,
      });

      act(() => {
        result.current.addMessage(message);
      });

      expect(result.current.pendingAction).toEqual(action);
    });

    it('does not set pending action when requiresConfirmation is false', () => {
      const { result } = renderHook(() => useAssistantStore());
      const action = createMockAction({ requiresConfirmation: false });
      const message = createMockMessage({
        role: 'Assistant',
        proposedAction: action,
      });

      act(() => {
        result.current.addMessage(message);
      });

      expect(result.current.pendingAction).toBeNull();
    });
  });

  describe('setPendingAction', () => {
    it('sets pending action', () => {
      const { result } = renderHook(() => useAssistantStore());
      const action = createMockAction();

      act(() => {
        result.current.setPendingAction(action);
      });

      expect(result.current.pendingAction).toEqual(action);
    });

    it('clears pending action when set to null', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.setPendingAction(createMockAction());
        result.current.setPendingAction(null);
      });

      expect(result.current.pendingAction).toBeNull();
    });
  });

  describe('clearConversation', () => {
    it('clears conversation state', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.setConversation('conv-123', [createMockMessage()]);
        result.current.setPendingAction(createMockAction());
      });

      expect(result.current.conversationId).toBe('conv-123');
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.pendingAction).not.toBeNull();

      act(() => {
        result.current.clearConversation();
      });

      expect(result.current.conversationId).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.pendingAction).toBeNull();
    });
  });

  describe('markMessagesRead', () => {
    it('clears unread state', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.addMessage(createMockMessage({ role: 'Assistant' }));
        result.current.addMessage(createMockMessage({ role: 'Assistant' }));
      });

      expect(result.current.hasUnreadMessages).toBe(true);
      expect(result.current.unreadCount).toBe(2);

      act(() => {
        result.current.markMessagesRead();
      });

      expect(result.current.hasUnreadMessages).toBe(false);
      expect(result.current.unreadCount).toBe(0);
    });
  });

  describe('setContext', () => {
    it('sets context values', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.setContext({ currentScreen: '/cases' });
      });

      expect(result.current.context.currentScreen).toBe('/cases');
    });

    it('merges with existing context', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.setContext({ currentScreen: '/cases' });
        result.current.setContext({ currentCaseId: 'case-123' });
      });

      expect(result.current.context.currentScreen).toBe('/cases');
      expect(result.current.context.currentCaseId).toBe('case-123');
    });

    it('does not clear conversation when context changes', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.setConversation('conv-123', [createMockMessage()]);
        result.current.setContext({ currentCaseId: 'case-456' });
      });

      expect(result.current.conversationId).toBe('conv-123');
      expect(result.current.messages).toHaveLength(1);
    });
  });

  describe('clearContext', () => {
    it('clears all context', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.setContext({
          currentScreen: '/cases',
          currentCaseId: 'case-123',
          currentDocumentId: 'doc-456',
          selectedEmailId: 'email-789',
        });
      });

      expect(result.current.context.currentScreen).toBe('/cases');

      act(() => {
        result.current.clearContext();
      });

      expect(result.current.context).toEqual({});
    });
  });

  describe('localStorage persistence', () => {
    it('persists isExpanded to localStorage', () => {
      const { result: result1 } = renderHook(() => useAssistantStore());

      act(() => {
        result1.current.toggleExpanded();
      });

      expect(result1.current.isExpanded).toBe(true);

      // Create new hook instance to simulate page reload
      const { result: result2 } = renderHook(() => useAssistantStore());

      expect(result2.current.isExpanded).toBe(true);
    });

    it('does not persist messages to localStorage', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.addMessage(createMockMessage());
        result.current.addMessage(createMockMessage());
      });

      expect(result.current.messages).toHaveLength(2);

      // Verify messages are NOT in localStorage
      const persistedState = localStorageMock.getItem('assistant-storage');
      if (persistedState) {
        const parsed = JSON.parse(persistedState);
        // Messages should not be in persisted state
        expect(parsed.state?.messages).toBeUndefined();
      }
    });

    it('does not persist conversationId to localStorage', () => {
      const { result } = renderHook(() => useAssistantStore());

      act(() => {
        result.current.setConversation('conv-123', []);
      });

      const persistedState = localStorageMock.getItem('assistant-storage');
      if (persistedState) {
        const parsed = JSON.parse(persistedState);
        expect(parsed.state?.conversationId).toBeUndefined();
      }
    });
  });
});

describe('Selectors', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useAssistantStore.setState(initialState);
  });

  it('useIsAssistantOpen returns isOpen state', () => {
    const { result: storeResult } = renderHook(() => useAssistantStore());
    const { result: selectorResult } = renderHook(() => useIsAssistantOpen());

    expect(selectorResult.current).toBe(false);

    act(() => {
      storeResult.current.toggleOpen();
    });

    expect(selectorResult.current).toBe(true);
  });

  it('useAssistantMessages returns messages', () => {
    const { result: storeResult } = renderHook(() => useAssistantStore());
    const { result: selectorResult } = renderHook(() => useAssistantMessages());
    const message = createMockMessage();

    expect(selectorResult.current).toEqual([]);

    act(() => {
      storeResult.current.addMessage(message);
    });

    expect(selectorResult.current).toHaveLength(1);
  });

  it('usePendingAction returns pending action', () => {
    const { result: storeResult } = renderHook(() => useAssistantStore());
    const { result: selectorResult } = renderHook(() => usePendingAction());
    const action = createMockAction();

    expect(selectorResult.current).toBeNull();

    act(() => {
      storeResult.current.setPendingAction(action);
    });

    expect(selectorResult.current).toEqual(action);
  });

  it('useAssistantContext returns context', () => {
    const { result: storeResult } = renderHook(() => useAssistantStore());
    const { result: selectorResult } = renderHook(() => useAssistantContext());

    expect(selectorResult.current).toEqual({});

    act(() => {
      storeResult.current.setContext({ currentCaseId: 'case-123' });
    });

    expect(selectorResult.current.currentCaseId).toBe('case-123');
  });

  it('useUnreadCount returns unread count', () => {
    const { result: storeResult } = renderHook(() => useAssistantStore());
    const { result: selectorResult } = renderHook(() => useUnreadCount());

    expect(selectorResult.current).toBe(0);

    act(() => {
      storeResult.current.addMessage(createMockMessage({ role: 'Assistant' }));
    });

    expect(selectorResult.current).toBe(1);
  });

  it('useHasUnreadMessages returns hasUnreadMessages', () => {
    const { result: storeResult } = renderHook(() => useAssistantStore());
    const { result: selectorResult } = renderHook(() => useHasUnreadMessages());

    expect(selectorResult.current).toBe(false);

    act(() => {
      storeResult.current.addMessage(createMockMessage({ role: 'Assistant' }));
    });

    expect(selectorResult.current).toBe(true);
  });

  it('useAssistantLoading returns loading state', () => {
    const { result: storeResult } = renderHook(() => useAssistantStore());
    const { result: selectorResult } = renderHook(() => useAssistantLoading());

    expect(selectorResult.current).toBe(false);

    act(() => {
      storeResult.current.setLoading(true);
    });

    expect(selectorResult.current).toBe(true);
  });

  it('useAssistantError returns error state', () => {
    const { result: storeResult } = renderHook(() => useAssistantStore());
    const { result: selectorResult } = renderHook(() => useAssistantError());

    expect(selectorResult.current).toBeNull();

    act(() => {
      storeResult.current.setError('Test error');
    });

    expect(selectorResult.current).toBe('Test error');
  });

  it('useConversationId returns conversation ID', () => {
    const { result: storeResult } = renderHook(() => useAssistantStore());
    const { result: selectorResult } = renderHook(() => useConversationId());

    expect(selectorResult.current).toBeNull();

    act(() => {
      storeResult.current.setConversation('conv-123', []);
    });

    expect(selectorResult.current).toBe('conv-123');
  });
});
