import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Case types
export type CaseViewMode = 'grid' | 'list';
export type CaseGroupBy = 'status' | 'type' | 'client' | 'teamLead' | 'none';
export type CaseSortBy = 'openedDate' | 'caseNumber' | 'title' | 'client';
export type CaseStatus = 'Active' | 'PendingApproval' | 'OnHold' | 'Closed' | 'Archived';

export interface CasesState {
  // View preferences
  viewMode: CaseViewMode;
  groupBy: CaseGroupBy;
  sortBy: CaseSortBy;
  sortDirection: 'asc' | 'desc';

  // Search
  searchQuery: string;

  // Selected case (for drawer)
  selectedCaseId: string | null;

  // Client selection and expansion (for grouped views)
  selectedClientId: string | null;
  expandedClientIds: string[];

  // Filters
  showMyCases: boolean;
  selectedStatuses: CaseStatus[];
  selectedTypes: string[];

  // Actions
  setViewMode: (viewMode: CaseViewMode) => void;
  setGroupBy: (groupBy: CaseGroupBy) => void;
  setSearchQuery: (query: string) => void;
  selectCase: (caseId: string | null) => void;
  selectClient: (clientId: string | null) => void;
  toggleClientExpanded: (clientId: string) => void;
  clearSelection: () => void;
  setShowMyCases: (show: boolean) => void;
  toggleStatus: (status: CaseStatus) => void;
  toggleType: (type: string) => void;
  setSortBy: (sortBy: CaseSortBy) => void;
  setSortDirection: (direction: 'asc' | 'desc') => void;
  clearFilters: () => void;
}

export const useCasesStore = create<CasesState>()(
  persist(
    (set) => ({
      viewMode: 'grid',
      groupBy: 'none',
      sortBy: 'openedDate',
      sortDirection: 'desc',
      searchQuery: '',
      selectedCaseId: null,
      selectedClientId: null,
      expandedClientIds: [],
      showMyCases: false,
      selectedStatuses: [],
      selectedTypes: [],

      setViewMode: (viewMode) => set({ viewMode }),

      setGroupBy: (groupBy) => set({ groupBy }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      selectCase: (selectedCaseId) => set({ selectedCaseId, selectedClientId: null }),

      selectClient: (selectedClientId) => set({ selectedClientId, selectedCaseId: null }),

      toggleClientExpanded: (clientId) =>
        set((state) => ({
          expandedClientIds: state.expandedClientIds.includes(clientId)
            ? state.expandedClientIds.filter((id) => id !== clientId)
            : [...state.expandedClientIds, clientId],
        })),

      clearSelection: () => set({ selectedClientId: null, selectedCaseId: null }),

      setShowMyCases: (showMyCases) => set({ showMyCases }),

      toggleStatus: (status) =>
        set((state) => ({
          selectedStatuses: state.selectedStatuses.includes(status)
            ? state.selectedStatuses.filter((s) => s !== status)
            : [...state.selectedStatuses, status],
        })),

      toggleType: (type) =>
        set((state) => ({
          selectedTypes: state.selectedTypes.includes(type)
            ? state.selectedTypes.filter((t) => t !== type)
            : [...state.selectedTypes, type],
        })),

      setSortBy: (sortBy) => set({ sortBy }),

      setSortDirection: (sortDirection) => set({ sortDirection }),

      clearFilters: () =>
        set({
          showMyCases: false,
          selectedStatuses: [],
          selectedTypes: [],
          searchQuery: '',
        }),
    }),
    {
      name: 'cases-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        viewMode: state.viewMode,
        groupBy: state.groupBy,
        sortBy: state.sortBy,
        sortDirection: state.sortDirection,
      }),
    }
  )
);
