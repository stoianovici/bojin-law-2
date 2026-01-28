'use client';

/**
 * Client Activity View
 * Displays client-level progress (tasks/docs not tied to any case)
 *
 * Used when a client is selected in the Team Activity sidebar.
 */

import { clsx } from 'clsx';
import {
  AlertCircle,
  RefreshCw,
  Building2,
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useClientProgress, ClientProgress } from '@/hooks/useClientProgress';
import { TaskRow } from './TaskRow';
import type { OverviewTask } from '@/hooks/useTeamOverview';

// ============================================================================
// Types
// ============================================================================

interface ClientActivityViewProps {
  clientId: string;
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
  clientProgress: ClientProgress;
}

function StatsCard({ clientProgress }: StatsCardProps) {
  const { taskStats, timeProgress, docStats, attentionFlags } = clientProgress;

  return (
    <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-4">
      {/* Header with client name */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-linear-bg-tertiary rounded-lg">
          <Building2 className="h-5 w-5 text-linear-text-secondary" />
        </div>
        <div>
          <h3 className="font-medium text-linear-text-primary">{clientProgress.client.name}</h3>
          <p className="text-xs text-linear-text-secondary">Sarcini la nivel de client</p>
        </div>
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
            <Circle className="h-4 w-4 text-linear-text-secondary" />
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
// Tasks List
// ============================================================================

interface TasksListProps {
  tasks: OverviewTask[];
}

function TasksList({ tasks }: TasksListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-linear-text-muted">
        Nicio sarcină la nivel de client
      </div>
    );
  }

  return (
    <div className="border-t border-linear-border-subtle">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
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
          <div className="space-y-2">
            <div className="h-4 w-32 bg-linear-bg-tertiary rounded" />
            <div className="h-3 w-24 bg-linear-bg-tertiary rounded" />
          </div>
        </div>
        <div className="h-2 w-full bg-linear-bg-tertiary rounded-full" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2.5 px-4 border-b border-linear-border-subtle"
          >
            <div className="h-4 w-4 bg-linear-bg-tertiary rounded" />
            <div className="h-4 flex-1 bg-linear-bg-tertiary rounded" />
            <div className="h-4 w-12 bg-linear-bg-tertiary rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ clientName }: { clientName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-linear-bg-tertiary rounded-full mb-4">
        <Building2 className="h-8 w-8 text-linear-text-muted" />
      </div>
      <h2 className="text-lg font-medium text-linear-text-primary mb-2">
        Nicio activitate la nivel de client
      </h2>
      <p className="text-sm text-linear-text-muted max-w-md">
        {clientName
          ? `Clientul "${clientName}" nu are sarcini sau documente care nu sunt asociate unui dosar.`
          : 'Nu există sarcini sau documente la nivel de client.'}
      </p>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ClientActivityView({ clientId, className }: ClientActivityViewProps) {
  const { clientProgress, loading, error, refetch } = useClientProgress(clientId);

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
          {clientProgress?.client.name ?? 'Client'}
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
        {loading && !clientProgress ? (
          <LoadingSkeleton />
        ) : !clientProgress ||
          (clientProgress.taskStats.total === 0 && clientProgress.docStats.total === 0) ? (
          <EmptyState clientName={clientProgress?.client.name} />
        ) : (
          <div className="space-y-4">
            <StatsCard clientProgress={clientProgress} />
            <TasksList tasks={clientProgress.tasks} />
          </div>
        )}
      </div>
    </div>
  );
}

ClientActivityView.displayName = 'ClientActivityView';

export default ClientActivityView;
