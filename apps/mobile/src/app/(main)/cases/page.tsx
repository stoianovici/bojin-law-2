'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Search, ChevronRight } from 'lucide-react';
import { LargeHeader } from '@/components/layout';
import {
  Card,
  Avatar,
  Badge,
  StatusBadge,
  EmptyList,
  SkeletonList,
  Button,
  PullToRefresh,
  ListItemTransition,
} from '@/components/ui';
import { useCases, type CaseStatus } from '@/hooks/useCases';
import { clsx } from 'clsx';

// ============================================
// Status Filter Options
// ============================================

const statusOptions: Array<{ value: CaseStatus | 'All'; label: string }> = [
  { value: 'All', label: 'Toate' },
  { value: 'Active', label: 'Active' },
  { value: 'Pending', label: 'În așteptare' },
  { value: 'OnHold', label: 'Suspendate' },
  { value: 'Closed', label: 'Închise' },
];

// ============================================
// Page Component
// ============================================

export default function CasesPage() {
  const {
    cases,
    loading,
    loadingMore,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    refetch,
    hasNextPage,
    loadMore,
  } = useCases();

  const handleRefresh = async () => {
    await refetch();
  };

  const activeFilterLabel = statusOptions.find((o) => o.value === statusFilter)?.label;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <LargeHeader
        title="Dosare"
        subtitle={`${cases.length} ${statusFilter === 'All' ? 'total' : activeFilterLabel?.toLowerCase()}`}
      />

      {/* Search Bar */}
      <div className="px-6 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Caută dosare..."
            className={clsx(
              'w-full h-10 pl-10 pr-4',
              'bg-bg-elevated rounded-lg',
              'text-sm text-text-primary placeholder:text-text-tertiary',
              'focus:outline-none focus:ring-1 focus:ring-accent'
            )}
          />
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="px-6 pb-3">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className={clsx(
                'px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap',
                'transition-colors',
                statusFilter === option.value
                  ? 'bg-accent text-white'
                  : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cases List */}
      <PullToRefresh onRefresh={handleRefresh} disabled={loading} className="px-6 py-2">
        {loading ? (
          <SkeletonList count={5} />
        ) : cases.length === 0 ? (
          <EmptyList itemName="dosar" />
        ) : (
          <>
            <div className="space-y-2">
              {cases.map((caseItem, index) => (
                <ListItemTransition key={caseItem.id} index={index}>
                  <CaseCard caseData={caseItem} />
                </ListItemTransition>
              ))}
            </div>

            {/* Load More Button */}
            {hasNextPage && (
              <div className="py-4 flex justify-center">
                <Button variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Se încarcă...' : 'Încarcă mai multe'}
                </Button>
              </div>
            )}
          </>
        )}
      </PullToRefresh>
    </div>
  );
}

// ============================================
// Case Card Component
// ============================================

interface CaseCardProps {
  caseData: {
    id: string;
    caseNumber: string;
    title: string;
    status: CaseStatus;
    type: string;
    client: { id: string; name: string } | null;
    teamMembers: Array<{
      id: string;
      role: string;
      user: { id: string; firstName: string; lastName: string };
    }>;
    referenceNumbers: string[] | null;
    updatedAt: string;
  };
}

function CaseCard({ caseData }: CaseCardProps) {
  const leadMember = caseData.teamMembers.find((m) => m.role === 'Lead');
  const leadName = leadMember ? `${leadMember.user.firstName} ${leadMember.user.lastName}` : null;
  const courtRef = caseData.referenceNumbers?.[0];

  const statusMap: Record<CaseStatus, 'active' | 'pending' | 'completed' | 'draft'> = {
    Active: 'active',
    Pending: 'pending',
    Closed: 'completed',
    OnHold: 'draft',
  };

  return (
    <Link href={`/cases/${caseData.id}`}>
      <Card interactive padding="md">
        <div className="flex items-start gap-3">
          <Avatar name={caseData.client?.name || caseData.title} size="lg" />

          <div className="flex-1 min-w-0">
            {/* Title & Status */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-text-primary truncate">
                {caseData.title}
              </span>
              <StatusBadge status={statusMap[caseData.status]} />
            </div>

            {/* Court Reference Number */}
            {courtRef && <p className="text-xs text-text-secondary">{courtRef}</p>}

            {/* Client & Lead */}
            <div className="flex items-center gap-2 mt-1.5 text-xs text-text-tertiary">
              {caseData.client && <span>{caseData.client.name}</span>}
              {caseData.client && leadName && <span>·</span>}
              {leadName && <span>{leadName}</span>}
            </div>

            {/* Additional Reference Numbers (if more than 1) */}
            {caseData.referenceNumbers && caseData.referenceNumbers.length > 1 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {caseData.referenceNumbers.slice(1, 3).map((ref, i) => (
                  <Badge key={i} variant="default" size="sm">
                    {ref}
                  </Badge>
                ))}
                {caseData.referenceNumbers.length > 3 && (
                  <Badge variant="default" size="sm">
                    +{caseData.referenceNumbers.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <ChevronRight className="w-5 h-5 text-text-tertiary shrink-0 mt-1" />
        </div>
      </Card>
    </Link>
  );
}
