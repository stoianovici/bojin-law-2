'use client';

import Link from 'next/link';
import { Menu, Folder, ChevronDown, Zap, Mail, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMyTasks } from '@/hooks/mobile';
import { useAuth } from '@/hooks/useAuth';
import { InlineError } from '@/components/mobile';
import { TaskCardSkeleton } from '@/components/mobile/skeletons';

// Mock data for attention items (no backend query yet)
const attentionItems = [
  { id: '1', type: 'urgent', title: 'Întârziat: Contract Popescu', meta: 'Termen depășit cu 1 zi' },
  { id: '2', type: 'email', title: 'Client în așteptare: Ion M.', meta: 'Fără răspuns de 3 zile' },
];

// Helper function to format due date/time
function formatDueDate(dueDate: string | null, dueTime: string | null): string {
  if (!dueDate) return 'Fără termen';

  if (dueTime) {
    return `Până la ${dueTime}`;
  }

  // Format date nicely
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(date);
  taskDate.setHours(0, 0, 0, 0);

  if (taskDate.getTime() === today.getTime()) {
    return 'Astăzi';
  }

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (taskDate.getTime() === tomorrow.getTime()) {
    return 'Mâine';
  }

  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

export default function MobileHomePage() {
  const { user } = useAuth();
  const { tasks, loading, error, refetch } = useMyTasks();

  // Get first name from user
  const firstName = user?.name?.split(' ')[0] || 'User';

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-12 pb-4 sticky top-0 z-10 bg-mobile-bg-primary">
        <div className="text-[18px] font-medium tracking-[-0.02em]">Bojin Law</div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-[13px] font-medium">
            AP
          </div>
          <button className="w-8 h-8 flex items-center justify-center text-mobile-text-secondary rounded-lg hover:bg-mobile-bg-hover transition-colors">
            <Menu className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 pb-24">
        {/* Greeting */}
        <div className="pt-4 pb-8">
          <h1 className="text-[26px] font-medium tracking-[-0.03em] mb-1">
            Bună dimineața, {firstName}
          </h1>
          <p className="text-[15px] text-mobile-text-secondary">
            <span className="text-mobile-warning font-medium">
              {attentionItems.length} elemente
            </span>{' '}
            necesită atenție
          </p>
          <button className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-mobile-bg-elevated border border-mobile-border text-[13px] text-mobile-text-secondary hover:bg-mobile-bg-hover transition-colors">
            <Folder className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Toate dosarele</span>
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        {/* Attention Section */}
        <section className="mb-8">
          <div className="mb-4">
            <span className="text-[11px] font-normal uppercase tracking-[0.1em] text-mobile-text-tertiary">
              Atenție
            </span>
          </div>
          <div className="space-y-3">
            {attentionItems.map((item) => (
              <Link
                key={item.id}
                href="/m/cases"
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl',
                  'bg-mobile-bg-card border border-mobile-border',
                  'hover:bg-mobile-bg-hover transition-colors',
                  item.type === 'urgent' && 'border-l-[3px] border-l-mobile-warning'
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0',
                    item.type === 'urgent' ? 'bg-mobile-warning-subtle' : 'bg-mobile-accent-subtle'
                  )}
                >
                  {item.type === 'urgent' ? (
                    <Zap className="w-4 h-4 text-mobile-warning" strokeWidth={2} />
                  ) : (
                    <Mail className="w-4 h-4 text-mobile-accent" strokeWidth={2} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-normal tracking-[-0.01em] mb-0.5">{item.title}</p>
                  <p className="text-[13px] text-mobile-text-secondary">{item.meta}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Tasks Today Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-normal uppercase tracking-[0.1em] text-mobile-text-tertiary">
              Taskuri azi
            </span>
            {!loading && !error && (
              <span className="text-[12px] font-medium text-mobile-text-tertiary bg-mobile-bg-elevated px-2 py-0.5 rounded-[10px]">
                {tasks.length}
              </span>
            )}
          </div>
          <div>
            {loading && (
              <div className="space-y-3">
                <TaskCardSkeleton />
                <TaskCardSkeleton />
                <TaskCardSkeleton />
              </div>
            )}

            {error && <InlineError message="Nu s-au putut încărca taskurile" onRetry={refetch} />}

            {!loading &&
              !error &&
              tasks.map((task) => {
                const isCompleted = task.status === 'Completed';
                const isUrgent = task.priority === 'High';
                const dueDisplay = isCompleted
                  ? 'Finalizat'
                  : formatDueDate(task.dueDate, task.dueTime);

                return (
                  <Link
                    key={task.id}
                    href={task.case ? `/m/cases/${task.case.id}` : '/m/cases'}
                    className={cn(
                      'flex items-start gap-3 py-4 -mx-6 px-6',
                      'border-b border-mobile-border-subtle last:border-b-0',
                      'transition-colors hover:bg-mobile-bg-elevated'
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors',
                        isCompleted
                          ? 'bg-mobile-success border-mobile-success'
                          : 'border-mobile-border hover:border-mobile-text-secondary'
                      )}
                    >
                      {isCompleted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-[15px] font-normal tracking-[-0.01em] mb-1',
                          isCompleted && 'line-through text-mobile-text-tertiary'
                        )}
                      >
                        {task.title}
                      </p>
                      <p className="text-[13px] text-mobile-text-secondary flex items-center gap-2">
                        <span>{task.case?.title || 'Fără dosar'}</span>
                        <span className="w-[3px] h-[3px] rounded-full bg-mobile-text-tertiary" />
                        <span className={cn(isUrgent && !isCompleted && 'text-mobile-warning')}>
                          {dueDisplay}
                        </span>
                      </p>
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      </main>
    </div>
  );
}
