'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Search, ChevronRight, Filter } from 'lucide-react';
import { LargeHeader } from '@/components/layout';
import {
  Card,
  Avatar,
  Badge,
  StatusBadge,
  EmptyList,
  SkeletonList,
  BottomSheet,
  BottomSheetContent,
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
  const { cases, loading, statusFilter, setStatusFilter, searchQuery, setSearchQuery, refetch } =
    useCases();

  const handleRefresh = async () => {
    await refetch();
  };

  const [showFilter, setShowFilter] = useState(false);

  const activeFilterLabel = statusOptions.find((o) => o.value === statusFilter)?.label;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <LargeHeader
        title="Dosare"
        subtitle={`${cases.length} ${statusFilter === 'All' ? 'total' : activeFilterLabel?.toLowerCase()}`}
      />

      {/* Search & Filter Bar */}
      <div className="px-6 py-3 flex gap-2">
        {/* Search Input */}
        <div className="flex-1 relative">
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

        {/* Filter Button */}
        <button
          onClick={() => setShowFilter(true)}
          className={clsx(
            'flex items-center gap-2 h-10 px-3',
            'bg-bg-elevated rounded-lg',
            'text-sm',
            statusFilter !== 'All' ? 'text-accent' : 'text-text-secondary'
          )}
        >
          <Filter className="w-4 h-4" />
          {statusFilter !== 'All' && <span>{activeFilterLabel}</span>}
        </button>
      </div>

      {/* Cases List */}
      <PullToRefresh onRefresh={handleRefresh} disabled={loading} className="px-6 py-2">
        {loading ? (
          <SkeletonList count={5} />
        ) : cases.length === 0 ? (
          <EmptyList itemName="dosar" />
        ) : (
          <div className="space-y-2">
            {cases.map((caseItem, index) => (
              <ListItemTransition key={caseItem.id} index={index}>
                <CaseCard caseData={caseItem} />
              </ListItemTransition>
            ))}
          </div>
        )}
      </PullToRefresh>

      {/* Filter Bottom Sheet */}
      <BottomSheet
        open={showFilter}
        onClose={() => setShowFilter(false)}
        title="Filtrează după status"
      >
        <BottomSheetContent>
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setStatusFilter(option.value);
                  setShowFilter(false);
                }}
                className={clsx(
                  'w-full flex items-center justify-between',
                  'p-4 rounded-lg',
                  'transition-colors',
                  statusFilter === option.value
                    ? 'bg-accent-muted text-accent'
                    : 'bg-bg-card text-text-primary hover:bg-bg-hover'
                )}
              >
                <span className="font-medium">{option.label}</span>
                {statusFilter === option.value && (
                  <div className="w-2 h-2 rounded-full bg-accent" />
                )}
              </button>
            ))}
          </div>
        </BottomSheetContent>
      </BottomSheet>
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
            {/* Case Number & Status */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-text-primary">{caseData.caseNumber}</span>
              <StatusBadge status={statusMap[caseData.status]} />
            </div>

            {/* Title */}
            <p className="text-sm text-text-secondary truncate">{caseData.title}</p>

            {/* Client & Lead */}
            <div className="flex items-center gap-2 mt-1.5 text-xs text-text-tertiary">
              {caseData.client && <span>{caseData.client.name}</span>}
              {caseData.client && leadName && <span>·</span>}
              {leadName && <span>{leadName}</span>}
            </div>

            {/* Reference Numbers */}
            {caseData.referenceNumbers && caseData.referenceNumbers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {caseData.referenceNumbers.slice(0, 2).map((ref, i) => (
                  <Badge key={i} variant="default" size="sm">
                    {ref}
                  </Badge>
                ))}
                {caseData.referenceNumbers.length > 2 && (
                  <Badge variant="default" size="sm">
                    +{caseData.referenceNumbers.length - 2}
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
