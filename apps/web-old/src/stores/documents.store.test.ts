/**
 * Documents Store Tests
 * Tests for document filtering, sorting, and localStorage persistence
 */

import { renderHook, act } from '@testing-library/react';
import { useDocumentsStore } from './documents.store';
import type { DocumentOverview } from '@legal-platform/types';

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

describe('Documents Store', () => {
  const mockDocuments: DocumentOverview[] = [
    {
      id: 'doc-1',
      title: 'Contract Agreement',
      caseId: 'case-001',
      caseName: 'Smith vs. Johnson',
      type: 'Contract',
      fileType: 'PDF',
      fileSizeBytes: 1024000, // 1 MB
      uploadedDate: new Date('2025-01-15'),
      lastModifiedDate: new Date('2025-01-20'),
      uploadedById: 'atty-1',
      uploadedByName: 'Ion Popescu',
    },
    {
      id: 'doc-2',
      title: 'Motion to Dismiss',
      caseId: 'case-002',
      caseName: 'ABC Corp Dispute',
      type: 'Motion',
      fileType: 'DOCX',
      fileSizeBytes: 512000, // 500 KB
      uploadedDate: new Date('2025-02-10'),
      lastModifiedDate: new Date('2025-02-15'),
      uploadedById: 'atty-2',
      uploadedByName: 'Maria Ionescu',
    },
    {
      id: 'doc-3',
      title: 'Attorney Letter',
      caseId: 'case-001',
      caseName: 'Smith vs. Johnson',
      type: 'Letter',
      fileType: 'PDF',
      fileSizeBytes: 256000, // 250 KB
      uploadedDate: new Date('2025-03-05'),
      lastModifiedDate: new Date('2025-03-10'),
      uploadedById: 'atty-1',
      uploadedByName: 'Ion Popescu',
    },
  ];

  beforeEach(() => {
    // Reset store to initial state
    const { result } = renderHook(() => useDocumentsStore());
    act(() => {
      result.current.setDocuments([]);
      result.current.clearFilters();
    });
    localStorageMock.clear();
  });

  describe('Initial State', () => {
    it('should have empty documents array', () => {
      const { result } = renderHook(() => useDocumentsStore());
      expect(result.current.documents).toEqual([]);
    });

    it('should have default filters', () => {
      const { result } = renderHook(() => useDocumentsStore());
      expect(result.current.filters).toEqual({
        cases: [],
        types: [],
        fileTypes: [],
        dateRange: null,
        uploadedBy: [],
        searchQuery: '',
      });
    });

    it('should have default sorting (uploadedDate desc)', () => {
      const { result } = renderHook(() => useDocumentsStore());
      expect(result.current.sortBy).toBe('uploadedDate');
      expect(result.current.sortOrder).toBe('desc');
    });

    it('should start on page 1', () => {
      const { result } = renderHook(() => useDocumentsStore());
      expect(result.current.currentPage).toBe(1);
      expect(result.current.itemsPerPage).toBe(20);
    });
  });

  describe('setDocuments', () => {
    it('should set documents', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setDocuments(mockDocuments);
      });

      expect(result.current.documents).toEqual(mockDocuments);
      expect(result.current.totalItems).toBe(mockDocuments.length);
    });

    it('should apply filters and sort when setting documents', () => {
      const { result } = renderHook(() => useDocumentsStore());

      act(() => {
        result.current.setDocuments(mockDocuments);
      });

      // Should be sorted by uploadedDate desc by default
      expect(result.current.filteredDocuments[0].title).toBe('Attorney Letter');
      expect(result.current.filteredDocuments[1].title).toBe('Motion to Dismiss');
      expect(result.current.filteredDocuments[2].title).toBe('Contract Agreement');
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setDocuments(mockDocuments);
      });
    });

    it('should filter by case', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setFilters({ cases: ['case-001'] });
      });

      expect(result.current.filteredDocuments).toHaveLength(2);
      expect(result.current.filteredDocuments.every((d) => d.caseId === 'case-001')).toBe(true);
    });

    it('should filter by document type', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setFilters({ types: ['Contract'] });
      });

      expect(result.current.filteredDocuments).toHaveLength(1);
      expect(result.current.filteredDocuments[0].type).toBe('Contract');
    });

    it('should filter by multiple document types', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setFilters({ types: ['Contract', 'Motion'] });
      });

      expect(result.current.filteredDocuments).toHaveLength(2);
    });

    it('should filter by file type', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setFilters({ fileTypes: ['PDF'] });
      });

      expect(result.current.filteredDocuments).toHaveLength(2);
      expect(result.current.filteredDocuments.every((d) => d.fileType === 'PDF')).toBe(true);
    });

    it('should filter by uploaded by attorney', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setFilters({ uploadedBy: ['atty-1'] });
      });

      expect(result.current.filteredDocuments).toHaveLength(2);
      expect(result.current.filteredDocuments.every((d) => d.uploadedById === 'atty-1')).toBe(true);
    });

    it('should filter by date range', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setFilters({
          dateRange: { start: new Date('2025-02-01'), end: new Date('2025-02-28') },
        });
      });

      expect(result.current.filteredDocuments).toHaveLength(1);
      expect(result.current.filteredDocuments[0].title).toBe('Motion to Dismiss');
    });

    it('should filter by search query (title)', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setSearchQuery('contract');
      });

      expect(result.current.filteredDocuments).toHaveLength(1);
      expect(result.current.filteredDocuments[0].title).toBe('Contract Agreement');
    });

    it('should filter by search query (case name)', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setSearchQuery('smith');
      });

      expect(result.current.filteredDocuments).toHaveLength(2);
    });

    it('should be case-insensitive when searching', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setSearchQuery('MOTION');
      });

      expect(result.current.filteredDocuments).toHaveLength(1);
      expect(result.current.filteredDocuments[0].title).toBe('Motion to Dismiss');
    });

    it('should combine multiple filters', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setFilters({
          cases: ['case-001'],
          fileTypes: ['PDF'],
        });
      });

      expect(result.current.filteredDocuments).toHaveLength(2);
      expect(
        result.current.filteredDocuments.every(
          (d) => d.caseId === 'case-001' && d.fileType === 'PDF'
        )
      ).toBe(true);
    });

    it('should reset to page 1 when filters change', () => {
      const { result } = renderHook(() => useDocumentsStore());

      act(() => {
        result.current.setPage(3);
      });
      expect(result.current.currentPage).toBe(3);

      act(() => {
        result.current.setFilters({ cases: ['case-001'] });
      });
      expect(result.current.currentPage).toBe(1);
    });
  });

  describe('clearFilters', () => {
    it('should clear all filters', () => {
      const { result } = renderHook(() => useDocumentsStore());

      act(() => {
        result.current.setDocuments(mockDocuments);
        result.current.setFilters({
          cases: ['case-001'],
          types: ['Contract'],
          fileTypes: ['PDF'],
        });
      });

      expect(result.current.filteredDocuments).toHaveLength(1);

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual({
        cases: [],
        types: [],
        fileTypes: [],
        dateRange: null,
        uploadedBy: [],
        searchQuery: '',
      });
      expect(result.current.filteredDocuments).toHaveLength(mockDocuments.length);
    });

    it('should reset to page 1 when cleared', () => {
      const { result } = renderHook(() => useDocumentsStore());

      act(() => {
        result.current.setPage(2);
        result.current.clearFilters();
      });

      expect(result.current.currentPage).toBe(1);
    });
  });

  describe('Sorting', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setDocuments(mockDocuments);
      });
    });

    it('should sort by uploadedDate ascending', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setSorting('uploadedDate', 'asc');
      });

      expect(result.current.filteredDocuments[0].title).toBe('Contract Agreement');
      expect(result.current.filteredDocuments[2].title).toBe('Attorney Letter');
    });

    it('should sort by uploadedDate descending', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setSorting('uploadedDate', 'desc');
      });

      expect(result.current.filteredDocuments[0].title).toBe('Attorney Letter');
      expect(result.current.filteredDocuments[2].title).toBe('Contract Agreement');
    });

    it('should sort by title A-Z', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setSorting('title', 'asc');
      });

      expect(result.current.filteredDocuments[0].title).toBe('Attorney Letter');
      expect(result.current.filteredDocuments[1].title).toBe('Contract Agreement');
      expect(result.current.filteredDocuments[2].title).toBe('Motion to Dismiss');
    });

    it('should sort by title Z-A', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setSorting('title', 'desc');
      });

      expect(result.current.filteredDocuments[0].title).toBe('Motion to Dismiss');
      expect(result.current.filteredDocuments[2].title).toBe('Attorney Letter');
    });

    it('should sort by file size (largest first)', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setSorting('fileSizeBytes', 'desc');
      });

      expect(result.current.filteredDocuments[0].title).toBe('Contract Agreement'); // 1 MB
      expect(result.current.filteredDocuments[1].title).toBe('Motion to Dismiss'); // 500 KB
      expect(result.current.filteredDocuments[2].title).toBe('Attorney Letter'); // 250 KB
    });

    it('should sort by file size (smallest first)', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setSorting('fileSizeBytes', 'asc');
      });

      expect(result.current.filteredDocuments[0].title).toBe('Attorney Letter');
      expect(result.current.filteredDocuments[2].title).toBe('Contract Agreement');
    });

    it('should sort by case name A-Z', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setSorting('caseName', 'asc');
      });

      expect(result.current.filteredDocuments[0].caseName).toBe('ABC Corp Dispute');
      expect(result.current.filteredDocuments[1].caseName).toBe('Smith vs. Johnson');
    });

    it('should sort by type', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setSorting('type', 'asc');
      });

      expect(result.current.filteredDocuments[0].type).toBe('Contract');
      expect(result.current.filteredDocuments[1].type).toBe('Letter');
      expect(result.current.filteredDocuments[2].type).toBe('Motion');
    });

    it('should toggle sort order when clicking same field', () => {
      const { result } = renderHook(() => useDocumentsStore());

      act(() => {
        result.current.setSorting('title', 'asc');
      });
      expect(result.current.sortOrder).toBe('asc');

      act(() => {
        result.current.setSorting('title');
      });
      expect(result.current.sortOrder).toBe('desc');

      act(() => {
        result.current.setSorting('title');
      });
      expect(result.current.sortOrder).toBe('asc');
    });
  });

  describe('Pagination', () => {
    it('should set current page', () => {
      const { result } = renderHook(() => useDocumentsStore());
      act(() => {
        result.current.setPage(3);
      });

      expect(result.current.currentPage).toBe(3);
    });

    it('should set items per page and reset to page 1', () => {
      const { result } = renderHook(() => useDocumentsStore());

      act(() => {
        result.current.setPage(2);
        result.current.setItemsPerPage(50);
      });

      expect(result.current.itemsPerPage).toBe(50);
      expect(result.current.currentPage).toBe(1);
    });
  });

  describe('localStorage Persistence', () => {
    it('should save filters to localStorage', () => {
      const { result } = renderHook(() => useDocumentsStore());

      act(() => {
        result.current.setFilters({
          cases: ['case-001'],
          types: ['Contract'],
        });
      });

      const stored = JSON.parse(localStorageMock.getItem('legal-platform-document-filters')!);
      expect(stored.filters.cases).toEqual(['case-001']);
      expect(stored.filters.types).toEqual(['Contract']);
    });

    it('should save sort settings to localStorage', () => {
      const { result } = renderHook(() => useDocumentsStore());

      act(() => {
        result.current.setSorting('title', 'asc');
      });

      const stored = JSON.parse(localStorageMock.getItem('legal-platform-document-filters')!);
      expect(stored.sortBy).toBe('title');
      expect(stored.sortOrder).toBe('asc');
    });

    it('should load filters from localStorage', () => {
      localStorageMock.setItem(
        'legal-platform-document-filters',
        JSON.stringify({
          filters: {
            cases: ['case-001'],
            types: ['Contract'],
            fileTypes: [],
            dateRange: null,
            uploadedBy: [],
            searchQuery: '',
          },
          sortBy: 'title',
          sortOrder: 'asc',
        })
      );

      const { result } = renderHook(() => useDocumentsStore());

      act(() => {
        result.current.loadFromLocalStorage();
      });

      expect(result.current.filters.cases).toEqual(['case-001']);
      expect(result.current.filters.types).toEqual(['Contract']);
      expect(result.current.sortBy).toBe('title');
      expect(result.current.sortOrder).toBe('asc');
    });

    it('should handle date range serialization', () => {
      // First, set up a scenario where we have date filters saved
      localStorageMock.setItem(
        'legal-platform-document-filters',
        JSON.stringify({
          filters: {
            cases: [],
            types: [],
            fileTypes: [],
            dateRange: {
              start: '2025-01-01T00:00:00.000Z',
              end: '2025-12-31T00:00:00.000Z',
            },
            uploadedBy: [],
            searchQuery: '',
          },
          sortBy: 'uploadedDate',
          sortOrder: 'desc',
        })
      );

      const { result } = renderHook(() => useDocumentsStore());

      // Load from localStorage (which has date range)
      act(() => {
        result.current.loadFromLocalStorage();
      });

      // Dates should be restored as Date objects (compared as timestamps since they're deserialized)
      const expectedStart = new Date('2025-01-01T00:00:00.000Z');
      const expectedEnd = new Date('2025-12-31T00:00:00.000Z');

      expect(result.current.filters.dateRange?.start.getTime()).toEqual(expectedStart.getTime());
      expect(result.current.filters.dateRange?.end.getTime()).toEqual(expectedEnd.getTime());
    });

    it('should handle localStorage errors gracefully', () => {
      // Set invalid JSON
      localStorageMock.setItem('legal-platform-document-filters', 'invalid json');

      const { result } = renderHook(() => useDocumentsStore());

      // Should not throw
      expect(() => {
        act(() => {
          result.current.loadFromLocalStorage();
        });
      }).not.toThrow();
    });
  });

  describe('Combined Filters and Sorting', () => {
    it('should filter and sort documents correctly', () => {
      const { result } = renderHook(() => useDocumentsStore());

      act(() => {
        result.current.setDocuments(mockDocuments);
        result.current.setFilters({ cases: ['case-001'] }); // 2 documents
        result.current.setSorting('title', 'asc');
      });

      expect(result.current.filteredDocuments).toHaveLength(2);
      expect(result.current.filteredDocuments[0].title).toBe('Attorney Letter');
      expect(result.current.filteredDocuments[1].title).toBe('Contract Agreement');
    });

    it('should update total items after filtering', () => {
      const { result } = renderHook(() => useDocumentsStore());

      act(() => {
        result.current.setDocuments(mockDocuments);
      });
      expect(result.current.totalItems).toBe(3);

      act(() => {
        result.current.setFilters({ types: ['Contract'] });
      });
      expect(result.current.totalItems).toBe(1);
    });
  });
});
