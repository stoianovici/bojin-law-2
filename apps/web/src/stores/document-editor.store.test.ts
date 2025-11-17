/**
 * Tests for document-editor.store
 */

import { renderHook, act } from '@testing-library/react';
import {
  useDocumentEditorStore,
  selectIsAIPanelCollapsed,
  selectIsCommentsSidebarOpen,
  selectActiveView,
  selectCurrentDocument,
} from './document-editor.store';
import type { DocumentMetadata } from '@law-firm/types';

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

describe('useDocumentEditorStore', () => {
  beforeEach(() => {
    // Clear store and localStorage before each test
    localStorageMock.clear();
    const { result } = renderHook(() => useDocumentEditorStore());
    act(() => {
      result.current.resetState();
    });
  });

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      expect(result.current.isAIPanelCollapsed).toBe(false);
      expect(result.current.isCommentsSidebarOpen).toBe(false);
      expect(result.current.activeView).toBe('editor');
      expect(result.current.currentDocument).toBeNull();
    });

    it('has correct initial preferences', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      expect(result.current.preferences.aiPanelCollapsed).toBe(false);
      expect(result.current.preferences.commentsSidebarOpen).toBe(false);
    });
  });

  describe('toggleAIPanel', () => {
    it('toggles AI panel collapsed state from false to true', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      expect(result.current.isAIPanelCollapsed).toBe(false);

      act(() => {
        result.current.toggleAIPanel();
      });

      expect(result.current.isAIPanelCollapsed).toBe(true);
    });

    it('toggles AI panel collapsed state from true to false', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.toggleAIPanel();
      });

      expect(result.current.isAIPanelCollapsed).toBe(true);

      act(() => {
        result.current.toggleAIPanel();
      });

      expect(result.current.isAIPanelCollapsed).toBe(false);
    });

    it('updates preferences when toggled', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.toggleAIPanel();
      });

      expect(result.current.preferences.aiPanelCollapsed).toBe(true);
    });

    it('persists AI panel state to localStorage', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.toggleAIPanel();
      });

      const stored = localStorage.getItem('document-editor-preferences');
      expect(stored).toBeTruthy();

      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.preferences.aiPanelCollapsed).toBe(true);
      }
    });
  });

  describe('toggleCommentsSidebar', () => {
    it('toggles comments sidebar open state from false to true', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      expect(result.current.isCommentsSidebarOpen).toBe(false);

      act(() => {
        result.current.toggleCommentsSidebar();
      });

      expect(result.current.isCommentsSidebarOpen).toBe(true);
    });

    it('toggles comments sidebar open state from true to false', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.toggleCommentsSidebar();
      });

      expect(result.current.isCommentsSidebarOpen).toBe(true);

      act(() => {
        result.current.toggleCommentsSidebar();
      });

      expect(result.current.isCommentsSidebarOpen).toBe(false);
    });

    it('updates preferences when toggled', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.toggleCommentsSidebar();
      });

      expect(result.current.preferences.commentsSidebarOpen).toBe(true);
    });

    it('persists comments sidebar state to localStorage', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.toggleCommentsSidebar();
      });

      const stored = localStorage.getItem('document-editor-preferences');
      expect(stored).toBeTruthy();

      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.preferences.commentsSidebarOpen).toBe(true);
      }
    });
  });

  describe('setActiveView', () => {
    it('sets active view to editor', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.setActiveView('editor');
      });

      expect(result.current.activeView).toBe('editor');
    });

    it('sets active view to version-comparison', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.setActiveView('version-comparison');
      });

      expect(result.current.activeView).toBe('version-comparison');
    });

    it('can switch between views', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.setActiveView('version-comparison');
      });

      expect(result.current.activeView).toBe('version-comparison');

      act(() => {
        result.current.setActiveView('editor');
      });

      expect(result.current.activeView).toBe('editor');
    });

    it('does not persist active view to localStorage', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.setActiveView('version-comparison');
      });

      const stored = localStorage.getItem('document-editor-preferences');

      if (stored) {
        const parsed = JSON.parse(stored);
        // Active view should not be in persisted preferences
        expect(parsed.state.preferences.activeView).toBeUndefined();
      }
    });
  });

  describe('setCurrentDocument', () => {
    const mockDocument: DocumentMetadata = {
      id: 'doc-123',
      title: 'Test Document',
      type: 'Contract',
      version: 2,
      lastModified: '2024-11-15',
    };

    it('sets current document', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.setCurrentDocument(mockDocument);
      });

      expect(result.current.currentDocument).toEqual(mockDocument);
    });

    it('can update current document', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.setCurrentDocument(mockDocument);
      });

      const updatedDocument = { ...mockDocument, version: 3 };

      act(() => {
        result.current.setCurrentDocument(updatedDocument);
      });

      expect(result.current.currentDocument).toEqual(updatedDocument);
    });

    it('can clear current document by setting to null', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.setCurrentDocument(mockDocument);
      });

      expect(result.current.currentDocument).toEqual(mockDocument);

      act(() => {
        result.current.setCurrentDocument(null);
      });

      expect(result.current.currentDocument).toBeNull();
    });

    it('does not persist current document to localStorage', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.setCurrentDocument(mockDocument);
      });

      const stored = localStorage.getItem('document-editor-preferences');

      if (stored) {
        const parsed = JSON.parse(stored);
        // Current document should not be in persisted preferences
        expect(parsed.state.preferences.currentDocument).toBeUndefined();
      }
    });
  });

  describe('resetState', () => {
    it('resets all state to initial values', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      // Modify state
      act(() => {
        result.current.toggleAIPanel();
        result.current.toggleCommentsSidebar();
        result.current.setActiveView('version-comparison');
        result.current.setCurrentDocument({
          id: 'doc-123',
          title: 'Test',
          type: 'Contract',
          version: 1,
          lastModified: '2024-11-15',
        });
      });

      // Verify state changed
      expect(result.current.isAIPanelCollapsed).toBe(true);
      expect(result.current.isCommentsSidebarOpen).toBe(true);
      expect(result.current.activeView).toBe('version-comparison');
      expect(result.current.currentDocument).not.toBeNull();

      // Reset
      act(() => {
        result.current.resetState();
      });

      // Verify all back to initial state
      expect(result.current.isAIPanelCollapsed).toBe(false);
      expect(result.current.isCommentsSidebarOpen).toBe(false);
      expect(result.current.activeView).toBe('editor');
      expect(result.current.currentDocument).toBeNull();
    });

    it('resets preferences to initial values', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.toggleAIPanel();
        result.current.toggleCommentsSidebar();
      });

      expect(result.current.preferences.aiPanelCollapsed).toBe(true);
      expect(result.current.preferences.commentsSidebarOpen).toBe(true);

      act(() => {
        result.current.resetState();
      });

      expect(result.current.preferences.aiPanelCollapsed).toBe(false);
      expect(result.current.preferences.commentsSidebarOpen).toBe(false);
    });
  });

  describe('Selectors', () => {
    it('selectIsAIPanelCollapsed returns correct value', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      const initialCollapsed = selectIsAIPanelCollapsed(result.current);
      expect(initialCollapsed).toBe(false);

      act(() => {
        result.current.toggleAIPanel();
      });

      const afterToggle = selectIsAIPanelCollapsed(result.current);
      expect(afterToggle).toBe(true);
    });

    it('selectIsCommentsSidebarOpen returns correct value', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      const initialOpen = selectIsCommentsSidebarOpen(result.current);
      expect(initialOpen).toBe(false);

      act(() => {
        result.current.toggleCommentsSidebar();
      });

      const afterToggle = selectIsCommentsSidebarOpen(result.current);
      expect(afterToggle).toBe(true);
    });

    it('selectActiveView returns correct value', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      const initialView = selectActiveView(result.current);
      expect(initialView).toBe('editor');

      act(() => {
        result.current.setActiveView('version-comparison');
      });

      const afterSet = selectActiveView(result.current);
      expect(afterSet).toBe('version-comparison');
    });

    it('selectCurrentDocument returns correct value', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      const initialDoc = selectCurrentDocument(result.current);
      expect(initialDoc).toBeNull();

      const mockDoc: DocumentMetadata = {
        id: 'doc-123',
        title: 'Test',
        type: 'Contract',
        version: 1,
        lastModified: '2024-11-15',
      };

      act(() => {
        result.current.setCurrentDocument(mockDoc);
      });

      const afterSet = selectCurrentDocument(result.current);
      expect(afterSet).toEqual(mockDoc);
    });
  });

  describe('LocalStorage Persistence', () => {
    it('persists preferences to localStorage on state change', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.toggleAIPanel();
        result.current.toggleCommentsSidebar();
      });

      const stored = localStorage.getItem('document-editor-preferences');
      expect(stored).toBeTruthy();

      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.preferences.aiPanelCollapsed).toBe(true);
        expect(parsed.state.preferences.commentsSidebarOpen).toBe(true);
      }
    });

    it('only persists preferences, not current document or active view', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.toggleAIPanel();
        result.current.setActiveView('version-comparison');
        result.current.setCurrentDocument({
          id: 'doc-123',
          title: 'Test',
          type: 'Contract',
          version: 1,
          lastModified: '2024-11-15',
        });
      });

      const stored = localStorage.getItem('document-editor-preferences');
      expect(stored).toBeTruthy();

      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.preferences.aiPanelCollapsed).toBe(true);
        // These should NOT be persisted
        expect(parsed.state.preferences.activeView).toBeUndefined();
        expect(parsed.state.preferences.currentDocument).toBeUndefined();
      }
    });

    it('restores preferences from localStorage on rehydration', () => {
      // Set initial preferences
      const { result: firstRender } = renderHook(() => useDocumentEditorStore());

      act(() => {
        firstRender.current.toggleAIPanel();
        firstRender.current.toggleCommentsSidebar();
      });

      // Simulate remount (new hook instance)
      const { result: secondRender } = renderHook(() => useDocumentEditorStore());

      // Preferences should be restored
      expect(secondRender.current.preferences.aiPanelCollapsed).toBe(true);
      expect(secondRender.current.preferences.commentsSidebarOpen).toBe(true);
    });
  });

  describe('Multiple State Changes', () => {
    it('handles multiple rapid toggles correctly', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.toggleAIPanel();
        result.current.toggleAIPanel();
        result.current.toggleAIPanel();
      });

      expect(result.current.isAIPanelCollapsed).toBe(true);
    });

    it('handles simultaneous state changes', () => {
      const { result } = renderHook(() => useDocumentEditorStore());

      act(() => {
        result.current.toggleAIPanel();
        result.current.toggleCommentsSidebar();
        result.current.setActiveView('version-comparison');
      });

      expect(result.current.isAIPanelCollapsed).toBe(true);
      expect(result.current.isCommentsSidebarOpen).toBe(true);
      expect(result.current.activeView).toBe('version-comparison');
    });
  });
});
