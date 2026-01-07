/**
 * Case Workspace Store
 * Zustand store for managing case workspace state (active tab, panel visibility, etc.)
 * Uses persist middleware to save state to localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkspaceTab } from '@legal-platform/types';

/**
 * Case Workspace state interface
 */
interface CaseWorkspaceState {
  // State
  activeTab: WorkspaceTab;
  aiPanelCollapsed: boolean;
  quickActionsVisible: boolean;
  selectedCaseId: string | null;

  // Actions
  setActiveTab: (tab: WorkspaceTab) => void;
  toggleAIPanel: () => void;
  toggleQuickActions: () => void;
  setSelectedCase: (caseId: string) => void;
}

/**
 * Case workspace store with persistent state
 */
export const useCaseWorkspaceStore = create<CaseWorkspaceState>()(
  persist(
    (set) => ({
      // Initial state
      activeTab: 'overview',
      aiPanelCollapsed: false,
      quickActionsVisible: false, // Collapsed by default
      selectedCaseId: null,

      // Switch between workspace tabs
      setActiveTab: (tab: WorkspaceTab) => {
        set({ activeTab: tab });
      },

      // Toggle AI insights panel visibility
      toggleAIPanel: () => {
        set((state) => ({
          aiPanelCollapsed: !state.aiPanelCollapsed,
        }));
      },

      // Toggle quick actions bar visibility
      toggleQuickActions: () => {
        set((state) => ({
          quickActionsVisible: !state.quickActionsVisible,
        }));
      },

      // Set the currently selected case
      setSelectedCase: (caseId: string) => {
        set({ selectedCaseId: caseId });
      },
    }),
    {
      name: 'case-workspace-state', // localStorage key
      // Persist all state except selectedCaseId (should be set per session)
      partialize: (state) => ({
        activeTab: state.activeTab,
        aiPanelCollapsed: state.aiPanelCollapsed,
        quickActionsVisible: state.quickActionsVisible,
      }),
    }
  )
);
