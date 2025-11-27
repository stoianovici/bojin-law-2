/**
 * Search Results Page
 * Story 2.10: Basic AI Search Implementation - Task 24
 *
 * Main search page with filters, results, and URL-based state.
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSearch, type SearchFilters } from '@/hooks/useSearch';
import { SearchFiltersPanel, SearchResults } from '@/components/search';
import type { CaseType, CaseStatus } from '@legal-platform/types';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    search,
    results,
    totalCount,
    searchTime,
    loading,
    error,
    searchMode,
    setSearchMode,
    query,
    setQuery,
    filters,
    setFilters,
  } = useSearch();

  // Parse URL params on mount
  useEffect(() => {
    const q = searchParams.get('q');
    const mode = searchParams.get('mode') as any;
    const caseTypes = searchParams.get('caseTypes')?.split(',').filter(Boolean) as CaseType[];
    const caseStatuses = searchParams
      .get('caseStatuses')
      ?.split(',')
      .filter(Boolean) as CaseStatus[];
    const documentTypes = searchParams.get('documentTypes')?.split(',').filter(Boolean);
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');

    // Build filters from URL
    const urlFilters: SearchFilters = {};
    if (caseTypes?.length) urlFilters.caseTypes = caseTypes;
    if (caseStatuses?.length) urlFilters.caseStatuses = caseStatuses;
    if (documentTypes?.length) urlFilters.documentTypes = documentTypes;
    if (dateStart && dateEnd) {
      urlFilters.dateRange = {
        start: new Date(dateStart),
        end: new Date(dateEnd),
      };
    }

    if (mode) {
      setSearchMode(mode);
    }

    if (Object.keys(urlFilters).length > 0) {
      setFilters(urlFilters);
    }

    // Execute search if query present
    if (q) {
      setQuery(q);
      search(q, urlFilters);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL when filters change
  const updateURL = useCallback(
    (newQuery: string, newFilters: SearchFilters) => {
      const params = new URLSearchParams();

      if (newQuery) params.set('q', newQuery);
      if (searchMode !== 'HYBRID') params.set('mode', searchMode);
      if (newFilters.caseTypes?.length) params.set('caseTypes', newFilters.caseTypes.join(','));
      if (newFilters.caseStatuses?.length)
        params.set('caseStatuses', newFilters.caseStatuses.join(','));
      if (newFilters.documentTypes?.length)
        params.set('documentTypes', newFilters.documentTypes.join(','));
      if (newFilters.dateRange) {
        params.set('dateStart', newFilters.dateRange.start.toISOString().split('T')[0]);
        params.set('dateEnd', newFilters.dateRange.end.toISOString().split('T')[0]);
      }

      router.push(`/search?${params.toString()}`, { scroll: false });
    },
    [router, searchMode]
  );

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (newFilters: SearchFilters) => {
      setFilters(newFilters);
      if (query) {
        search(query, newFilters);
        updateURL(query, newFilters);
      }
    },
    [setFilters, query, search, updateURL]
  );

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    const emptyFilters: SearchFilters = {};
    setFilters(emptyFilters);
    if (query) {
      search(query, emptyFilters);
      updateURL(query, emptyFilters);
    }
  }, [setFilters, query, search, updateURL]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar */}
          <aside className="lg:w-80 shrink-0">
            <SearchFiltersPanel
              filters={filters}
              searchMode={searchMode}
              onFiltersChange={handleFiltersChange}
              onSearchModeChange={setSearchMode}
              onClearFilters={handleClearFilters}
            />
          </aside>

          {/* Results */}
          <div className="flex-1">
            {error ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-400">
                  A apărut o eroare în timpul căutării. Vă rugăm să încercați din nou.
                </p>
                <p className="text-sm text-red-600 dark:text-red-500 mt-1">{error.message}</p>
              </div>
            ) : (
              <SearchResults
                results={results}
                query={query}
                totalCount={totalCount}
                searchTime={searchTime}
                loading={loading}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
