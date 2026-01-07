/**
 * Cases List Page
 * Story 2.8: Case CRUD Operations UI
 * OPS-328: Mobile Page Consistency - Added mobile view
 * OPS-357: Linear-inspired redesign with MinimalTable
 *
 * Displays all cases with filtering, search, and create functionality.
 * For Partners viewing PendingApproval status, shows approval queue inline.
 * On mobile devices (< 768px), shows MobileCases instead.
 */

'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import * as Avatar from '@radix-ui/react-avatar';
import * as Tooltip from '@radix-ui/react-tooltip';
import { FolderOpen } from 'lucide-react';
import type { CaseStatus } from '@legal-platform/types';
import { PendingApprovalTable } from '../../components/case/PendingApprovalTable';
import { useCases, type CaseWithRelations } from '../../hooks/useCases';
import { usePendingCases } from '../../hooks/usePendingCases';
import { useCaseSearch } from '../../hooks/useCaseSearch';
import { useAuthorization } from '../../hooks/useAuthorization';
import { useCaseFiltersStore } from '../../stores/caseFiltersStore';
import { PageLayout, PageHeader, PageContent } from '../../components/linear/PageLayout';
import {
  MinimalTable,
  TitleSubtitleCell,
  type ColumnDef,
  type SortDirection,
} from '../../components/linear/MinimalTable';
import { StatusDot } from '../../components/linear/StatusDot';
import { StatusToggle, type StatusToggleOption } from '../../components/linear/StatusToggle';
import { SearchBox } from '../../components/linear/SearchBox';
import { Button } from '../../components/ui/button';
import { MobileCases } from '../../components/mobile';
import { useIsMobile } from '../../hooks/useIsMobile';

// ====================================================================
// Types and Helpers
// ====================================================================

type StatusFilterValue = 'all' | CaseStatus;

const statusOptions: StatusToggleOption<StatusFilterValue>[] = [
  { value: 'all', label: 'Toate' },
  { value: 'Active', label: 'Active' },
  { value: 'OnHold', label: 'În așteptare' },
  { value: 'PendingApproval', label: 'În aprobare' },
  { value: 'Closed', label: 'Închise' },
];

function getStatusDotVariant(status: CaseStatus): 'active' | 'pending' | 'neutral' | 'info' {
  switch (status) {
    case 'Active':
      return 'active';
    case 'OnHold':
    case 'PendingApproval':
      return 'pending';
    case 'Closed':
    case 'Archived':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function getStatusLabel(status: CaseStatus): string {
  const labels: Record<CaseStatus, string> = {
    Active: 'Activ',
    PendingApproval: 'În aprobare',
    OnHold: 'În așteptare',
    Closed: 'Închis',
    Archived: 'Arhivat',
  };
  return labels[status] || status;
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    Litigation: 'Litigiu',
    Contract: 'Contract',
    Advisory: 'Consultanță',
    Criminal: 'Penal',
    Other: 'Altele',
  };
  return labels[type] || type;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}

// ====================================================================
// TeamMemberAvatar Component
// ====================================================================

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

function TeamMemberAvatar({ member }: { member: TeamMember }) {
  const initials = getInitials(member.user.firstName, member.user.lastName);
  const fullName = `${member.user.firstName} ${member.user.lastName}`;

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Avatar.Root className="inline-flex h-7 w-7 select-none items-center justify-center overflow-hidden rounded-full bg-linear-accent-muted align-middle ring-2 ring-linear-bg-secondary">
            <Avatar.Fallback className="text-[10px] font-medium text-linear-accent">
              {initials}
            </Avatar.Fallback>
          </Avatar.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 rounded-md border border-linear-border-subtle bg-linear-bg-elevated px-3 py-1.5 text-sm text-linear-text-primary shadow-md animate-in fade-in-0 zoom-in-95"
            sideOffset={5}
          >
            {fullName}
            {member.role && <span className="text-linear-text-tertiary"> ({member.role})</span>}
            <Tooltip.Arrow className="fill-linear-bg-elevated" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// ====================================================================
// CasesPageContent Component
// ====================================================================

function CasesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isPartner } = useAuthorization();
  const { status, clientId, assignedToMe, setStatus, setFromURLParams, toURLParams, clearFilters } =
    useCaseFiltersStore();

  const filters = { status, clientId, assignedToMe };

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const { search, results: searchResults } = useCaseSearch();

  // Sort state
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Determine if we should show the pending approval queue
  const showPendingApprovalQueue = isPartner && status === 'PendingApproval';

  // Use appropriate hook based on context
  const { cases, loading, error } = useCases(filters);
  const {
    cases: pendingCases,
    loading: pendingLoading,
    error: pendingError,
    refetch: pendingRefetch,
  } = usePendingCases(!showPendingApprovalQueue);

  // Use pending cases data when showing approval queue for Partners
  const isLoading = showPendingApprovalQueue ? pendingLoading : loading;
  const displayError = showPendingApprovalQueue ? pendingError : error;

  // Handle search with debounce
  useEffect(() => {
    if (searchQuery.length >= 3) {
      const timer = setTimeout(() => search(searchQuery), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [searchQuery, search]);

  // Filter and sort cases (only for non-pending cases view)
  const filteredAndSortedCases = useMemo(() => {
    let result = [...cases];

    // Apply search filter (client-side for immediate feedback)
    if (searchQuery.length >= 3 && searchResults.length > 0) {
      const matchIds = new Set(searchResults.map((r) => r.id));
      result = result.filter((c) => matchIds.has(c.id));
    }

    // Apply sorting
    if (sortColumn && sortDirection) {
      result.sort((a, b) => {
        let aValue: string | number = '';
        let bValue: string | number = '';

        switch (sortColumn) {
          case 'caseNumber':
            aValue = a.caseNumber;
            bValue = b.caseNumber;
            break;
          case 'title':
            aValue = a.title;
            bValue = b.title;
            break;
          case 'client':
            aValue = a.client.name;
            bValue = b.client.name;
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue, 'ro')
            : bValue.localeCompare(aValue, 'ro');
        }
        return 0;
      });
    }

    return result;
  }, [cases, searchQuery, searchResults, sortColumn, sortDirection]);

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

  // Handle status filter change
  const handleStatusChange = (value: StatusFilterValue) => {
    setStatus(value === 'all' ? undefined : value);
  };

  // Handle sort
  const handleSort = (columnId: string, direction: SortDirection) => {
    setSortColumn(direction ? columnId : undefined);
    setSortDirection(direction);
  };

  // Handle row click
  const handleRowClick = (caseItem: CaseWithRelations) => {
    router.push(`/cases/${caseItem.id}`);
  };

  // Table columns definition
  const columns: ColumnDef<CaseWithRelations>[] = [
    {
      id: 'caseNumber',
      header: 'Dosar',
      sortable: true,
      width: '160px',
      accessor: (row) => (
        <TitleSubtitleCell
          title={row.caseNumber.length > 12 ? row.caseNumber.slice(-12) : row.caseNumber}
          subtitle={getTypeLabel(row.type)}
          titleAccent
        />
      ),
    },
    {
      id: 'title',
      header: 'Titlu',
      sortable: true,
      accessor: (row) => (
        <span className="line-clamp-2 text-sm text-linear-text-primary">{row.title}</span>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      width: '180px',
      accessor: (row) => (
        <span className="text-sm text-linear-text-secondary">{row.client.name}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      width: '120px',
      accessor: (row) => (
        <StatusDot status={getStatusDotVariant(row.status)} label={getStatusLabel(row.status)} />
      ),
    },
    {
      id: 'team',
      header: 'Echipă',
      width: '120px',
      accessor: (row) => (
        <div className="flex -space-x-2">
          {row.teamMembers.slice(0, 3).map((member) => (
            <TeamMemberAvatar key={member.id} member={member} />
          ))}
          {row.teamMembers.length > 3 && (
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-linear-bg-tertiary text-[10px] font-medium text-linear-text-secondary ring-2 ring-linear-bg-secondary">
              +{row.teamMembers.length - 3}
            </div>
          )}
        </div>
      ),
    },
  ];

  // Current status filter value for StatusToggle
  const currentStatusValue: StatusFilterValue = status || 'all';

  // Error state
  if (displayError) {
    return (
      <PageLayout>
        <PageHeader
          title="Dosare"
          actions={
            <Link href="/cases/new">
              <Button>+ Caz nou</Button>
            </Link>
          }
        />
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
      {/* Page Header */}
      <PageHeader
        title="Dosare"
        actions={
          <Link href="/cases/new">
            <Button>+ Caz nou</Button>
          </Link>
        }
      />

      <PageContent className="mt-6">
        {/* Toolbar: Search + Status Toggle */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <SearchBox
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Caută dosare..."
            containerClassName="w-[280px]"
          />
          <StatusToggle
            options={statusOptions}
            value={currentStatusValue}
            onChange={handleStatusChange}
          />
          {(status || searchQuery) && (
            <button
              onClick={() => {
                clearFilters();
                setSearchQuery('');
              }}
              className="text-xs text-linear-text-tertiary hover:text-linear-text-secondary transition-colors"
            >
              Șterge filtrele
            </button>
          )}
        </div>

        {/* Pending Approval Queue Header for Partners */}
        {showPendingApprovalQueue && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-linear-text-primary">Coadă de aprobare</h2>
              {pendingCases.length > 0 && (
                <span className="rounded-full bg-linear-accent/20 px-3 py-1 text-sm font-medium text-linear-accent">
                  {pendingCases.length} în așteptare
                </span>
              )}
            </div>
            <p className="text-sm text-linear-text-tertiary">
              Dosarele sunt sortate după data trimiterii
            </p>
          </div>
        )}

        {/* Cases Table - Show PendingApprovalTable for Partners viewing pending cases */}
        {showPendingApprovalQueue ? (
          <PendingApprovalTable cases={pendingCases} onRefetch={pendingRefetch} />
        ) : (
          <MinimalTable
            columns={columns}
            data={filteredAndSortedCases}
            getRowKey={(row) => row.id}
            onRowClick={handleRowClick}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            loading={isLoading}
            skeletonRows={6}
            emptyState={
              <div className="flex flex-col items-center py-8">
                <FolderOpen className="mb-4 h-12 w-12 text-linear-text-tertiary" />
                <h3 className="mb-2 text-lg font-medium text-linear-text-primary">
                  {searchQuery
                    ? 'Nu s-au găsit dosare'
                    : status
                      ? 'Niciun dosar cu acest status'
                      : 'Nu există dosare'}
                </h3>
                <p className="mb-4 text-sm text-linear-text-tertiary">
                  {searchQuery
                    ? `Niciun dosar nu corespunde căutării "${searchQuery}"`
                    : status
                      ? 'Încercați să schimbați filtrul de status'
                      : 'Începeți prin a crea primul dosar'}
                </p>
                {!status && !searchQuery && (
                  <Link href="/cases/new">
                    <Button>+ Caz nou</Button>
                  </Link>
                )}
              </div>
            }
          />
        )}

        {/* Results Count */}
        {filteredAndSortedCases.length > 0 && !showPendingApprovalQueue && (
          <div className="mt-4 text-center text-xs text-linear-text-tertiary">
            {filteredAndSortedCases.length}{' '}
            {filteredAndSortedCases.length === 1 ? 'dosar' : 'dosare'}
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}

// ====================================================================
// Main Export
// ====================================================================

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
          <PageHeader title="Dosare" />
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
