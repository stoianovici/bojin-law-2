'use client';

/**
 * Case Activity View
 * Displays a single case's progress directly (no expandable accordion)
 *
 * Used when a case is selected in the Team Activity sidebar.
 */

import { useMemo } from 'react';
import { clsx } from 'clsx';
import {
  AlertCircle,
  RefreshCw,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  Check,
  ArrowRight,
  Circle,
  ChevronRight,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTeamOverview } from '@/hooks/useTeamOverview';
import type {
  CaseProgress,
  OverviewTask,
  TaskStatusType,
  AssignedUser,
} from '@/hooks/useTeamOverview';

// ============================================================================
// Types
// ============================================================================

interface CaseActivityViewProps {
  caseId: string;
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

function getStatusIcon(status: TaskStatusType) {
  switch (status) {
    case 'Completed':
      return <Check className="h-4 w-4 text-linear-success" />;
    case 'InProgress':
      return <ArrowRight className="h-4 w-4 text-linear-accent" />;
    default:
      return <Circle className="h-4 w-4 text-linear-text-muted" />;
  }
}

// ============================================================================
// Progress Bar
// ============================================================================

interface ProgressBarProps {
  completed: number;
  inProgress: number;
  notStarted: number;
  total: number;
}

function ProgressBar({ completed, inProgress, notStarted, total }: ProgressBarProps) {
  if (total === 0) return null;

  const completedPct = (completed / total) * 100;
  const inProgressPct = (inProgress / total) * 100;
  const notStartedPct = (notStarted / total) * 100;

  return (
    <div className="h-2 rounded-full bg-linear-bg-tertiary overflow-hidden flex">
      {completedPct > 0 && (
        <div
          className="h-full bg-linear-success"
          style={{ width: `${completedPct}%` }}
          title={`Finalizat: ${formatHours(completed)}`}
        />
      )}
      {inProgressPct > 0 && (
        <div
          className="h-full bg-linear-accent"
          style={{ width: `${inProgressPct}%` }}
          title={`În progres: ${formatHours(inProgress)}`}
        />
      )}
      {notStartedPct > 0 && (
        <div
          className="h-full bg-linear-bg-hover"
          style={{ width: `${notStartedPct}%` }}
          title={`Neînceput: ${formatHours(notStarted)}`}
        />
      )}
    </div>
  );
}

// ============================================================================
// Stats Card
// ============================================================================

interface StatsCardProps {
  caseProgress: CaseProgress;
}

function StatsCard({ caseProgress }: StatsCardProps) {
  const {
    case: caseData,
    taskStats,
    timeProgress,
    docStats,
    assignedUsers,
    attentionFlags,
  } = caseProgress;

  return (
    <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-4">
      {/* Header with case info */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-linear-bg-tertiary rounded-lg">
          <Briefcase className="h-5 w-5 text-linear-text-secondary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-linear-text-primary truncate">{caseData.title}</h3>
          <p className="text-xs text-linear-text-secondary">
            {caseData.caseNumber}
            {caseData.client && ` • ${caseData.client.name}`}
          </p>
        </div>
        {/* Assignees */}
        {assignedUsers.length > 0 && (
          <div className="flex -space-x-2">
            {assignedUsers.slice(0, 3).map((user) => (
              <span
                key={user.id}
                className="h-7 w-7 rounded-full bg-linear-accent/20 flex items-center justify-center border-2 border-linear-bg-secondary"
                title={`${user.firstName} ${user.lastName}`.trim() || user.email}
              >
                <span className="text-[10px] font-medium text-linear-accent">
                  {getUserInitials(user)}
                </span>
              </span>
            ))}
            {assignedUsers.length > 3 && (
              <span className="h-7 w-7 rounded-full bg-linear-bg-tertiary flex items-center justify-center border-2 border-linear-bg-secondary">
                <span className="text-[10px] font-medium text-linear-text-muted">
                  +{assignedUsers.length - 3}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <ProgressBar
          completed={timeProgress.completedHours}
          inProgress={timeProgress.inProgressHours}
          notStarted={timeProgress.notStartedHours}
          total={timeProgress.totalHours}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-linear-text-muted">
          <span>Progres ore estimate</span>
          <span>
            {formatHours(timeProgress.completedHours)} / {formatHours(timeProgress.totalHours)}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Tasks */}
        <div className="space-y-1">
          <span className="text-xs text-linear-text-muted">Sarcini</span>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-linear-success" />
            <span className="text-linear-text-primary">{taskStats.completed}</span>
            <span className="text-linear-text-muted">/</span>
            <span className="text-linear-text-muted">{taskStats.total}</span>
          </div>
        </div>

        {/* In Progress */}
        <div className="space-y-1">
          <span className="text-xs text-linear-text-muted">În progres</span>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-linear-accent" />
            <span className="text-linear-text-primary">{taskStats.inProgress}</span>
          </div>
        </div>

        {/* Documents */}
        <div className="space-y-1">
          <span className="text-xs text-linear-text-muted">Documente</span>
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-linear-text-secondary" />
            <span className="text-linear-text-primary">{docStats.total}</span>
          </div>
        </div>
      </div>

      {/* Attention flags (collapsible) */}
      {attentionFlags.length > 0 && (
        <Collapsible defaultOpen={false} className="pt-3 border-t border-linear-border-subtle">
          <CollapsibleTrigger className="flex items-center gap-2 w-full group">
            <ChevronRight className="h-4 w-4 text-linear-warning transition-transform group-data-[state=open]:rotate-90" />
            <AlertTriangle className="h-4 w-4 text-linear-warning" />
            <span className="text-xs font-medium text-linear-warning">
              {attentionFlags.length} punct{attentionFlags.length !== 1 ? 'e' : ''} de atenție
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <ul className="space-y-1.5 pl-6">
              {attentionFlags.map((flag, index) => (
                <li
                  key={index}
                  className={clsx(
                    'flex items-start gap-2 text-sm',
                    flag.severity === 'CRITICAL' ? 'text-linear-error' : 'text-linear-warning'
                  )}
                >
                  <span className="mt-0.5">•</span>
                  <span>{flag.message}</span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ============================================================================
// Task Item (flat, no tree connectors)
// ============================================================================

interface TaskItemProps {
  task: OverviewTask;
}

function TaskItem({ task }: TaskItemProps) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-4 border-b border-linear-border-subtle last:border-b-0 hover:bg-linear-bg-hover transition-colors">
      {/* Status icon */}
      <span className="flex-shrink-0">{getStatusIcon(task.status)}</span>

      {/* Title */}
      <span
        className={clsx(
          'flex-1 text-sm truncate',
          task.status === 'Completed' ? 'text-linear-text-secondary' : 'text-linear-text-primary'
        )}
      >
        {task.title}
      </span>

      {/* Warning badge if stuck */}
      {task.isStuck && task.stuckMessage && (
        <span className="flex items-center gap-1 text-xs text-linear-warning flex-shrink-0">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{task.stuckMessage}</span>
        </span>
      )}

      {/* Assignee */}
      {task.assignee && (
        <span
          className="h-6 w-6 rounded-full bg-linear-accent/20 flex items-center justify-center flex-shrink-0"
          title={
            `${task.assignee.firstName} ${task.assignee.lastName}`.trim() || task.assignee.email
          }
        >
          <span className="text-[10px] font-medium text-linear-accent">
            {getUserInitials(task.assignee)}
          </span>
        </span>
      )}

      {/* Estimated hours */}
      {task.estimatedHours !== null && (
        <span className="text-xs text-linear-text-muted flex-shrink-0 w-8 text-right">
          {formatHours(task.estimatedHours)}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 bg-linear-bg-tertiary rounded-lg" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-48 bg-linear-bg-tertiary rounded" />
            <div className="h-3 w-32 bg-linear-bg-tertiary rounded" />
          </div>
        </div>
        <div className="h-2 w-full bg-linear-bg-tertiary rounded-full" />
      </div>
      <div className="space-y-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2.5 px-4 border-b border-linear-border-subtle"
          >
            <div className="h-4 w-4 bg-linear-bg-tertiary rounded" />
            <div className="h-4 flex-1 bg-linear-bg-tertiary rounded" />
            <div className="h-4 w-8 bg-linear-bg-tertiary rounded" />
          </div>
        ))}
      </div>
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
      <h2 className="text-lg font-medium text-linear-text-primary mb-2">Dosar negăsit</h2>
      <p className="text-sm text-linear-text-muted max-w-md">
        Dosarul selectat nu a fost găsit sau nu are activitate curentă.
      </p>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function CaseActivityView({ caseId, className }: CaseActivityViewProps) {
  const { clientGroups, loading, error, refetch } = useTeamOverview();

  // Find the case in the client groups
  const caseProgress = useMemo(() => {
    for (const group of clientGroups) {
      const found = group.cases.find((cp) => cp.case.id === caseId);
      if (found) return found;
    }
    return null;
  }, [clientGroups, caseId]);

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
        <h3 className="text-sm font-medium text-linear-text-primary">
          {caseProgress?.case.title ?? 'Dosar'}
        </h3>
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

      {/* Main scrollable area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {loading && !caseProgress ? (
          <LoadingSkeleton />
        ) : !caseProgress ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            <StatsCard caseProgress={caseProgress} />

            {/* Tasks list */}
            <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary overflow-hidden">
              <div className="px-4 py-2 border-b border-linear-border-subtle bg-linear-bg-tertiary/50">
                <h4 className="text-xs font-medium uppercase tracking-wider text-linear-text-muted">
                  Sarcini ({caseProgress.tasks.length})
                </h4>
              </div>
              {caseProgress.tasks.length > 0 ? (
                <div>
                  {caseProgress.tasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-linear-text-muted">
                  Nicio sarcină activă
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

CaseActivityView.displayName = 'CaseActivityView';

export default CaseActivityView;
