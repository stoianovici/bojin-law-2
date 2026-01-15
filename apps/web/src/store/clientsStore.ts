import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ClientFilterType = 'all' | 'withCases' | 'noCases';
export type ClientTypeFilter = 'all' | 'company' | 'individual';

export interface ClientsState {
  searchQuery: string;
  selectedClientId: string | null;
  filterType: ClientFilterType;
  clientType: ClientTypeFilter;
  isCreatingClient: boolean;

  setSearchQuery: (query: string) => void;
  selectClient: (clientId: string | null) => void;
  setFilterType: (filter: ClientFilterType) => void;
  setClientType: (type: ClientTypeFilter) => void;
  clearFilters: () => void;
  startCreatingClient: () => void;
  stopCreatingClient: () => void;
}

export const useClientsStore = create<ClientsState>()(
  persist(
    (set) => ({
      searchQuery: '',
      selectedClientId: null,
      filterType: 'all',
      clientType: 'all',
      isCreatingClient: false,

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      selectClient: (selectedClientId) => set({ selectedClientId, isCreatingClient: false }),
      setFilterType: (filterType) => set({ filterType }),
      setClientType: (clientType) => set({ clientType }),
      clearFilters: () =>
        set({
          filterType: 'all',
          clientType: 'all',
          searchQuery: '',
        }),
      startCreatingClient: () => set({ isCreatingClient: true, selectedClientId: null }),
      stopCreatingClient: () => set({ isCreatingClient: false }),
    }),
    {
      name: 'clients-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        filterType: state.filterType,
        clientType: state.clientType,
      }),
    }
  )
);
