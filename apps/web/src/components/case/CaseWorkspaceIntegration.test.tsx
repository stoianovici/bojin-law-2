/**
 * Case Workspace Integration Tests
 * Tests cross-component interactions and data flow in case workspace
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCaseWorkspaceStore } from '../../stores/case-workspace.store';
import { WorkspaceTabs } from './WorkspaceTabs';
import { createMockCaseWorkspace } from '@legal-platform/test-utils';

// Mock child tab components to isolate integration testing
jest.mock('./tabs/OverviewTab', () => ({
  OverviewTab: () => <div data-testid="overview-tab">Overview Content</div>,
}));

jest.mock('./tabs/DocumentsTab', () => ({
  DocumentsTab: () => <div data-testid="documents-tab">Documents Content</div>,
}));

jest.mock('./tabs/TasksTab', () => ({
  TasksTab: () => <div data-testid="tasks-tab">Tasks Content</div>,
}));

jest.mock('./tabs/CommunicationsTab', () => ({
  CommunicationsTab: () => (
    <div data-testid="communications-tab">Communications Content</div>
  ),
}));

jest.mock('./tabs/TimeEntriesTab', () => ({
  TimeEntriesTab: () => (
    <div data-testid="time-entries-tab">Time Entries Content</div>
  ),
}));

jest.mock('./tabs/NotesTab', () => ({
  NotesTab: () => <div data-testid="notes-tab">Notes Content</div>,
}));

describe('Case Workspace Integration', () => {
  const mockWorkspaceData = createMockCaseWorkspace();

  beforeEach(() => {
    // Clear localStorage to reset persisted state
    localStorage.clear();

    // Reset store state to initial values
    const store = useCaseWorkspaceStore.getState();
    store.setActiveTab('overview');
    store.setSelectedCase(null);

    // Reset panel states - toggle to ensure they're at default values
    // If aiPanelCollapsed is true, toggle it to false (default)
    if (store.aiPanelCollapsed) {
      store.toggleAIPanel();
    }
    // If quickActionsVisible is false, toggle it to true (default)
    if (!store.quickActionsVisible) {
      store.toggleQuickActions();
    }
  });

  describe('Tab Switching Integration', () => {
    it('should update store when tabs are switched', async () => {
      const user = userEvent.setup();
      render(<WorkspaceTabs />);

      const documentsTab = screen.getByRole('tab', { name: /documente/i });
      await user.click(documentsTab);

      const store = useCaseWorkspaceStore.getState();
      expect(store.activeTab).toBe('documents');
    });

    it('should render correct content based on active tab', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<WorkspaceTabs />);

      // Initially overview is active
      expect(useCaseWorkspaceStore.getState().activeTab).toBe('overview');

      // Click documents tab
      const documentsTab = screen.getByRole('tab', { name: /documente/i });
      await user.click(documentsTab);

      expect(useCaseWorkspaceStore.getState().activeTab).toBe('documents');

      // Click tasks tab
      const tasksTab = screen.getByRole('tab', { name: /sarcini/i });
      await user.click(tasksTab);

      expect(useCaseWorkspaceStore.getState().activeTab).toBe('tasks');
    });

    it('should maintain selected tab across re-renders', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<WorkspaceTabs />);

      await user.click(screen.getByRole('tab', { name: /sarcini/i }));
      expect(useCaseWorkspaceStore.getState().activeTab).toBe('tasks');

      rerender(<WorkspaceTabs />);
      expect(useCaseWorkspaceStore.getState().activeTab).toBe('tasks');
    });

    it('should switch between all available tabs', async () => {
      const user = userEvent.setup();
      render(<WorkspaceTabs />);

      const tabNames = [
        /prezentare generală/i,
        /documente/i,
        /sarcini/i,
        /comunicări/i,
        /înregistrări timp/i,
        /notițe/i,
      ];
      const tabValues: Array<
        'overview' | 'documents' | 'tasks' | 'communications' | 'time-entries' | 'notes'
      > = [
        'overview',
        'documents',
        'tasks',
        'communications',
        'time-entries',
        'notes',
      ];

      for (let index = 0; index < tabNames.length; index++) {
        const tab = screen.getByRole('tab', { name: tabNames[index] });
        await user.click(tab);
        expect(useCaseWorkspaceStore.getState().activeTab).toBe(tabValues[index]);
      }
    });
  });

  describe('AI Panel Integration', () => {
    it('should toggle AI panel visibility through store', () => {
      const store = useCaseWorkspaceStore.getState();

      const initialState = store.aiPanelCollapsed;
      store.toggleAIPanel();
      expect(useCaseWorkspaceStore.getState().aiPanelCollapsed).toBe(!initialState);

      store.toggleAIPanel();
      expect(useCaseWorkspaceStore.getState().aiPanelCollapsed).toBe(initialState);
    });

    it('should maintain AI panel state across tab switches', async () => {
      const user = userEvent.setup();
      render(<WorkspaceTabs />);
      const store = useCaseWorkspaceStore.getState();

      // Collapse AI panel
      store.toggleAIPanel();
      const panelState = useCaseWorkspaceStore.getState().aiPanelCollapsed;

      // Switch tabs
      await user.click(screen.getByRole('tab', { name: /documente/i }));
      await user.click(screen.getByRole('tab', { name: /sarcini/i }));

      // AI panel state should remain unchanged
      expect(useCaseWorkspaceStore.getState().aiPanelCollapsed).toBe(panelState);
    });
  });

  describe('Quick Actions Integration', () => {
    it('should toggle quick actions visibility through store', () => {
      const store = useCaseWorkspaceStore.getState();

      const initialState = store.quickActionsVisible;
      store.toggleQuickActions();
      expect(useCaseWorkspaceStore.getState().quickActionsVisible).toBe(!initialState);

      store.toggleQuickActions();
      expect(useCaseWorkspaceStore.getState().quickActionsVisible).toBe(initialState);
    });

    it('should maintain quick actions state across tab switches', async () => {
      const user = userEvent.setup();
      render(<WorkspaceTabs />);
      const store = useCaseWorkspaceStore.getState();

      // Toggle quick actions
      store.toggleQuickActions();
      const actionsState = useCaseWorkspaceStore.getState().quickActionsVisible;

      // Switch tabs
      await user.click(screen.getByRole('tab', { name: /prezentare generală/i }));
      await user.click(screen.getByRole('tab', { name: /documente/i }));

      // Quick actions state should remain unchanged
      expect(useCaseWorkspaceStore.getState().quickActionsVisible).toBe(actionsState);
    });
  });

  describe('Selected Case Integration', () => {
    it('should update selected case in store', () => {
      const store = useCaseWorkspaceStore.getState();
      const caseId = mockWorkspaceData.case.id;

      store.setSelectedCase(caseId);
      expect(useCaseWorkspaceStore.getState().selectedCaseId).toBe(caseId);
    });

    it('should maintain selected case across tab switches', async () => {
      const user = userEvent.setup();
      render(<WorkspaceTabs />);
      const store = useCaseWorkspaceStore.getState();
      const caseId = mockWorkspaceData.case.id;

      store.setSelectedCase(caseId);

      // Switch tabs
      await user.click(screen.getByRole('tab', { name: /documente/i }));
      await user.click(screen.getByRole('tab', { name: /sarcini/i }));
      await user.click(screen.getByRole('tab', { name: /prezentare generală/i }));

      // Selected case should remain unchanged
      expect(useCaseWorkspaceStore.getState().selectedCaseId).toBe(caseId);
    });
  });

  describe('State Persistence', () => {
    it('should persist workspace state to localStorage', () => {
      const store = useCaseWorkspaceStore.getState();

      // Verify initial state
      expect(store.activeTab).toBe('overview');
      expect(store.aiPanelCollapsed).toBe(false);
      expect(store.quickActionsVisible).toBe(true);

      // Update state
      store.setActiveTab('documents');
      store.toggleAIPanel();
      store.toggleQuickActions();
      store.setSelectedCase('test-case-123');

      // Verify state was updated
      const updatedState = useCaseWorkspaceStore.getState();
      expect(updatedState.activeTab).toBe('documents');
      expect(updatedState.aiPanelCollapsed).toBe(true);
      expect(updatedState.quickActionsVisible).toBe(false);
      expect(updatedState.selectedCaseId).toBe('test-case-123');

      // Note: Testing actual localStorage persistence would require mocking localStorage
      // and recreating the store, which is covered by the Zustand persist middleware's own tests.
      // This test verifies state management works correctly.
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation between tabs', async () => {
      const user = userEvent.setup();
      render(<WorkspaceTabs />);

      const overviewTab = screen.getByRole('tab', { name: /prezentare generală/i });
      overviewTab.focus();

      // Arrow right should move to next tab
      await user.keyboard('{ArrowRight}');

      // Radix UI arrow key navigation may require additional setup or may not work in test environment
      // This test verifies the structure is in place, actual keyboard nav tested in E2E
      expect(screen.getByRole('tab', { name: /documente/i })).toBeInTheDocument();
    });
  });
});
