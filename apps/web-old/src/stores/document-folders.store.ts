/**
 * Document Folders Store
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 *
 * Zustand store for managing the /documents page navigation state including
 * selected case, folder, document, and sidebar expansion state.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

/**
 * View mode for document list
 */
export type DocumentViewMode = 'grid' | 'list';

/**
 * OPS-173: Document category tabs
 * - working: Documents being actively edited (UPLOAD, AI_GENERATED, TEMPLATE, or promoted attachments)
 * - correspondence: Email attachments (EMAIL_ATTACHMENT source type, not promoted)
 * OPS-174: Supervisor review queue tab
 * - review: Documents pending supervisor review (status IN_REVIEW, current user is reviewer)
 */
export type DocumentTab = 'working' | 'correspondence' | 'review';

/**
 * Sort options for documents
 */
export type DocumentSortBy = 'name' | 'date' | 'type' | 'size';
export type SortDirection = 'asc' | 'desc';

/**
 * Document folders store state interface
 */
interface DocumentFoldersState {
  // Selection state
  selectedCaseId: string | null;
  selectedFolderId: string | null;
  selectedDocumentId: string | null;

  // OPS-173: Active document category tab
  activeTab: DocumentTab;

  // View preferences
  viewMode: DocumentViewMode;
  sortBy: DocumentSortBy;
  sortDirection: SortDirection;
  showPreview: boolean;

  // Sidebar state
  expandedCases: Record<string, boolean>;
  expandedFolders: Record<string, boolean>;

  // Bulk selection
  selectedDocumentIds: string[];
  isSelecting: boolean;

  // Search
  searchQuery: string;

  // Actions
  setSelectedCase: (caseId: string | null) => void;
  setSelectedFolder: (folderId: string | null) => void;
  setSelectedDocument: (documentId: string | null) => void;
  selectCaseAndFolder: (caseId: string, folderId: string | null) => void;

  // OPS-173: Tab actions
  setActiveTab: (tab: DocumentTab) => void;

  setViewMode: (mode: DocumentViewMode) => void;
  setSortBy: (sortBy: DocumentSortBy) => void;
  setSortDirection: (direction: SortDirection) => void;
  togglePreview: () => void;

  toggleCaseExpanded: (caseId: string) => void;
  toggleFolderExpanded: (folderId: string) => void;
  expandFolder: (folderId: string) => void;
  collapseFolder: (folderId: string) => void;

  toggleDocumentSelection: (documentId: string) => void;
  selectAllDocuments: (documentIds: string[]) => void;
  clearDocumentSelection: () => void;
  setIsSelecting: (isSelecting: boolean) => void;

  setSearchQuery: (query: string) => void;

  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  selectedCaseId: null as string | null,
  selectedFolderId: null as string | null,
  selectedDocumentId: null as string | null,
  // OPS-173: Default to working documents tab
  activeTab: 'working' as DocumentTab,
  viewMode: 'grid' as DocumentViewMode,
  sortBy: 'date' as DocumentSortBy,
  sortDirection: 'desc' as SortDirection,
  showPreview: false,
  expandedCases: {} as Record<string, boolean>,
  expandedFolders: {} as Record<string, boolean>,
  selectedDocumentIds: [] as string[],
  isSelecting: false,
  searchQuery: '',
};

// ============================================================================
// Store
// ============================================================================

export const useDocumentFoldersStore = create<DocumentFoldersState>()(
  persist(
    (set) => ({
      ...initialState,

      // Selection actions
      setSelectedCase: (caseId) =>
        set({
          selectedCaseId: caseId,
          selectedFolderId: null,
          selectedDocumentId: null,
          selectedDocumentIds: [],
        }),

      setSelectedFolder: (folderId) =>
        set({
          selectedFolderId: folderId,
          selectedDocumentId: null,
          selectedDocumentIds: [],
        }),

      setSelectedDocument: (documentId) => set({ selectedDocumentId: documentId }),

      selectCaseAndFolder: (caseId, folderId) =>
        set((state) => ({
          selectedCaseId: caseId,
          selectedFolderId: folderId,
          selectedDocumentId: null,
          selectedDocumentIds: [],
          expandedCases: { ...state.expandedCases, [caseId]: true },
        })),

      // OPS-173: Tab action
      setActiveTab: (tab) => set({ activeTab: tab }),

      // View preference actions
      setViewMode: (mode) => set({ viewMode: mode }),

      setSortBy: (sortBy) => set({ sortBy }),

      setSortDirection: (direction) => set({ sortDirection: direction }),

      togglePreview: () => set((state) => ({ showPreview: !state.showPreview })),

      // Sidebar expansion actions
      toggleCaseExpanded: (caseId) =>
        set((state) => ({
          expandedCases: {
            ...state.expandedCases,
            [caseId]: !state.expandedCases[caseId],
          },
        })),

      toggleFolderExpanded: (folderId) =>
        set((state) => ({
          expandedFolders: {
            ...state.expandedFolders,
            [folderId]: !state.expandedFolders[folderId],
          },
        })),

      expandFolder: (folderId) =>
        set((state) => ({
          expandedFolders: { ...state.expandedFolders, [folderId]: true },
        })),

      collapseFolder: (folderId) =>
        set((state) => ({
          expandedFolders: { ...state.expandedFolders, [folderId]: false },
        })),

      // Bulk selection actions
      toggleDocumentSelection: (documentId) =>
        set((state) => {
          const isSelected = state.selectedDocumentIds.includes(documentId);
          return {
            selectedDocumentIds: isSelected
              ? state.selectedDocumentIds.filter((id) => id !== documentId)
              : [...state.selectedDocumentIds, documentId],
          };
        }),

      selectAllDocuments: (documentIds) => set({ selectedDocumentIds: documentIds }),

      clearDocumentSelection: () => set({ selectedDocumentIds: [], isSelecting: false }),

      setIsSelecting: (isSelecting) =>
        set({ isSelecting, selectedDocumentIds: isSelecting ? [] : [] }),

      // Search action
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Reset action
      reset: () => set(initialState),
    }),
    {
      name: 'document-folders-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist navigation state for returning to last viewed location
        selectedCaseId: state.selectedCaseId,
        selectedFolderId: state.selectedFolderId,
        // OPS-173: Persist active tab
        activeTab: state.activeTab,
        // Persist view preferences
        viewMode: state.viewMode,
        sortBy: state.sortBy,
        sortDirection: state.sortDirection,
        // Persist sidebar expansion state
        expandedCases: state.expandedCases,
        expandedFolders: state.expandedFolders,
      }),
    }
  )
);
