/**
 * Cases List Page
 * Story 2.8: Case CRUD Operations UI
 *
 * Displays all cases with filtering, search, and create functionality
 */

'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CaseListTable } from '../../components/case/CaseListTable';
import { CaseFilters } from '../../components/case/CaseFilters';
import { CaseSearchBar } from '../../components/case/CaseSearchBar';
import { CreateCaseModal } from '../../components/case/CreateCaseModal';
import { useCases } from '../../hooks/useCases';
import { useCaseFiltersStore } from '../../stores/caseFiltersStore';

function CasesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, clientId, assignedToMe, setFromURLParams, toURLParams } =
    useCaseFiltersStore();

  const filters = { status, clientId, assignedToMe };
  const { cases, loading, error } = useCases(filters);

  // Initialize filters from URL on mount
  useEffect(() => {
    if (searchParams) {
      setFromURLParams(searchParams);
    }
  }, []);

  // Update URL when filters change
  useEffect(() => {
    const params = toURLParams();
    const newUrl = params.toString() ? `?${params.toString()}` : '/cases';
    router.replace(newUrl, { scroll: false });
  }, [status, clientId, assignedToMe, router, toURLParams]);

  // Set document title
  useEffect(() => {
    document.title = 'Dosare - Legal Platform';
  }, []);


  if (error) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-red-800 font-semibold mb-2">Eroare la încărcarea dosarelor</h2>
            <p className="text-red-600">{error.message}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dosare</h1>
          <p className="text-gray-600">Gestionați și urmăriți toate dosarele juridice</p>
        </div>

        {/* Search and Actions Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <CaseSearchBar />
          <CreateCaseModal />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <CaseFilters />
        </div>

        {/* Loading State */}
        {loading && cases.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse"
              >
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && cases.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nu s-au găsit dosare</h3>
            <p className="text-gray-500 mb-4">
              {filters.status || filters.assignedToMe
                ? 'Niciun dosar nu corespunde filtrelor. Încercați să ajustați criteriile de filtrare.'
                : 'Începeți prin a crea primul dosar.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              {!filters.status && !filters.assignedToMe && <CreateCaseModal />}
              {(filters.status || filters.assignedToMe) && (
                <button
                  onClick={() => useCaseFiltersStore.getState().clearFilters()}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  Șterge filtrele
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cases Table */}
        {cases.length > 0 && <CaseListTable cases={cases} />}

        {/* Results Count */}
        {cases.length > 0 && (
          <div className="mt-6 text-sm text-gray-600 text-center">
            Se afișează {cases.length} {cases.length === 1 ? 'dosar' : 'dosare'}
          </div>
        )}
      </div>
    </main>
  );
}

export default function CasesPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50">
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            </div>
          </div>
        </main>
      }
    >
      <CasesPageContent />
    </Suspense>
  );
}
