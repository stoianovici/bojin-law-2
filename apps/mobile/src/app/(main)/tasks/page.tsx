'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  Plus,
  Check,
  Clock,
  AlertCircle,
  ChevronRight,
  Circle,
  CheckCircle2,
  ListTodo,
  FolderOpen,
} from 'lucide-react';
import { LargeHeader } from '@/components/layout';
import {
  Card,
  Badge,
  SkeletonList,
  EmptyList,
  Button,
  PullToRefresh,
  ListItemTransition,
} from '@/components/ui';
import { useTasks, type Task, type TaskStatus } from '@/hooks/useTasks';
import { clsx } from 'clsx';

// ============================================
// View Modes
// ============================================

type ViewMode = 'list' | 'byCase';

// ============================================
// Page Component
// ============================================

export default function TasksPage() {
  const router = useRouter();
  const {
    tasks,
    tasksByCase,
    loading,
    filterMode,
    setFilterMode,
    toggleTask,
    updating,
    stats,
    refetch,
  } = useTasks();

  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <LargeHeader
        title="Sarcini"
        subtitle={`${stats.pending} de făcut${stats.overdue > 0 ? ` · ${stats.overdue} întârziate` : ''}`}
        action={
          <Link href="/tasks/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Nouă
            </Button>
          </Link>
        }
      />

      {/* Stats Cards */}
      <div className="px-6 py-3 grid grid-cols-3 gap-2">
        <StatsCard
          label="De făcut"
          value={stats.pending}
          active={filterMode === 'pending'}
          onClick={() => setFilterMode('pending')}
        />
        <StatsCard
          label="Finalizate"
          value={stats.completed}
          active={filterMode === 'completed'}
          onClick={() => setFilterMode('completed')}
        />
        <StatsCard
          label="Urgente"
          value={stats.urgent}
          variant="warning"
          active={false}
          onClick={() => {}}
        />
      </div>

      {/* View Toggle */}
      <div className="px-6 py-2">
        <div className="flex gap-1 bg-bg-elevated rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
              viewMode === 'list' ? 'bg-bg-card text-text-primary' : 'text-text-tertiary'
            )}
          >
            <ListTodo className="w-4 h-4" />
            Listă
          </button>
          <button
            onClick={() => setViewMode('byCase')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
              viewMode === 'byCase' ? 'bg-bg-card text-text-primary' : 'text-text-tertiary'
            )}
          >
            <FolderOpen className="w-4 h-4" />
            Pe dosare
          </button>
        </div>
      </div>

      {/* Tasks List */}
      <PullToRefresh onRefresh={handleRefresh} disabled={loading} className="px-6 py-2">
        {loading ? (
          <SkeletonList count={5} />
        ) : tasks.length === 0 ? (
          <EmptyList itemName="sarcină" onAdd={() => router.push('/tasks/new')} />
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            {tasks.map((task, index) => (
              <ListItemTransition key={task.id} index={index}>
                <TaskCard
                  task={task}
                  onToggle={() => toggleTask(task.id, task.status)}
                  updating={updating}
                />
              </ListItemTransition>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {tasksByCase.map((group, groupIndex) => (
              <ListItemTransition key={group.caseId} index={groupIndex}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-text-primary">{group.caseName}</span>
                  <span className="text-xs text-text-tertiary">{group.tasks.length}</span>
                </div>
                <div className="space-y-2">
                  {group.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => toggleTask(task.id, task.status)}
                      updating={updating}
                      hideCase
                    />
                  ))}
                </div>
              </ListItemTransition>
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

// ============================================
// Stats Card
// ============================================

interface StatsCardProps {
  label: string;
  value: number;
  variant?: 'default' | 'warning';
  active: boolean;
  onClick: () => void;
}

function StatsCard({ label, value, variant = 'default', active, onClick }: StatsCardProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'p-3 rounded-xl text-left transition-colors',
        active ? 'bg-accent-muted' : 'bg-bg-card',
        active && 'ring-1 ring-accent'
      )}
    >
      <p
        className={clsx(
          'text-2xl font-bold',
          variant === 'warning' && value > 0 ? 'text-warning' : 'text-text-primary'
        )}
      >
        {value}
      </p>
      <p className="text-xs text-text-tertiary">{label}</p>
    </button>
  );
}

// ============================================
// Task Card
// ============================================

interface TaskCardProps {
  task: Task;
  onToggle: () => void;
  updating: boolean;
  hideCase?: boolean;
}

function TaskCard({ task, onToggle, updating, hideCase }: TaskCardProps) {
  const isCompleted = task.status === 'Completed';
  const isOverdue = task.dueDate && !isCompleted && new Date(task.dueDate) < new Date();

  const priorityColors: Record<string, string> = {
    Urgent: 'bg-error',
    High: 'bg-warning',
    Normal: 'bg-accent',
    Low: 'bg-text-tertiary',
  };

  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.preventDefault();
            if (!updating) onToggle();
          }}
          className={clsx(
            'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors',
            isCompleted ? 'bg-success border-success' : 'border-text-tertiary hover:border-accent'
          )}
          disabled={updating}
        >
          {isCompleted && <Check className="w-3.5 h-3.5 text-bg-primary" />}
        </button>

        <Link href={`/tasks/${task.id}`} className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {/* Priority dot */}
            <div
              className={clsx(
                'w-2 h-2 rounded-full mt-1.5 shrink-0',
                priorityColors[task.priority] || 'bg-text-tertiary'
              )}
            />

            <div className="flex-1 min-w-0">
              {/* Title */}
              <p
                className={clsx(
                  'text-sm',
                  isCompleted ? 'text-text-tertiary line-through' : 'text-text-primary'
                )}
              >
                {task.title}
              </p>

              {/* Meta */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* Due date */}
                {task.dueDate && (
                  <span
                    className={clsx(
                      'text-xs flex items-center gap-1',
                      isOverdue ? 'text-error' : 'text-text-tertiary'
                    )}
                  >
                    {isOverdue ? (
                      <AlertCircle className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    {format(new Date(task.dueDate), 'd MMM', { locale: ro })}
                    {task.dueTime && ` ${task.dueTime.slice(0, 5)}`}
                  </span>
                )}

                {/* Case */}
                {!hideCase && task.case && (
                  <span className="text-xs text-text-tertiary">{task.case.caseNumber}</span>
                )}

                {/* Assignee */}
                {task.assignee && (
                  <span className="text-xs text-text-tertiary">{task.assignee.firstName}</span>
                )}
              </div>
            </div>
          </div>
        </Link>

        <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0 mt-1" />
      </div>
    </Card>
  );
}
