'use client';

import { useState, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, MoreHorizontal, User, UserPlus, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCase, useTasksByCase, useCaseSummary } from '@/hooks/mobile';
import { InlineError } from '@/components/mobile';
import { TaskCardSkeleton, CaseCardSkeleton } from '@/components/mobile/skeletons';
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  FileText,
  Mail,
  StickyNote,
  ListTodo,
} from 'lucide-react';
import {
  ChapterAccordion,
  CaseHistorySearchBar,
  RawActivityFallback,
  type SearchResult,
} from '@/components/case/chapters';
import { useCaseChapters } from '@/hooks/useCaseChapters';

type TabId = 'sinteza' | 'taskuri' | 'documente' | 'note' | 'istoric';

const tabs: { id: TabId; label: string }[] = [
  { id: 'sinteza', label: 'Sinteza' },
  { id: 'taskuri', label: 'Taskuri' },
  { id: 'documente', label: 'Documente' },
  { id: 'note', label: 'Note' },
  { id: 'istoric', label: 'Istoric' },
];

// Format due date for display
function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return '';

  const date = new Date(dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (taskDate.getTime() === today.getTime()) {
    return 'Până astăzi';
  } else if (taskDate.getTime() === tomorrow.getTime()) {
    return 'Până mâine';
  } else if (taskDate < today) {
    return 'Întârziat';
  } else {
    // Format as "Până pe X lun"
    const day = date.getDate();
    const monthNames = [
      'ian',
      'feb',
      'mar',
      'apr',
      'mai',
      'iun',
      'iul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ];
    const month = monthNames[date.getMonth()];
    return `Până pe ${day} ${month}`;
  }
}

// Format completed date for display
function formatCompletedDate(completedAt: string | null): string {
  if (!completedAt) return '';

  const date = new Date(completedAt);
  const day = date.getDate();
  const monthNames = [
    'ian',
    'feb',
    'mar',
    'apr',
    'mai',
    'iun',
    'iul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ];
  const month = monthNames[date.getMonth()];
  return `Finalizat pe ${day} ${month}`;
}

// Check if task is urgent (due today or overdue)
function isTaskUrgent(dueDate: string | null): boolean {
  if (!dueDate) return false;

  const date = new Date(dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return taskDate <= today;
}

// Format relative time for "generatedAt"
function formatRelativeTime(date: string): string {
  const now = new Date();
  const generated = new Date(date);
  const diffMs = now.getTime() - generated.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'chiar acum';
  if (diffMins < 60) return `acum ${diffMins} min`;
  if (diffHours < 24) return `acum ${diffHours} ore`;
  if (diffDays === 1) return 'ieri';
  return `acum ${diffDays} zile`;
}

// Mobile-optimized AI Summary content component
function SintezaMobileContent({ caseId }: { caseId: string }) {
  const { summary, loading, generating, error, triggerGeneration } = useCaseSummary(caseId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 animate-fadeIn">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-mobile-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-[14px] text-mobile-text-tertiary">Se incarca sinteza...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 animate-fadeIn">
        <InlineError message={error.message} onRetry={() => triggerGeneration()} />
      </div>
    );
  }

  // No summary yet - offer to generate
  if (!summary) {
    return (
      <div className="py-12 animate-fadeIn">
        <div className="text-center px-4">
          <div className="w-12 h-12 rounded-full bg-mobile-accent/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-mobile-accent" />
          </div>
          <h3 className="text-[15px] font-medium text-mobile-text-primary mb-2">
            Sinteza nu este disponibila
          </h3>
          <p className="text-[14px] text-mobile-text-tertiary mb-6 max-w-xs mx-auto">
            Genereaza o sinteza AI a dosarului pentru a vedea ce s-a intamplat si care este starea
            curenta.
          </p>
          <button
            onClick={() => triggerGeneration()}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-mobile-accent text-white font-medium text-[14px] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Se genereaza...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Genereaza sinteza
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 pb-4 animate-fadeIn space-y-5">
      {/* Generation info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-mobile-accent" />
          <span className="text-[12px] text-mobile-text-tertiary">
            Generat {formatRelativeTime(summary.generatedAt)}
          </span>
          {summary.isStale && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-mobile-warning/10 text-mobile-warning">
              Invechit
            </span>
          )}
        </div>
        <button
          onClick={() => triggerGeneration()}
          disabled={generating}
          className="p-2 -mr-2 rounded-lg hover:bg-mobile-bg-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={cn('w-4 h-4 text-mobile-text-tertiary', generating && 'animate-spin')}
          />
        </button>
      </div>

      {/* Executive Summary */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-normal uppercase tracking-[0.1em] text-mobile-text-tertiary">
          Rezumat
        </h3>
        <p className="text-[15px] text-mobile-text-primary leading-relaxed">
          {summary.executiveSummary}
        </p>
      </div>

      {/* Current Status */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-normal uppercase tracking-[0.1em] text-mobile-text-tertiary">
          Stare curenta
        </h3>
        <p className="text-[15px] text-mobile-text-secondary leading-relaxed">
          {summary.currentStatus}
        </p>
      </div>

      {/* Key Developments */}
      {summary.keyDevelopments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-normal uppercase tracking-[0.1em] text-mobile-text-tertiary">
            Evenimente cheie
          </h3>
          <ul className="space-y-2">
            {summary.keyDevelopments.map((development, index) => (
              <li key={index} className="flex gap-2 text-[14px] text-mobile-text-secondary">
                <span className="text-mobile-accent mt-1">•</span>
                <span>{development}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Open Issues */}
      {summary.openIssues.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-normal uppercase tracking-[0.1em] text-mobile-text-tertiary flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-mobile-warning" />
            Probleme deschise
          </h3>
          <ul className="space-y-2">
            {summary.openIssues.map((issue, index) => (
              <li key={index} className="flex gap-2 text-[14px] text-mobile-text-secondary">
                <span className="text-mobile-warning mt-1">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Data stats */}
      <div className="pt-3 border-t border-mobile-border-subtle">
        <div className="flex items-center gap-4 text-[12px] text-mobile-text-tertiary">
          <div className="flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            <span>{summary.emailCount} emailuri</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            <span>{summary.documentCount} documente</span>
          </div>
          <div className="flex items-center gap-1">
            <StickyNote className="w-3.5 h-3.5" />
            <span>{summary.noteCount} notite</span>
          </div>
          <div className="flex items-center gap-1">
            <ListTodo className="w-3.5 h-3.5" />
            <span>{summary.taskCount} taskuri</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mobile-optimized history content component
function IstoricMobileContent({ caseId }: { caseId: string }) {
  const { chapters, loading, error, hasChapters } = useCaseChapters(caseId);
  const accordionRef = useRef<HTMLDivElement>(null);

  const handleSearchResultClick = useCallback((result: SearchResult) => {
    const accordionItem = accordionRef.current?.querySelector(
      `[data-chapter-id="${result.chapterId}"]`
    );
    if (accordionItem) {
      const trigger = accordionItem.querySelector('[data-state="closed"]');
      if (trigger) {
        (trigger as HTMLElement).click();
      }
      setTimeout(() => {
        const eventElement = accordionRef.current?.querySelector(
          `[data-event-id="${result.eventId}"]`
        );
        eventElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 animate-fadeIn">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-mobile-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-[14px] text-mobile-text-tertiary">Se incarca...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 animate-fadeIn">
        <InlineError message={error.message} onRetry={() => {}} />
      </div>
    );
  }

  return (
    <div className="pt-4 animate-fadeIn" ref={accordionRef}>
      <CaseHistorySearchBar
        caseId={caseId}
        onResultClick={handleSearchResultClick}
        className="mb-4"
      />

      {hasChapters && chapters.length > 0 ? (
        <ChapterAccordion chapters={chapters} defaultExpandedId={chapters[0]?.id} />
      ) : (
        <RawActivityFallback activities={[]} loading={false} />
      )}
    </div>
  );
}

export default function CaseDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const id = params.id;

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('sinteza');

  // Fetch case data
  const { caseData, loading: caseLoading, error: caseError, refetch: refetchCase } = useCase(id);

  // Fetch tasks for this case
  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useTasksByCase(id);

  // Filter tasks into open and completed
  const openTasks = tasks.filter((t) => t.status !== 'Completed');
  const completedTasks = tasks.filter((t) => t.status === 'Completed');

  // Get responsible person from team members
  const responsible = caseData?.teamMembers?.find((m) => m.role === 'Lead')?.user;
  const responsibleName = responsible
    ? `${responsible.firstName} ${responsible.lastName}`
    : 'Nealocat';

  // Combined loading state
  const isLoading = caseLoading || tasksLoading;

  // Combined error handling
  const hasError = caseError || tasksError;
  const errorMessage = caseError?.message || tasksError?.message || 'A apărut o eroare';

  const handleRefetch = async () => {
    await Promise.all([refetchCase(), refetchTasks()]);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="animate-fadeIn min-h-screen">
        {/* Header skeleton */}
        <header className="flex items-center gap-3 px-6 pt-12 pb-4 border-b border-mobile-border-subtle">
          <div className="w-8 h-8 -ml-2 flex items-center justify-center">
            <div className="w-5 h-5 bg-mobile-border rounded animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="h-5 bg-mobile-border rounded w-3/4 animate-pulse" />
          </div>
          <div className="w-8 h-8 flex items-center justify-center">
            <div className="w-5 h-5 bg-mobile-border rounded animate-pulse" />
          </div>
        </header>

        {/* Case Info Section skeleton */}
        <div className="px-6 py-6 border-b border-mobile-border-subtle">
          <CaseCardSkeleton />
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-1 px-6 py-3 border-b border-mobile-border-subtle">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-20 bg-mobile-border rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Content skeleton */}
        <div className="px-6 pt-6 pb-32 space-y-4">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      </div>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <div className="animate-fadeIn min-h-screen">
        {/* Header with back button */}
        <header className="flex items-center gap-3 px-6 pt-12 pb-4 border-b border-mobile-border-subtle">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 -ml-2 flex items-center justify-center text-mobile-text-secondary rounded-lg hover:bg-mobile-bg-hover transition-colors"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <h1 className="flex-1 text-[17px] font-medium tracking-[-0.02em]">Detalii dosar</h1>
        </header>

        <div className="px-6 py-8">
          <InlineError message={errorMessage} onRetry={handleRefetch} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn min-h-screen">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 pt-12 pb-4 border-b border-mobile-border-subtle">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 -ml-2 flex items-center justify-center text-mobile-text-secondary rounded-lg hover:bg-mobile-bg-hover transition-colors"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2} />
        </button>
        <h1 className="flex-1 text-[17px] font-medium tracking-[-0.02em] truncate">
          {caseData?.title || 'Dosar'}
        </h1>
        <button className="w-8 h-8 flex items-center justify-center text-mobile-text-secondary rounded-lg hover:bg-mobile-bg-hover transition-colors">
          <MoreHorizontal className="w-5 h-5" strokeWidth={2} />
        </button>
      </header>

      {/* Case Info Section */}
      <div className="px-6 py-6 border-b border-mobile-border-subtle">
        <p className="text-[13px] text-mobile-text-secondary mb-2">{caseData?.type || ''}</p>
        <div className="flex items-center gap-2 text-[14px] text-mobile-text-secondary mt-2">
          <User className="w-4 h-4 text-mobile-text-tertiary" strokeWidth={2} />
          <span>Client: {caseData?.client?.name || 'Necunoscut'}</span>
        </div>
        <div className="flex items-center gap-2 text-[14px] text-mobile-text-secondary mt-2">
          <UserPlus className="w-4 h-4 text-mobile-text-tertiary" strokeWidth={2} />
          <span>Responsabil: {responsibleName}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 py-3 border-b border-mobile-border-subtle overflow-x-auto">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'px-4 py-2 rounded-lg text-[14px] font-normal whitespace-nowrap',
              'transition-all duration-150',
              activeTab === id
                ? 'bg-mobile-bg-elevated text-mobile-text-primary'
                : 'text-mobile-text-tertiary hover:bg-mobile-bg-hover'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-6 pb-32">
        {activeTab === 'sinteza' && <SintezaMobileContent caseId={id} />}

        {activeTab === 'taskuri' && (
          <div className="animate-fadeIn pt-6">
            {/* Open Tasks */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-normal uppercase tracking-[0.1em] text-mobile-text-tertiary">
                  Taskuri deschise
                </span>
                <span className="text-[12px] font-medium text-mobile-text-tertiary bg-mobile-bg-elevated px-2 py-0.5 rounded-[10px]">
                  {openTasks.length}
                </span>
              </div>
              <div>
                {openTasks.length === 0 ? (
                  <p className="text-[14px] text-mobile-text-tertiary py-4">
                    Nu există taskuri deschise
                  </p>
                ) : (
                  openTasks.map((task, index) => (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-start gap-3 py-4 -mx-6 px-6 cursor-pointer hover:bg-mobile-bg-elevated transition-colors',
                        index !== openTasks.length - 1 && 'border-b border-mobile-border-subtle'
                      )}
                    >
                      <div className="w-5 h-5 rounded-full border-2 border-mobile-border flex-shrink-0 mt-0.5 hover:border-mobile-text-secondary transition-colors" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-normal text-mobile-text-primary tracking-[-0.01em] mb-1">
                          {task.title}
                        </p>
                        <p
                          className={cn(
                            'text-[13px]',
                            isTaskUrgent(task.dueDate)
                              ? 'text-mobile-warning'
                              : 'text-mobile-text-secondary'
                          )}
                        >
                          {formatDueDate(task.dueDate)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Add Task Button */}
              <button
                onClick={() => router.push(`/m/tasks/new?caseId=${id}`)}
                className="flex items-center gap-2 py-3 text-mobile-text-secondary hover:text-mobile-text-primary transition-colors"
              >
                <Plus className="w-4 h-4" strokeWidth={2} />
                <span className="text-[14px]">Adaugă task</span>
              </button>
            </section>

            {/* Completed Tasks */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-normal uppercase tracking-[0.1em] text-mobile-text-tertiary">
                  Finalizate
                </span>
                <span className="text-[12px] font-medium text-mobile-text-tertiary bg-mobile-bg-elevated px-2 py-0.5 rounded-[10px]">
                  {completedTasks.length}
                </span>
              </div>
              <div>
                {completedTasks.length === 0 ? (
                  <p className="text-[14px] text-mobile-text-tertiary py-4">
                    Nu există taskuri finalizate
                  </p>
                ) : (
                  completedTasks.map((task, index) => (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-start gap-3 py-4 -mx-6 px-6 cursor-pointer hover:bg-mobile-bg-elevated transition-colors',
                        index !== completedTasks.length - 1 &&
                          'border-b border-mobile-border-subtle'
                      )}
                    >
                      <div className="w-5 h-5 rounded-full bg-mobile-success border-2 border-mobile-success flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-normal text-mobile-text-tertiary line-through tracking-[-0.01em] mb-1">
                          {task.title}
                        </p>
                        <p className="text-[13px] text-mobile-text-secondary">
                          {formatCompletedDate(task.completedAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'documente' && (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-fadeIn">
            <p className="text-[15px] text-mobile-text-tertiary">Documentele vor apărea aici</p>
          </div>
        )}

        {activeTab === 'note' && (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-fadeIn">
            <p className="text-[15px] text-mobile-text-tertiary">Notele vor apărea aici</p>
          </div>
        )}

        {activeTab === 'istoric' && <IstoricMobileContent caseId={id} />}
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-mobile-bg-primary border-t border-mobile-border px-6 py-4 pb-8 z-50">
        <button className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] bg-white text-black font-normal text-[15px] hover:opacity-90 transition-opacity">
          <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
          Task nou
        </button>
      </div>
    </div>
  );
}
