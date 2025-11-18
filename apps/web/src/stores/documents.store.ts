/**
 * Documents Store
 * Manages document list state, filters, sorting, and pagination
 */

import { create } from 'zustand';
import type { DocumentOverview, DocumentType, FileType } from '@legal-platform/types';

export type SortField = 'uploadedDate' | 'title' | 'type' | 'fileSizeBytes' | 'caseName' | 'lastModifiedDate';
export type SortOrder = 'asc' | 'desc';

export interface DocumentFilters {
  cases: string[]; // Case IDs
  types: DocumentType[]; // Document types
  fileTypes: FileType[]; // File types (PDF, DOCX, etc.)
  dateRange: { start: Date; end: Date } | null;
  uploadedBy: string[]; // Attorney IDs
  searchQuery: string;
}

export interface DocumentsState {
  // Data
  documents: DocumentOverview[];
  filteredDocuments: DocumentOverview[];

  // Filters
  filters: DocumentFilters;

  // Sorting
  sortBy: SortField;
  sortOrder: SortOrder;

  // Pagination
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;

  // Actions
  setDocuments: (documents: DocumentOverview[]) => void;
  setFilters: (filters: Partial<DocumentFilters>) => void;
  clearFilters: () => void;
  setSorting: (field: SortField, order?: SortOrder) => void;
  setSearchQuery: (query: string) => void;
  setPage: (page: number) => void;
  setItemsPerPage: (itemsPerPage: number) => void;
  applyFiltersAndSort: () => void;

  // Persistence
  loadFromLocalStorage: () => void;
  saveToLocalStorage: () => void;
}

const INITIAL_FILTERS: DocumentFilters = {
  cases: [],
  types: [],
  fileTypes: [],
  dateRange: null,
  uploadedBy: [],
  searchQuery: '',
};

const STORAGE_KEY = 'legal-platform-document-filters';

/**
 * Filter documents based on current filters
 */
function filterDocuments(documents: DocumentOverview[], filters: DocumentFilters): DocumentOverview[] {
  return documents.filter((doc) => {
    // Search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesTitle = doc.title.toLowerCase().includes(query);
      const matchesCase = doc.caseName.toLowerCase().includes(query);
      if (!matchesTitle && !matchesCase) return false;
    }

    // Case filter
    if (filters.cases.length > 0 && !filters.cases.includes(doc.caseId)) {
      return false;
    }

    // Document type filter
    if (filters.types.length > 0 && !filters.types.includes(doc.type)) {
      return false;
    }

    // File type filter
    if (filters.fileTypes.length > 0 && !filters.fileTypes.includes(doc.fileType)) {
      return false;
    }

    // Date range filter
    if (filters.dateRange) {
      const uploadDate = new Date(doc.uploadedDate);
      const { start, end } = filters.dateRange;
      if (uploadDate < start || uploadDate > end) {
        return false;
      }
    }

    // Uploaded by filter
    if (filters.uploadedBy.length > 0 && !filters.uploadedBy.includes(doc.uploadedById)) {
      return false;
    }

    return true;
  });
}

/**
 * Sort documents based on sort field and order
 */
function sortDocuments(
  documents: DocumentOverview[],
  sortBy: SortField,
  sortOrder: SortOrder
): DocumentOverview[] {
  const sorted = [...documents].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'uploadedDate':
        comparison = new Date(a.uploadedDate).getTime() - new Date(b.uploadedDate).getTime();
        break;
      case 'lastModifiedDate':
        comparison = new Date(a.lastModifiedDate).getTime() - new Date(b.lastModifiedDate).getTime();
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      case 'fileSizeBytes':
        comparison = a.fileSizeBytes - b.fileSizeBytes;
        break;
      case 'caseName':
        comparison = a.caseName.localeCompare(b.caseName);
        break;
      default:
        comparison = 0;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  // Initial state
  documents: [],
  filteredDocuments: [],
  filters: INITIAL_FILTERS,
  sortBy: 'uploadedDate',
  sortOrder: 'desc',
  currentPage: 1,
  itemsPerPage: 20,
  totalItems: 0,

  // Actions
  setDocuments: (documents) => {
    set({ documents, totalItems: documents.length });
    get().applyFiltersAndSort();
  },

  setFilters: (newFilters) => {
    const filters = { ...get().filters, ...newFilters };
    set({ filters, currentPage: 1 }); // Reset to page 1 when filters change
    get().applyFiltersAndSort();
    get().saveToLocalStorage();
  },

  clearFilters: () => {
    set({ filters: INITIAL_FILTERS, currentPage: 1 });
    get().applyFiltersAndSort();
    get().saveToLocalStorage();
  },

  setSorting: (field, order) => {
    const currentSortBy = get().sortBy;
    const currentSortOrder = get().sortOrder;

    // If clicking the same field, toggle order
    const newSortOrder = order || (field === currentSortBy && currentSortOrder === 'asc' ? 'desc' : 'asc');

    set({ sortBy: field, sortOrder: newSortOrder });
    get().applyFiltersAndSort();
    get().saveToLocalStorage();
  },

  setSearchQuery: (query) => {
    set({
      filters: { ...get().filters, searchQuery: query },
      currentPage: 1,
    });
    get().applyFiltersAndSort();
  },

  setPage: (page) => {
    set({ currentPage: page });
  },

  setItemsPerPage: (itemsPerPage) => {
    set({ itemsPerPage, currentPage: 1 });
  },

  applyFiltersAndSort: () => {
    const { documents, filters, sortBy, sortOrder } = get();

    // Apply filters
    let filtered = filterDocuments(documents, filters);

    // Apply sorting
    filtered = sortDocuments(filtered, sortBy, sortOrder);

    set({ filteredDocuments: filtered, totalItems: filtered.length });
  },

  loadFromLocalStorage: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { filters, sortBy, sortOrder } = JSON.parse(stored);

        // Parse date range if present
        if (filters.dateRange) {
          filters.dateRange = {
            start: new Date(filters.dateRange.start),
            end: new Date(filters.dateRange.end),
          };
        }

        set({ filters, sortBy, sortOrder });
        get().applyFiltersAndSort();
      }
    } catch (error) {
      console.error('Failed to load filters from localStorage:', error);
    }
  },

  saveToLocalStorage: () => {
    try {
      const { filters, sortBy, sortOrder } = get();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ filters, sortBy, sortOrder }));
    } catch (error) {
      console.error('Failed to save filters to localStorage:', error);
    }
  },
}));
