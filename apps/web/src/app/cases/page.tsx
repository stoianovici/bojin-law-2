/**
 * Cases List Page
 * Story 2.8: Case CRUD Operations UI
 * OPS-328: Mobile Page Consistency - Added mobile view
 *
 * Displays all cases with filtering, search, and create functionality.
 * For Partners viewing PendingApproval status, shows approval queue inline.
 * On mobile devices (< 768px), shows MobileCases instead.
 */

'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CaseListTable } from '../../components/case/CaseListTable';
import { PendingApprovalTable } from '../../components/case/PendingApprovalTable';
import { CaseFilters } from '../../components/case/CaseFilters';
import { CaseSearchBar } from '../../components/case/CaseSearchBar';
import { useCases } from '../../hooks/useCases';
import { usePendingCases } from '../../hooks/usePendingCases';
import { useAuthorization } from '../../hooks/useAuthorization';
import { useCaseFiltersStore } from '../../stores/caseFiltersStore';
import { PageLayout, PageContent } from '../../components/linear/PageLayout';
import { MobileCases } from '../../components/mobile';
import { useIsMobile } from '../../hooks/useIsMobile';

function CasesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isPartner } = useAuthorization();
  const { status, clientId, assignedToMe, setFromURLParams, toURLParams } = useCaseFiltersStore();

  const filters = { status, clientId, assignedToMe };

  // Determine if we should show the pending approval queue
  const showPendingApprovalQueue = isPartner && status === 'PendingApproval';

  // Use appropriate hook based on context
  const { cases, loading, error } = useCases(filters);
  const {
    cases: pendingCases,
    loading: pendingLoading,
    error: pendingError,
    refetch: pendingRefetch,
  } = usePendingCases(!showPendingApprovalQueue); // Skip if not showing pending queue

  // Use pending cases data when showing approval queue for Partners
  const displayCases = showPendingApprovalQueue ? pendingCases : cases;
  const isLoading = showPendingApprovalQueue ? pendingLoading : loading;
  const displayError = showPendingApprovalQueue ? pendingError : error;

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

  if (displayError) {
    return (
      <PageLayout>
        <PageContent>
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <h2 className="mb-2 font-semibold text-red-400">Eroare la încărcarea dosarelor</h2>
            <p className="text-red-300">{displayError.message}</p>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageContent>
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-semibold text-linear-text-primary">Dosare</h1>
          <p className="text-sm text-linear-text-secondary">Gestionați și urmăriți toate dosarele juridice</p>
        </div>

        {/* Search and Actions Bar */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <CaseSearchBar />
          <Link href="/cases/new">
            <button className="rounded-md bg-linear-accent px-4 py-2 font-medium text-white transition-colors hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2 focus:ring-offset-linear-bg-primary">
              + Dosar nou
            </button>
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <CaseFilters />
        </div>

        {/* Pending Approval Queue Header for Partners */}
        {showPendingApprovalQueue && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-linear-text-primary">Coadă de aprobare</h2>
              {displayCases.length > 0 && (
                <span className="rounded-full bg-linear-accent/20 px-3 py-1 text-sm font-medium text-linear-accent">
                  {displayCases.length} în așteptare
                </span>
              )}
            </div>
            <p className="text-sm text-linear-text-tertiary">
              Dosarele sunt sortate după data trimiterii (cele mai vechi primele)
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && displayCases.length === 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-6">
                <div className="mb-4 h-4 w-3/4 rounded bg-linear-bg-tertiary"></div>
                <div className="mb-4 h-4 w-1/2 rounded bg-linear-bg-tertiary"></div>
                <div className="h-4 w-full rounded bg-linear-bg-tertiary"></div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && displayCases.length === 0 && (
          <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary py-12 text-center">
            <svg
              className="mx-auto mb-4 h-12 w-12 text-linear-text-tertiary"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {showPendingApprovalQueue ? (
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              ) : (
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              )}
            </svg>
            <h3 className="mb-2 text-lg font-medium text-linear-text-primary">
              {showPendingApprovalQueue
                ? 'Nu sunt dosare în așteptare pentru aprobare'
                : 'Nu s-au găsit dosare'}
            </h3>
            <p className="mb-4 text-linear-text-secondary">
              {showPendingApprovalQueue
                ? 'Toate dosarele trimise au fost revizuite. Dosarele noi vor apărea aici.'
                : filters.status || filters.assignedToMe
                  ? 'Niciun dosar nu corespunde filtrelor. Încercați să ajustați criteriile de filtrare.'
                  : 'Începeți prin a crea primul dosar.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              {!filters.status && !filters.assignedToMe && !showPendingApprovalQueue && (
                <Link href="/cases/new">
                  <button className="rounded-md bg-linear-accent px-4 py-2 font-medium text-white transition-colors hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2 focus:ring-offset-linear-bg-primary">
                    + Dosar nou
                  </button>
                </Link>
              )}
              {(filters.status || filters.assignedToMe) && (
                <button
                  onClick={() => useCaseFiltersStore.getState().clearFilters()}
                  className="rounded-md border border-linear-border-default bg-linear-bg-secondary px-4 py-2 text-sm font-medium text-linear-text-secondary transition-colors hover:bg-linear-bg-tertiary focus:outline-none focus:ring-2 focus:ring-linear-accent"
                >
                  Șterge filtrele
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cases Table - Show PendingApprovalTable for Partners viewing pending cases */}
        {displayCases.length > 0 &&
          (showPendingApprovalQueue ? (
            <PendingApprovalTable cases={pendingCases} onRefetch={pendingRefetch} />
          ) : (
            <CaseListTable cases={cases} />
          ))}

        {/* Results Count */}
        {displayCases.length > 0 && (
          <div className="mt-6 text-center text-sm text-linear-text-secondary">
            Se afișează {displayCases.length} {displayCases.length === 1 ? 'dosar' : 'dosare'}
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}

export default function CasesPage() {
  const isMobile = useIsMobile();

  // On mobile, render MobileCases
  if (isMobile) {
    return <MobileCases />;
  }

  // Desktop: render full cases page
  return (
    <Suspense
      fallback={
        <PageLayout>
          <PageContent>
            <div className="animate-pulse">
              <div className="mb-4 h-8 w-1/4 rounded bg-linear-bg-tertiary"></div>
              <div className="mb-8 h-4 w-1/2 rounded bg-linear-bg-tertiary"></div>
            </div>
          </PageContent>
        </PageLayout>
      }
    >
      <CasesPageContent />
    </Suspense>
  );
}
