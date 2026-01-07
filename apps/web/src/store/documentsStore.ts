import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// View modes
export type DocumentsViewMode = 'grid' | 'list';
export type DocumentsTab = 'working' | 'correspondence' | 'review';

// The sidebar can show: all docs, a specific mapa, or unassigned docs
export type SidebarSelection =
  | { type: 'all' }
  | { type: 'mapa'; mapaId: string }
  | { type: 'unassigned' }
  | { type: 'case'; caseId: string }
  | { type: 'folder'; caseId: string; folderId: string };

export interface DocumentsState {
  // Navigation
  selectedCaseId: string | null;
  sidebarSelection: SidebarSelection;

  // View preferences
  viewMode: DocumentsViewMode;
  activeTab: DocumentsTab;

  // Filters
  searchQuery: string;
  statusFilter: 'all' | 'DRAFT' | 'PENDING' | 'FINAL' | 'ARCHIVED';
  typeFilter: 'all' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'other';

  // Selection (for bulk actions)
  selectedDocumentIds: string[];

  // UI state
  expandedCases: string[];
  expandedMape: string[];

  // Preview modal
  previewDocumentId: string | null;

  // Actions
  setSelectedCase: (caseId: string | null) => void;
  setSidebarSelection: (selection: SidebarSelection) => void;
  setViewMode: (mode: DocumentsViewMode) => void;
  setActiveTab: (tab: DocumentsTab) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: DocumentsState['statusFilter']) => void;
  setTypeFilter: (type: DocumentsState['typeFilter']) => void;
  toggleDocumentSelection: (documentId: string) => void;
  selectAllDocuments: (documentIds: string[]) => void;
  clearSelection: () => void;
  toggleCaseExpanded: (caseId: string) => void;
  toggleMapaExpanded: (mapaId: string) => void;
  setPreviewDocument: (documentId: string | null) => void;
  clearFilters: () => void;
}

export const useDocumentsStore = create<DocumentsState>()(
  persist(
    (set) => ({
      // Initial state
      selectedCaseId: null,
      sidebarSelection: { type: 'all' },
      viewMode: 'grid',
      activeTab: 'working',
      searchQuery: '',
      statusFilter: 'all',
      typeFilter: 'all',
      selectedDocumentIds: [],
      expandedCases: [],
      expandedMape: [],
      previewDocumentId: null,

      // Actions
      setSelectedCase: (selectedCaseId) => set({ selectedCaseId }),

      setSidebarSelection: (sidebarSelection) => set({ sidebarSelection }),

      setViewMode: (viewMode) => set({ viewMode }),

      setActiveTab: (activeTab) => set({ activeTab }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      setStatusFilter: (statusFilter) => set({ statusFilter }),

      setTypeFilter: (typeFilter) => set({ typeFilter }),

      toggleDocumentSelection: (documentId) =>
        set((state) => ({
          selectedDocumentIds: state.selectedDocumentIds.includes(documentId)
            ? state.selectedDocumentIds.filter((id) => id !== documentId)
            : [...state.selectedDocumentIds, documentId],
        })),

      selectAllDocuments: (documentIds) => set({ selectedDocumentIds: documentIds }),

      clearSelection: () => set({ selectedDocumentIds: [] }),

      toggleCaseExpanded: (caseId) =>
        set((state) => ({
          expandedCases: state.expandedCases.includes(caseId)
            ? state.expandedCases.filter((id) => id !== caseId)
            : [...state.expandedCases, caseId],
        })),

      toggleMapaExpanded: (mapaId) =>
        set((state) => ({
          expandedMape: state.expandedMape.includes(mapaId)
            ? state.expandedMape.filter((id) => id !== mapaId)
            : [...state.expandedMape, mapaId],
        })),

      setPreviewDocument: (previewDocumentId) => set({ previewDocumentId }),

      clearFilters: () =>
        set({
          searchQuery: '',
          statusFilter: 'all',
          typeFilter: 'all',
          selectedDocumentIds: [],
        }),
    }),
    {
      name: 'documents-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist view preferences, not transient state
      partialize: (state) => ({
        viewMode: state.viewMode,
        activeTab: state.activeTab,
        expandedCases: state.expandedCases,
      }),
    }
  )
);
