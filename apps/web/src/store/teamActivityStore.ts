import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

/**
 * Sidebar selection states for Team Activity
 * - all: Show overview of all cases
 * - client: Show client-level items only (tasks/docs not tied to any case)
 * - case: Show filtered view for a specific case
 */
export type TeamActivitySelection =
  | { type: 'all' }
  | { type: 'client'; clientId: string }
  | { type: 'case'; caseId: string };

export interface TeamActivityState {
  // Navigation
  sidebarSelection: TeamActivitySelection;
  expandedClients: string[];

  // Actions
  setSidebarSelection: (selection: TeamActivitySelection) => void;
  toggleClientExpanded: (clientId: string) => void;
  setExpandedClients: (clientIds: string[]) => void;
}

// ============================================================================
// Store
// ============================================================================

export const useTeamActivityStore = create<TeamActivityState>()(
  persist(
    (set) => ({
      // Initial state
      sidebarSelection: { type: 'all' },
      expandedClients: [],

      // Actions
      setSidebarSelection: (sidebarSelection) => set({ sidebarSelection }),

      toggleClientExpanded: (clientId) =>
        set((state) => ({
          expandedClients: state.expandedClients.includes(clientId)
            ? state.expandedClients.filter((id) => id !== clientId)
            : [...state.expandedClients, clientId],
        })),

      setExpandedClients: (expandedClients) => set({ expandedClients }),
    }),
    {
      name: 'team-activity-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist expanded state
      partialize: (state) => ({
        expandedClients: state.expandedClients,
      }),
    }
  )
);
