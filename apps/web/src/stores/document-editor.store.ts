/**
 * Document Editor Store
 * Zustand store for document editor state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DocumentEditorStore,
  DocumentMetadata,
  ActiveView,
} from '@legal-platform/types';

const initialState = {
  isAIPanelCollapsed: false,
  isCommentsSidebarOpen: false,
  activeView: 'editor' as ActiveView,
  currentDocument: null,
  preferences: {
    aiPanelCollapsed: false,
    commentsSidebarOpen: false,
  },
};

export const useDocumentEditorStore = create<DocumentEditorStore>()(
  persist(
    (set) => ({
      ...initialState,

      // Panel actions
      toggleAIPanel: () =>
        set((state) => {
          const newCollapsed = !state.isAIPanelCollapsed;
          return {
            isAIPanelCollapsed: newCollapsed,
            preferences: {
              ...state.preferences,
              aiPanelCollapsed: newCollapsed,
            },
          };
        }),

      toggleCommentsSidebar: () =>
        set((state) => {
          const newOpen = !state.isCommentsSidebarOpen;
          return {
            isCommentsSidebarOpen: newOpen,
            preferences: {
              ...state.preferences,
              commentsSidebarOpen: newOpen,
            },
          };
        }),

      setActiveView: (view: ActiveView) =>
        set({ activeView: view }),

      // Document actions
      setCurrentDocument: (document: DocumentMetadata | null) =>
        set({ currentDocument: document }),

      // Reset
      resetState: () => set(initialState),
    }),
    {
      name: 'document-editor-preferences',
      // Only persist preferences, not current document or active view
      partialize: (state) => ({
        preferences: state.preferences,
      }),
      // Restore preferences on load
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAIPanelCollapsed = state.preferences.aiPanelCollapsed;
          state.isCommentsSidebarOpen = state.preferences.commentsSidebarOpen;
        }
      },
    }
  )
);

// Selectors for optimized re-renders
export const selectIsAIPanelCollapsed = (state: DocumentEditorStore) =>
  state.isAIPanelCollapsed;

export const selectIsCommentsSidebarOpen = (state: DocumentEditorStore) =>
  state.isCommentsSidebarOpen;

export const selectActiveView = (state: DocumentEditorStore) => state.activeView;

export const selectCurrentDocument = (state: DocumentEditorStore) =>
  state.currentDocument;
