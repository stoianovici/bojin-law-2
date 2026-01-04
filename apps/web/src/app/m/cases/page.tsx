'use client';

import Link from 'next/link';
import { Search, Folder, ChevronRight, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCases } from '@/hooks/mobile';
import { InlineError } from '@/components/mobile';
import { CaseCardSkeleton } from '@/components/mobile/skeletons';

function CaseItem({
  id,
  title,
  type,
  taskCount,
}: {
  id: string;
  title: string;
  type: string;
  taskCount: number;
}) {
  return (
    <Link
      href={`/m/cases/${id}`}
      className={cn(
        'flex items-center gap-3 py-4 -mx-6 px-6',
        'border-b border-mobile-border-subtle last:border-b-0',
        'transition-colors hover:bg-mobile-bg-elevated'
      )}
    >
      {/* Icon box - 40x40, rounded-10, bg-card with border */}
      <div className="w-10 h-10 rounded-[10px] bg-mobile-bg-card border border-mobile-border flex items-center justify-center flex-shrink-0">
        <Folder className="w-5 h-5 text-mobile-text-secondary" strokeWidth={2} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-normal tracking-[-0.01em] mb-0.5">{title}</p>
        <p className="text-[13px] text-mobile-text-secondary flex items-center gap-2">
          <span>{type}</span>
          <span className="w-[3px] h-[3px] rounded-full bg-mobile-text-tertiary" />
          <span>
            {taskCount} {taskCount === 1 ? 'task' : 'taskuri'}
          </span>
        </p>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-mobile-text-tertiary flex-shrink-0" />
    </Link>
  );
}

export default function MobileCasesPage() {
  const { cases, loading, error, refetch } = useCases();

  return (
    <div className="animate-fadeIn">
      {/* Header - pt-12 for safe area */}
      <header className="flex items-center justify-between px-6 pt-12 pb-4">
        <h1 className="text-[22px] font-medium tracking-[-0.02em]">Dosare</h1>
        <button className="w-8 h-8 flex items-center justify-center text-mobile-text-secondary">
          <Menu className="w-5 h-5" strokeWidth={2} />
        </button>
      </header>

      {/* Search bar - links to /m/search */}
      <div className="px-6 pb-6">
        <Link
          href="/m/search"
          className={cn(
            'flex items-center gap-3 w-full',
            'bg-mobile-bg-elevated border border-mobile-border rounded-[12px]',
            'py-3 px-4'
          )}
        >
          <Search className="w-[18px] h-[18px] text-mobile-text-tertiary" strokeWidth={2} />
          <span className="text-[15px] text-mobile-text-tertiary">Cauta dosare...</span>
        </Link>
      </div>

      {/* Content */}
      <main className="px-6 pb-24">
        {/* All cases section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-normal uppercase tracking-[0.1em] text-mobile-text-tertiary">
              Toate dosarele
            </span>
            {!loading && !error && (
              <span className="text-[12px] font-medium text-mobile-text-tertiary bg-mobile-bg-elevated px-2 py-0.5 rounded-[10px]">
                {cases.length}
              </span>
            )}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <CaseCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error state */}
          {error && <InlineError message="Nu s-au putut încărca dosarele" onRetry={refetch} />}

          {/* Cases list */}
          {!loading && !error && (
            <div>
              {cases.map((caseItem) => (
                <CaseItem
                  key={caseItem.id}
                  id={caseItem.id}
                  title={caseItem.title}
                  type={caseItem.type}
                  taskCount={0}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
