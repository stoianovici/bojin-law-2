/**
 * MobileTasks Component
 * OPS-328: Mobile Page Consistency
 *
 * Mobile-optimized tasks list with:
 * - List view by default (no calendar)
 * - Group by due date (Today, Tomorrow, This Week, Later)
 * - Touch-friendly task items with checkbox
 * - Quick filters for status
 * - Pull-to-refresh support
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckSquare,
  Plus,
  RefreshCw,
  AlertCircle,
  Circle,
  CheckCircle2,
  Calendar,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { MobileDrawer } from './MobileDrawer';
import { MobileHeader } from './MobileHeader';
import { useTasks } from '../../hooks/useTasks';
import { useSetAIContext } from '../../contexts/AIAssistantContext';
import { usePullToRefresh, type PullState } from '../../hooks/usePullToRefresh';
import type { Task, TaskStatus, TaskPriority } from '@legal-platform/types';

// Priority configuration
const PRIORITY_CONFIG: Record<TaskPriority, { color: string; label: string }> = {
  Urgent: { color: 'bg-red-500', label: 'Urgent' },
  High: { color: 'bg-orange-500', label: 'Ridicată' },
  Medium: { color: 'bg-yellow-500', label: 'Medie' },
  Low: { color: 'bg-green-500', label: 'Scăzută' },
};

// Task type labels
const TYPE_LABELS: Record<string, string> = {
  Research: 'Cercetare',
  DocumentCreation: 'Creare document',
  DocumentRetrieval: 'Obținere document',
  CourtDate: 'Termen instanță',
  ClientMeeting: 'Întâlnire client',
  Deadline: 'Termen limită',
  Review: 'Revizuire',
  Other: 'Altele',
};

type FilterStatus = 'all' | 'pending' | 'completed';

export function MobileTasks() {
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('pending');

  // Set AI assistant context
  useSetAIContext('tasks');

  // Convert filter to API format
  const apiFilters = useMemo(() => {
    if (statusFilter === 'pending') {
      return { statuses: ['Pending', 'InProgress'] as TaskStatus[] };
    }
    if (statusFilter === 'completed') {
      return { statuses: ['Completed'] as TaskStatus[] };
    }
    return undefined;
  }, [statusFilter]);

  // Fetch tasks
  const { tasks, loading, error, refetch } = useTasks(apiFilters);

  // Group tasks by date
  const groupedTasks = useMemo(() => {
    const groups: { title: string; tasks: Task[] }[] = [];
    const overdue: Task[] = [];
    const today: Task[] = [];
    const tomorrow: Task[] = [];
    const thisWeek: Task[] = [];
    const later: Task[] = [];
    const noDueDate: Task[] = [];

    tasks.forEach((task) => {
      if (!task.dueDate) {
        noDueDate.push(task);
        return;
      }

      const dueDate = parseISO(task.dueDate);

      if (isPast(dueDate) && !isToday(dueDate) && task.status !== 'Completed') {
        overdue.push(task);
      } else if (isToday(dueDate)) {
        today.push(task);
      } else if (isTomorrow(dueDate)) {
        tomorrow.push(task);
      } else if (isThisWeek(dueDate)) {
        thisWeek.push(task);
      } else {
        later.push(task);
      }
    });

    if (overdue.length > 0) groups.push({ title: 'Întârziate', tasks: overdue });
    if (today.length > 0) groups.push({ title: 'Astăzi', tasks: today });
    if (tomorrow.length > 0) groups.push({ title: 'Mâine', tasks: tomorrow });
    if (thisWeek.length > 0) groups.push({ title: 'Săptămâna aceasta', tasks: thisWeek });
    if (later.length > 0) groups.push({ title: 'Mai târziu', tasks: later });
    if (noDueDate.length > 0) groups.push({ title: 'Fără termen', tasks: noDueDate });

    return groups;
  }, [tasks]);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const {
    state: pullState,
    pullDistance,
    progress,
    containerRef,
    containerProps,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: !loading,
  });

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const handleTaskTap = useCallback(
    (taskId: string, caseId?: string) => {
      if (caseId) {
        router.push(`/cases/${caseId}?tab=tasks&taskId=${taskId}`);
      }
    },
    [router]
  );

  // Error state
  if (error && tasks.length === 0) {
    return (
      <div className="min-h-screen bg-linear-bg-primary flex flex-col">
        <MobileHeader title="Sarcini" onMenuClick={openDrawer} />
        <MobileDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-12 h-12 text-linear-error mb-4" />
          <p className="text-linear-text-secondary text-center mb-4">
            Nu am putut încărca sarcinile
          </p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-linear-accent text-white rounded-lg active:scale-95 transition-transform"
          >
            <RefreshCw className="w-4 h-4" />
            Încearcă din nou
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-bg-primary flex flex-col">
      <MobileHeader title="Sarcini" onMenuClick={openDrawer} />
      <MobileDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />

      {/* Filter Tabs */}
      <div className="px-4 py-3 border-b border-linear-border-subtle">
        <div className="flex gap-2">
          <FilterTab
            label="De făcut"
            active={statusFilter === 'pending'}
            onClick={() => setStatusFilter('pending')}
          />
          <FilterTab
            label="Finalizate"
            active={statusFilter === 'completed'}
            onClick={() => setStatusFilter('completed')}
          />
          <FilterTab
            label="Toate"
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
        </div>
      </div>

      {/* Tasks List */}
      <main className="flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="h-full overflow-y-auto"
          {...containerProps}
        >
          {/* Pull-to-refresh indicator */}
          <PullIndicator state={pullState} pullDistance={pullDistance} progress={progress} />

          <div
            className="transition-transform duration-200"
            style={{
              transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
            }}
          >
            {/* Loading State */}
            {loading && tasks.length === 0 && (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <TaskItemSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 bg-linear-bg-tertiary rounded-full flex items-center justify-center mb-4">
                  <CheckSquare className="w-8 h-8 text-linear-text-muted" />
                </div>
                <p className="text-linear-text-secondary text-center font-medium">
                  {statusFilter === 'completed' ? 'Nicio sarcină finalizată' : 'Nicio sarcină'}
                </p>
                <p className="text-sm text-linear-text-muted text-center mt-1">
                  {statusFilter === 'pending'
                    ? 'Toate sarcinile sunt finalizate!'
                    : 'Sarcinile vor apărea aici'}
                </p>
              </div>
            )}

            {/* Grouped Tasks */}
            {groupedTasks.length > 0 && (
              <div className="pb-4">
                {groupedTasks.map((group) => (
                  <div key={group.title}>
                    {/* Group Header */}
                    <div className="px-4 py-2 sticky top-0 bg-linear-bg-primary/95 backdrop-blur-sm">
                      <span
                        className={`text-xs font-semibold uppercase tracking-wider ${
                          group.title === 'Întârziate'
                            ? 'text-red-400'
                            : 'text-linear-text-muted'
                        }`}
                      >
                        {group.title}
                      </span>
                      <span className="text-xs text-linear-text-muted ml-2">
                        ({group.tasks.length})
                      </span>
                    </div>

                    {/* Tasks in Group */}
                    <div className="px-4 space-y-2">
                      {group.tasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onTap={() => handleTaskTap(task.id, task.caseId)}
                          isOverdue={group.title === 'Întârziate'}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Results count */}
                <div className="text-center py-4 text-sm text-linear-text-muted">
                  {tasks.length} {tasks.length === 1 ? 'sarcină' : 'sarcini'}
                </div>
              </div>
            )}

            {/* Loading more indicator */}
            {loading && tasks.length > 0 && (
              <div className="flex justify-center py-4">
                <RefreshCw className="w-5 h-5 text-linear-text-muted animate-spin" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// TaskItem Component
// ============================================================================

interface TaskItemProps {
  task: Task;
  onTap: () => void;
  isOverdue?: boolean;
}

function TaskItem({ task, onTap, isOverdue }: TaskItemProps) {
  const isCompleted = task.status === 'Completed';
  const priorityConfig = PRIORITY_CONFIG[task.priority as TaskPriority] || PRIORITY_CONFIG.Medium;
  const typeLabel = TYPE_LABELS[task.type] || task.type;

  // Format due date
  const dueDateDisplay = useMemo(() => {
    if (!task.dueDate) return null;
    const date = parseISO(task.dueDate);
    if (isToday(date)) return 'Astăzi';
    if (isTomorrow(date)) return 'Mâine';
    return format(date, 'd MMM', { locale: ro });
  }, [task.dueDate]);

  return (
    <button
      onClick={onTap}
      className={`w-full text-left p-3 rounded-xl flex items-start gap-3 active:scale-[0.98] transition-all ${
        isCompleted
          ? 'bg-linear-bg-secondary/50'
          : 'bg-linear-bg-secondary active:bg-linear-bg-tertiary'
      } border border-linear-border-subtle`}
    >
      {/* Checkbox */}
      <div className="pt-0.5">
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <Circle className="w-5 h-5 text-linear-text-muted" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p
          className={`text-sm font-medium mb-1 ${
            isCompleted
              ? 'text-linear-text-muted line-through'
              : 'text-linear-text-primary'
          }`}
        >
          {task.title}
        </p>

        {/* Meta info */}
        <div className="flex items-center gap-2 text-xs text-linear-text-secondary">
          {/* Priority indicator */}
          {!isCompleted && task.priority !== 'Medium' && (
            <span className={`w-2 h-2 rounded-full ${priorityConfig.color}`} />
          )}

          {/* Type */}
          <span>{typeLabel}</span>

          {/* Case */}
          {task.case && (
            <>
              <span className="text-linear-text-muted">·</span>
              <span className="truncate max-w-[100px]">{task.case.title}</span>
            </>
          )}
        </div>

        {/* Due date */}
        {dueDateDisplay && !isCompleted && (
          <div className="flex items-center gap-1 mt-1.5">
            <Calendar className="w-3 h-3 text-linear-text-muted" />
            <span
              className={`text-xs ${
                isOverdue ? 'text-red-400 font-medium' : 'text-linear-text-secondary'
              }`}
            >
              {dueDateDisplay}
            </span>
            {task.dueTime && (
              <>
                <Clock className="w-3 h-3 text-linear-text-muted ml-1" />
                <span className="text-xs text-linear-text-secondary">{task.dueTime}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-linear-text-muted mt-0.5" />
    </button>
  );
}

// ============================================================================
// TaskItemSkeleton Component
// ============================================================================

function TaskItemSkeleton() {
  return (
    <div className="p-3 bg-linear-bg-secondary border border-linear-border-subtle rounded-xl flex items-start gap-3 animate-pulse">
      <div className="w-5 h-5 rounded-full bg-linear-bg-tertiary" />
      <div className="flex-1">
        <div className="h-4 w-3/4 bg-linear-bg-tertiary rounded mb-2" />
        <div className="h-3 w-1/2 bg-linear-bg-tertiary rounded" />
      </div>
    </div>
  );
}

// ============================================================================
// FilterTab Component
// ============================================================================

interface FilterTabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterTab({ label, active, onClick }: FilterTabProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-linear-accent text-white'
          : 'bg-linear-bg-secondary text-linear-text-secondary active:bg-linear-bg-tertiary'
      }`}
    >
      {label}
    </button>
  );
}

// ============================================================================
// PullIndicator Component
// ============================================================================

interface PullIndicatorProps {
  state: PullState;
  pullDistance: number;
  progress: number;
}

function PullIndicator({ state, pullDistance, progress }: PullIndicatorProps) {
  if (pullDistance === 0 && state === 'idle') return null;

  const isRefreshing = state === 'refreshing';
  const isReady = state === 'ready';

  return (
    <div
      className="absolute left-0 right-0 flex items-center justify-center overflow-hidden z-10"
      style={{ height: pullDistance, top: 0 }}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ${
          isReady || isRefreshing ? 'bg-linear-accent-muted' : 'bg-linear-bg-tertiary'
        }`}
        style={{
          opacity: Math.min(progress * 1.5, 1),
          transform: `scale(${0.5 + progress * 0.5})`,
        }}
      >
        <RefreshCw
          className={`w-5 h-5 transition-colors ${
            isRefreshing
              ? 'text-linear-accent animate-spin'
              : isReady
                ? 'text-linear-accent'
                : 'text-linear-text-tertiary'
          }`}
        />
      </div>
    </div>
  );
}
