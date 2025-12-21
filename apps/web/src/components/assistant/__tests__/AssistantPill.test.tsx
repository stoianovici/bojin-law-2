/**
 * AssistantPill Component Tests
 * OPS-079: Integration Tests
 *
 * Basic component tests for AssistantPill.
 * Full integration testing is done via Playwright E2E tests in tests/e2e/assistant.spec.ts
 * and useAssistant hook tests in hooks/useAssistant.test.tsx.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing/react';
import { AssistantPill } from '../AssistantPill';
import { useAssistantStore } from '../../../stores/assistant.store';

// ============================================================================
// Setup
// ============================================================================

// Mock scrollIntoView as jsdom doesn't implement it
window.HTMLElement.prototype.scrollIntoView = jest.fn();

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

// Initial store state
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

// Create wrapper with Apollo mocks
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

describe('AssistantPill', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useAssistantStore.setState(initialState);
    // Mark briefing as shown to avoid briefing requests
    localStorageMock.setItem('assistantBriefingShownDate', new Date().toDateString());
  });

  describe('Rendering', () => {
    it('renders collapsed state initially', () => {
      render(<AssistantPill />, { wrapper: createWrapper() });

      expect(screen.getByTestId('assistant-pill')).toBeInTheDocument();
      expect(screen.queryByTestId('assistant-chat')).not.toBeInTheDocument();
    });

    it('expands when pill is clicked', async () => {
      const user = userEvent.setup();
      render(<AssistantPill />, { wrapper: createWrapper() });

      await user.click(screen.getByTestId('assistant-pill'));

      expect(screen.getByTestId('assistant-chat')).toBeInTheDocument();
    });

    it('collapses when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<AssistantPill />, { wrapper: createWrapper() });

      // Open
      await user.click(screen.getByTestId('assistant-pill'));
      expect(screen.getByTestId('assistant-chat')).toBeInTheDocument();

      // Close
      await user.click(screen.getByTestId('assistant-close'));
      expect(screen.queryByTestId('assistant-chat')).not.toBeInTheDocument();
    });

    it('has correct aria labels', () => {
      render(<AssistantPill />, { wrapper: createWrapper() });

      expect(screen.getByTestId('assistant-pill')).toHaveAttribute(
        'aria-label',
        'Deschide asistentul AI'
      );
    });

    it('shows unread count badge when messages are unread', () => {
      act(() => {
        useAssistantStore.setState({
          ...initialState,
          hasUnreadMessages: true,
          unreadCount: 3,
        });
      });

      render(<AssistantPill />, { wrapper: createWrapper() });

      expect(screen.getByTestId('assistant-pill')).toHaveTextContent('3');
    });
  });

  describe('Keyboard Interactions', () => {
    it('closes with Escape key', async () => {
      const user = userEvent.setup();
      render(<AssistantPill />, { wrapper: createWrapper() });

      // Open
      await user.click(screen.getByTestId('assistant-pill'));
      expect(screen.getByTestId('assistant-chat')).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('assistant-chat')).not.toBeInTheDocument();
    });
  });
});
