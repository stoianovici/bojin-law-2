/**
 * CaseWorkspace Store Tests
 * Tests for case workspace state management
 */

import { act, renderHook } from '@testing-library/react';
import { useCaseWorkspaceStore } from './case-workspace.store';

describe('useCaseWorkspaceStore', () => {
  beforeEach(() => {
    // Clear localStorage to prevent test interference
    localStorage.clear();

    // Reset store state before each test
    const { result } = renderHook(() => useCaseWorkspaceStore());
    act(() => {
      result.current.setActiveTab('overview');
      result.current.setSelectedCase(null);

      // Reset panel states to defaults
      if (result.current.aiPanelCollapsed) {
        result.current.toggleAIPanel();
      }
      if (!result.current.quickActionsVisible) {
        result.current.toggleQuickActions();
      }
    });
  });

  describe('activeTab', () => {
    it('should have default activeTab as overview', () => {
      const { result } = renderHook(() => useCaseWorkspaceStore());
      expect(result.current.activeTab).toBe('overview');
    });

    it('should update activeTab when setActiveTab is called', () => {
      const { result } = renderHook(() => useCaseWorkspaceStore());

      act(() => {
        result.current.setActiveTab('documents');
      });

      expect(result.current.activeTab).toBe('documents');
    });

    it('should switch between all tab types', () => {
      const { result } = renderHook(() => useCaseWorkspaceStore());
      const tabs: Array<'overview' | 'documents' | 'tasks' | 'communications' | 'time-entries' | 'notes'> = [
        'overview',
        'documents',
        'tasks',
        'communications',
        'time-entries',
        'notes',
      ];

      tabs.forEach((tab) => {
        act(() => {
          result.current.setActiveTab(tab);
        });
        expect(result.current.activeTab).toBe(tab);
      });
    });
  });

  describe('aiPanelCollapsed', () => {
    it('should have default aiPanelCollapsed as false', () => {
      const { result } = renderHook(() => useCaseWorkspaceStore());
      expect(result.current.aiPanelCollapsed).toBe(false);
    });

    it('should toggle aiPanelCollapsed when toggleAIPanel is called', () => {
      const { result } = renderHook(() => useCaseWorkspaceStore());

      const initialState = result.current.aiPanelCollapsed;

      act(() => {
        result.current.toggleAIPanel();
      });

      expect(result.current.aiPanelCollapsed).toBe(!initialState);

      act(() => {
        result.current.toggleAIPanel();
      });

      expect(result.current.aiPanelCollapsed).toBe(initialState);
    });
  });

  describe('quickActionsVisible', () => {
    it('should have default quickActionsVisible as true', () => {
      const { result } = renderHook(() => useCaseWorkspaceStore());
      expect(result.current.quickActionsVisible).toBe(true);
    });

    it('should toggle quickActionsVisible when toggleQuickActions is called', () => {
      const { result } = renderHook(() => useCaseWorkspaceStore());

      const initialState = result.current.quickActionsVisible;

      act(() => {
        result.current.toggleQuickActions();
      });

      expect(result.current.quickActionsVisible).toBe(!initialState);

      act(() => {
        result.current.toggleQuickActions();
      });

      expect(result.current.quickActionsVisible).toBe(initialState);
    });
  });

  describe('selectedCaseId', () => {
    it('should have default selectedCaseId as null', () => {
      const { result } = renderHook(() => useCaseWorkspaceStore());
      expect(result.current.selectedCaseId).toBeNull();
    });

    it('should update selectedCaseId when setSelectedCase is called', () => {
      const { result } = renderHook(() => useCaseWorkspaceStore());
      const caseId = 'case-123';

      act(() => {
        result.current.setSelectedCase(caseId);
      });

      expect(result.current.selectedCaseId).toBe(caseId);
    });

    it('should allow setting selectedCaseId to null', () => {
      const { result } = renderHook(() => useCaseWorkspaceStore());

      act(() => {
        result.current.setSelectedCase('case-123');
      });
      expect(result.current.selectedCaseId).toBe('case-123');

      act(() => {
        result.current.setSelectedCase(null);
      });
      expect(result.current.selectedCaseId).toBeNull();
    });
  });

  describe('localStorage persistence', () => {
    it('should persist state to localStorage', () => {
      const { result } = renderHook(() => useCaseWorkspaceStore());

      act(() => {
        result.current.setActiveTab('documents');
        result.current.toggleAIPanel();
        result.current.toggleQuickActions();
        result.current.setSelectedCase('case-456');
      });

      // Create new hook instance to test persistence
      const { result: result2 } = renderHook(() => useCaseWorkspaceStore());

      expect(result2.current.activeTab).toBe('documents');
      expect(result2.current.aiPanelCollapsed).toBe(true);
      expect(result2.current.quickActionsVisible).toBe(false);
      expect(result2.current.selectedCaseId).toBe('case-456');
    });
  });

  describe('state interactions', () => {
    it('should maintain independent state for each property', () => {
      const { result } = renderHook(() => useCaseWorkspaceStore());

      act(() => {
        result.current.setActiveTab('tasks');
      });
      expect(result.current.activeTab).toBe('tasks');
      expect(result.current.aiPanelCollapsed).toBe(false);
      expect(result.current.quickActionsVisible).toBe(true);

      act(() => {
        result.current.toggleAIPanel();
      });
      expect(result.current.activeTab).toBe('tasks');
      expect(result.current.aiPanelCollapsed).toBe(true);
      expect(result.current.quickActionsVisible).toBe(true);

      act(() => {
        result.current.toggleQuickActions();
      });
      expect(result.current.activeTab).toBe('tasks');
      expect(result.current.aiPanelCollapsed).toBe(true);
      expect(result.current.quickActionsVisible).toBe(false);
    });
  });
});
