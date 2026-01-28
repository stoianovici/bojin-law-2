'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client/react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Briefcase,
  AlertCircle,
  Check,
  Loader2,
  Flag,
} from 'lucide-react';
import { Card, Badge, StatusBadge, Skeleton, Button } from '@/components/ui';
import { GET_TASK } from '@/graphql/queries';
import { UPDATE_TASK_STATUS } from '@/graphql/mutations';
import { useTaskTimeLog, type TimeEntry } from '@/hooks/useTaskTimeLog';
import { formatDuration, formatTimeEntryDate } from '@/lib/formatters';
import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: 'Pending' | 'InProgress' | 'Completed' | 'Cancelled';
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  dueDate: string | null;
  dueTime: string | null;
  estimatedHours: number | null;
  loggedTime: number | null;
  case: {
    id: string;
    caseNumber: string;
    title: string;
  } | null;
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: string;
  completedAt: string | null;
}

// ============================================
// Constants
// ============================================

const QUICK_HOURS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 8];

// ============================================
// Page Component
// ============================================

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const { data, loading, error } = useQuery<{ task: TaskData }>(GET_TASK, {
    variables: { id: taskId },
  });

  const [updateStatus, { loading: updating }] = useMutation(UPDATE_TASK_STATUS);

  const { entries, totalHours, loading: entriesLoading, logging, logTime } = useTaskTimeLog(taskId);

  const [manualHours, setManualHours] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const task = data?.task;

  // Handle complete task
  const handleComplete = async () => {
    if (!task) return;
    const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    await updateStatus({
      variables: { id: taskId, status: newStatus },
    });
  };

  // Handle quick time log
  const handleQuickLog = async (hours: number) => {
    if (!task) return;
    const description = `Lucru la: ${task.title}`;
    await logTime(hours, description);
    setSuccessMessage(`${formatDuration(hours)} înregistrat`);
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // Handle manual time log
  const handleManualLog = async () => {
    const hours = parseFloat(manualHours);
    if (isNaN(hours) || hours <= 0 || !task) return;
    const description = `Lucru la: ${task.title}`;
    await logTime(hours, description);
    setManualHours('');
    setSuccessMessage(`${formatDuration(hours)} înregistrat`);
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  if (loading && !task) {
    return <TaskDetailSkeleton />;
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-bg-primary px-6 py-4">
        <button onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-6 h-6 text-text-primary" />
        </button>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
          <p className="text-text-secondary">Nu s-a putut încărca sarcina</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.back()}>
            Înapoi la sarcini
          </Button>
        </div>
      </div>
    );
  }

  const isCompleted = task.status === 'Completed';
  const isOverdue = task.dueDate && !isCompleted && new Date(task.dueDate) < new Date();

  const statusMap: Record<string, 'active' | 'pending' | 'completed' | 'draft'> = {
    Pending: 'pending',
    InProgress: 'active',
    Completed: 'completed',
    Cancelled: 'draft',
  };

  const priorityColors: Record<string, string> = {
    Urgent: 'text-error',
    High: 'text-warning',
    Normal: 'text-accent',
    Low: 'text-text-tertiary',
  };

  const priorityLabels: Record<string, string> = {
    Urgent: 'Urgent',
    High: 'Înaltă',
    Normal: 'Normală',
    Low: 'Scăzută',
  };

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-lg border-b border-white/5">
        <div className="px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center -ml-2"
          >
            <ArrowLeft className="w-5 h-5 text-text-primary" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{task.title}</p>
            {task.case && <p className="text-xs text-text-tertiary truncate">{task.case.title}</p>}
          </div>
          <StatusBadge status={statusMap[task.status]} />
        </div>
      </div>

      {/* Task Overview */}
      <div className="px-6 py-4 space-y-4">
        {/* Priority & Due Date */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="default" size="sm" className={priorityColors[task.priority]}>
            <Flag className="w-3 h-3 mr-1" />
            {priorityLabels[task.priority]}
          </Badge>
          {task.dueDate && (
            <Badge variant="default" size="sm" className={isOverdue ? 'text-error' : undefined}>
              <Calendar className="w-3 h-3 mr-1" />
              {format(new Date(task.dueDate), 'd MMM yyyy', { locale: ro })}
              {task.dueTime && ` ${task.dueTime.slice(0, 5)}`}
            </Badge>
          )}
          {task.type && (
            <Badge variant="default" size="sm">
              {task.type}
            </Badge>
          )}
        </div>

        {/* Case & Assignee */}
        {(task.case || task.assignee) && (
          <div className="flex flex-wrap gap-3">
            {task.case && (
              <button
                onClick={() => router.push(`/cases/${task.case!.id}`)}
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors"
              >
                <Briefcase className="w-4 h-4" />
                <span className="truncate max-w-[200px]">{task.case.title}</span>
              </button>
            )}
            {task.assignee && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <User className="w-4 h-4" />
                <span>
                  {task.assignee.firstName} {task.assignee.lastName}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div>
            <p className="text-xs font-medium text-text-tertiary mb-1">Descriere</p>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{task.description}</p>
          </div>
        )}
      </div>

      {/* Time Logging Section */}
      <div className="px-6 py-4 border-t border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">Timp pontat</span>
          </div>
          {totalHours > 0 && (
            <span className="text-sm font-medium text-accent">{formatDuration(totalHours)}</span>
          )}
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="bg-success/15 text-success text-sm font-medium py-2 px-3 rounded-lg text-center mb-4">
            {successMessage}
          </div>
        )}

        {/* Quick hours grid */}
        <div className="mb-4">
          <p className="text-xs text-text-tertiary mb-2">Ore</p>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_HOURS.map((hours) => (
              <button
                key={hours}
                onClick={() => handleQuickLog(hours)}
                disabled={logging}
                className={clsx(
                  'py-2.5 rounded-lg text-sm font-medium transition-colors',
                  'bg-bg-card hover:bg-bg-hover active:bg-accent/20',
                  'text-text-primary',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {hours}
              </button>
            ))}
          </div>
        </div>

        {/* Manual input */}
        <div className="mb-4">
          <p className="text-xs text-text-tertiary mb-2">Sau introdu manual</p>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={manualHours}
              onChange={(e) => setManualHours(e.target.value)}
              placeholder="Ore..."
              className={clsx(
                'flex-1 py-2.5 px-3 rounded-lg text-sm',
                'bg-bg-card text-text-primary placeholder:text-text-tertiary',
                'border border-border focus:border-accent focus:outline-none'
              )}
            />
            <button
              onClick={handleManualLog}
              disabled={logging || !manualHours || parseFloat(manualHours) <= 0}
              className={clsx(
                'px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                'bg-accent text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {logging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvează'}
            </button>
          </div>
        </div>

        {/* Time history */}
        {(entries.length > 0 || entriesLoading) && (
          <Card padding="md" className="mt-4">
            <p className="text-xs font-medium text-text-tertiary mb-3">Istoric</p>
            {entriesLoading && entries.length === 0 ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <TimeEntryRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Bottom Actions */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-bg-primary/80 backdrop-blur-lg border-t border-white/5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <Button
            variant="primary"
            fullWidth
            onClick={handleComplete}
            disabled={updating}
            className="bg-success hover:bg-success/90"
          >
            {updating ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Finalizează
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Time Entry Row
// ============================================

interface TimeEntryRowProps {
  entry: TimeEntry;
}

function TimeEntryRow({ entry }: TimeEntryRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">{formatTimeEntryDate(entry.date)}</span>
        <span className="text-xs text-text-tertiary">
          {entry.user.firstName} {entry.user.lastName.charAt(0)}.
        </span>
      </div>
      <span className="text-sm font-medium text-text-primary">{formatDuration(entry.hours)}</span>
    </div>
  );
}

// ============================================
// Loading Skeleton
// ============================================

function TaskDetailSkeleton() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-48 mb-1" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Overview */}
      <div className="px-6 py-4 space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div>
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-1" />
        </div>
      </div>

      {/* Time section */}
      <div className="px-6 py-4 border-t border-white/5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-3 w-12 mb-2" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
