'use client';

/**
 * Team Overview Container
 * Flat list view of all cases with progress indicators
 *
 * Features:
 * - Flat list of cases grouped by client (visual grouping, no expansion)
 * - Clickable case rows to navigate via sidebar selection
 * - Progress bars and attention indicators
 * - Activity stream at bottom
 */

import { clsx } from 'clsx';
import { AlertCircle, RefreshCw, Briefcase, Building2, AlertTriangle } from 'lucide-react';
import { useTeamOverview, AssignedUser } from '@/hooks/useTeamOverview';
import { useTeamActivityStore } from '@/store/teamActivityStore';
import { ActivityStream } from './ActivityStream';
import type { CaseProgress } from '@/hooks/useTeamOverview';

// ============================================================================
// Types
// ============================================================================

interface TeamOverviewProps {
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatHours(hours: number): string {
  if (hours === 0) return '0h';
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

function getUserInitials(user: AssignedUser): string {
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

// ============================================================================
// Progress Bar
// ============================================================================

interface ProgressBarProps {
  completed: number;
  inProgress: number;
  total: number;
}

function ProgressBar({ completed, inProgress, total }: ProgressBarProps) {
  if (total === 0) return null;

  const completedPercent = (completed / total) * 100;
  const inProgressPercent = (inProgress / total) * 100;

  return (
    <div className="h-1.5 w-24 bg-linear-bg-tertiary rounded-full overflow-hidden flex">
      <div className="h-full bg-linear-success" style={{ width: `${completedPercent}%` }} />
      <div className="h-full bg-linear-accent" style={{ width: `${inProgressPercent}%` }} />
    </div>
  );
}

// ============================================================================
// Case Row (Flat, clickable)
// ============================================================================

interface CaseItemProps {
  caseProgress: CaseProgress;
  onClick: () => void;
}

function CaseItem({ caseProgress, onClick }: CaseItemProps) {
  const { case: caseData, timeProgress, taskStats, assignedUsers, attentionFlags } = caseProgress;
  const hasAttention = attentionFlags.length > 0;
  const primaryAssignee = assignedUsers[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 py-3 px-4',
        'text-left transition-colors',
        'hover:bg-linear-bg-hover',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-inset',
        'border-b border-linear-border-subtle'
      )}
    >
      {/* Case icon */}
      <Briefcase className="h-4 w-4 text-linear-text-tertiary flex-shrink-0" />

      {/* Case info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-linear-text-primary truncate">
            {caseData.title}
          </span>
          {hasAttention && (
            <AlertTriangle className="h-3.5 w-3.5 text-linear-warning flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-linear-text-muted">{caseData.caseNumber}</span>
          <span className="text-xs text-linear-text-muted">•</span>
          <span className="text-xs text-linear-text-muted">
            {taskStats.completed}/{taskStats.total} sarcini
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar
        completed={timeProgress.completedHours}
        inProgress={timeProgress.inProgressHours}
        total={timeProgress.totalHours}
      />

      {/* Hours */}
      <span className="text-xs text-linear-text-muted w-16 text-right flex-shrink-0">
        {formatHours(timeProgress.completedHours)}/{formatHours(timeProgress.totalHours)}
      </span>

      {/* Primary assignee */}
      {primaryAssignee && (
        <span
          className="h-6 w-6 rounded-full bg-linear-accent/20 flex items-center justify-center flex-shrink-0"
          title={
            `${primaryAssignee.firstName} ${primaryAssignee.lastName}`.trim() ||
            primaryAssignee.email
          }
        >
          <span className="text-[10px] font-medium text-linear-accent">
            {getUserInitials(primaryAssignee)}
          </span>
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Client Group Header
// ============================================================================

interface ClientGroupHeaderProps {
  clientName: string;
  caseCount: number;
  totalHours: number;
  attentionCount: number;
}

function ClientGroupHeader({
  clientName,
  caseCount,
  totalHours,
  attentionCount,
}: ClientGroupHeaderProps) {
  return (
    <div className="flex items-center gap-3 py-2 px-4 bg-linear-bg-tertiary/50 border-b border-linear-border-subtle">
      <Building2 className="h-4 w-4 text-linear-text-tertiary flex-shrink-0" />
      <span className="text-xs font-medium text-linear-text-secondary uppercase tracking-wider flex-1">
        {clientName}
      </span>
      <span className="text-xs text-linear-text-muted">
        {caseCount} {caseCount === 1 ? 'dosar' : 'dosare'}
      </span>
      <span className="text-xs text-linear-text-muted">{formatHours(totalHours)}</span>
      {attentionCount > 0 && (
        <span className="flex items-center gap-1 text-xs text-linear-warning">
          <AlertTriangle className="h-3 w-3" />
          {attentionCount}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-0 animate-pulse">
      {Array.from({ length: 2 }).map((_, groupIdx) => (
        <div key={groupIdx}>
          <div className="flex items-center gap-3 py-2 px-4 bg-linear-bg-tertiary/50 border-b border-linear-border-subtle">
            <div className="h-4 w-4 bg-linear-bg-tertiary rounded" />
            <div className="h-3 w-32 bg-linear-bg-tertiary rounded" />
          </div>
          {Array.from({ length: 2 }).map((_, caseIdx) => (
            <div
              key={caseIdx}
              className="flex items-center gap-3 py-3 px-4 border-b border-linear-border-subtle"
            >
              <div className="h-4 w-4 bg-linear-bg-tertiary rounded" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-48 bg-linear-bg-tertiary rounded" />
                <div className="h-3 w-32 bg-linear-bg-tertiary rounded" />
              </div>
              <div className="h-1.5 w-24 bg-linear-bg-tertiary rounded-full" />
              <div className="h-4 w-16 bg-linear-bg-tertiary rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-linear-bg-tertiary rounded-full mb-4">
        <Briefcase className="h-8 w-8 text-linear-text-muted" />
      </div>
      <h2 className="text-lg font-medium text-linear-text-primary mb-2">
        Nicio activitate curentă
      </h2>
      <p className="text-sm text-linear-text-muted max-w-md">
        Nu există dosare cu sarcini în progres sau finalizate recent.
      </p>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function TeamOverview({ className }: TeamOverviewProps) {
  const { clientGroups, loading, error, refetch } = useTeamOverview();
  const { setSidebarSelection } = useTeamActivityStore();

  // ============================================================================
  // Error State
  // ============================================================================

  if (error) {
    return (
      <div className={clsx('flex flex-col items-center justify-center py-12', className)}>
        <AlertCircle className="h-12 w-12 text-linear-error mb-4" />
        <h3 className="text-lg font-medium text-linear-text-primary mb-2">
          Eroare la încărcarea datelor
        </h3>
        <p className="text-sm text-linear-text-secondary mb-4">
          {error.message || 'A apărut o eroare neașteptată'}
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-linear-text-primary bg-linear-bg-tertiary hover:bg-linear-bg-hover rounded-md transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Încearcă din nou
        </button>
      </div>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className={clsx('flex flex-col h-full', className)}>
      {/* Header with Refresh button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-linear-border-subtle">
        <h3 className="text-sm font-medium text-linear-text-primary">Toate dosarele active</h3>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-linear-text-secondary hover:text-linear-text-primary transition-colors disabled:opacity-50"
          title="Reîmprospătează datele"
        >
          <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
          {loading ? 'Se încarcă...' : 'Actualizează'}
        </button>
      </div>

      {/* Main scrollable area - Flat case list grouped by client */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && clientGroups.length === 0 ? (
          <LoadingSkeleton />
        ) : clientGroups.length === 0 ? (
          <EmptyState />
        ) : (
          <div>
            {clientGroups.map((clientGroup) => (
              <div key={clientGroup.client.id}>
                {/* Client header */}
                <ClientGroupHeader
                  clientName={clientGroup.client.name}
                  caseCount={clientGroup.cases.length}
                  totalHours={clientGroup.totalHours}
                  attentionCount={clientGroup.attentionCount}
                />
                {/* Cases */}
                {clientGroup.cases.map((caseProgress) => (
                  <CaseItem
                    key={caseProgress.case.id}
                    caseProgress={caseProgress}
                    onClick={() =>
                      setSidebarSelection({ type: 'case', caseId: caseProgress.case.id })
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Stream - Always visible at bottom */}
      <ActivityStream className="flex-shrink-0" defaultOpen={true} />
    </div>
  );
}

TeamOverview.displayName = 'TeamOverview';

export default TeamOverview;
