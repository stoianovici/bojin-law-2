/**
 * MobileCommunications Component
 * OPS-328: Mobile Page Consistency
 *
 * Mobile-optimized email/communications view with:
 * - Case list as entry point (tap to see emails)
 * - Full-screen thread list when case selected
 * - Touch-friendly email items
 * - Back navigation between views
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Inbox,
  Paperclip,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ro } from 'date-fns/locale';
import { MobileDrawer } from './MobileDrawer';
import { MobileHeader } from './MobileHeader';
import {
  useMyEmailsByCase,
  type CaseWithThreads,
  type ThreadPreview,
} from '../../hooks/useMyEmailsByCase';
import { useSetAIContext } from '../../contexts/AIAssistantContext';
import { usePullToRefresh, type PullState } from '../../hooks/usePullToRefresh';

// Format date for display
function formatEmailDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) {
    return format(date, 'HH:mm');
  }
  if (isYesterday(date)) {
    return 'Ieri';
  }
  return format(date, 'd MMM', { locale: ro });
}

export function MobileCommunications() {
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseWithThreads | null>(null);

  // Set AI assistant context
  useSetAIContext('communications');

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const handleBack = useCallback(() => {
    setSelectedCase(null);
  }, []);

  const handleCaseSelect = useCallback((caseItem: CaseWithThreads) => {
    setSelectedCase(caseItem);
  }, []);

  // Render case selected view
  if (selectedCase) {
    return (
      <ThreadsListView
        caseItem={selectedCase}
        onBack={handleBack}
        onMenuClick={openDrawer}
        isDrawerOpen={isDrawerOpen}
        onCloseDrawer={closeDrawer}
      />
    );
  }

  // Render case selection view
  return (
    <CaseSelectionView
      onCaseSelect={handleCaseSelect}
      onMenuClick={openDrawer}
      isDrawerOpen={isDrawerOpen}
      onCloseDrawer={closeDrawer}
    />
  );
}

// ============================================================================
// CaseSelectionView - Select a case to view emails
// ============================================================================

interface CaseSelectionViewProps {
  onCaseSelect: (caseItem: CaseWithThreads) => void;
  onMenuClick: () => void;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
}

function CaseSelectionView({
  onCaseSelect,
  onMenuClick,
  isDrawerOpen,
  onCloseDrawer,
}: CaseSelectionViewProps) {
  const { data, loading, error, refetch } = useMyEmailsByCase();

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

  // Combine cases with unassigned
  const allCases = [...data.cases];
  if (data.unassignedCase) {
    allCases.push(data.unassignedCase);
  }

  // Calculate totals
  const totalUnread = allCases.reduce((sum, c) => sum + c.unreadCount, 0);
  const totalThreads = allCases.reduce((sum, c) => sum + c.totalThreads, 0);

  // Error state
  if (error && allCases.length === 0) {
    return (
      <div className="min-h-screen bg-linear-bg-primary flex flex-col">
        <MobileHeader title="Mesaje" onMenuClick={onMenuClick} />
        <MobileDrawer isOpen={isDrawerOpen} onClose={onCloseDrawer} />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-12 h-12 text-linear-error mb-4" />
          <p className="text-linear-text-secondary text-center mb-4">
            Nu am putut încărca mesajele
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
      <MobileHeader title="Mesaje" onMenuClick={onMenuClick} />
      <MobileDrawer isOpen={isDrawerOpen} onClose={onCloseDrawer} />

      {/* Summary Bar */}
      <div className="px-4 py-3 border-b border-linear-border-subtle flex items-center justify-between">
        <p className="text-sm text-linear-text-secondary">
          {totalThreads} conversații în {data.cases.length} dosare
        </p>
        {totalUnread > 0 && (
          <span className="px-2 py-0.5 bg-linear-accent/20 text-linear-accent text-xs font-medium rounded-full">
            {totalUnread} necitite
          </span>
        )}
      </div>

      {/* Cases List */}
      <main className="flex-1 overflow-hidden">
        <div ref={containerRef} className="h-full overflow-y-auto" {...containerProps}>
          {/* Pull-to-refresh indicator */}
          <PullIndicator state={pullState} pullDistance={pullDistance} progress={progress} />

          <div
            className="transition-transform duration-200"
            style={{
              transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
            }}
          >
            {/* Loading State */}
            {loading && allCases.length === 0 && (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <CaseEmailRowSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && allCases.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 bg-linear-bg-tertiary rounded-full flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 text-linear-text-muted" />
                </div>
                <p className="text-linear-text-secondary text-center font-medium">Niciun mesaj</p>
                <p className="text-sm text-linear-text-muted text-center mt-1">
                  Mesajele sincronizate vor apărea aici
                </p>
              </div>
            )}

            {/* Uncertain Emails Section */}
            {data.uncertainCount > 0 && (
              <div className="p-4">
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-linear-text-primary">Neclar</p>
                    <p className="text-xs text-linear-text-secondary">
                      {data.uncertainCount} mesaje necesită atenție
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 text-xs font-medium rounded-full">
                    {data.uncertainCount}
                  </span>
                </div>
              </div>
            )}

            {/* Cases List */}
            {allCases.length > 0 && (
              <div className="p-4 space-y-2">
                {/* Section Header */}
                <div className="px-1 py-2">
                  <span className="text-xs font-semibold text-linear-text-muted uppercase tracking-wider">
                    Dosare
                  </span>
                </div>

                {allCases.map((caseItem) => (
                  <CaseEmailRow
                    key={caseItem.id}
                    caseItem={caseItem}
                    onTap={() => onCaseSelect(caseItem)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// ThreadsListView - Show email threads for selected case
// ============================================================================

interface ThreadsListViewProps {
  caseItem: CaseWithThreads;
  onBack: () => void;
  onMenuClick: () => void;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
}

function ThreadsListView({
  caseItem,
  onBack,
  onMenuClick,
  isDrawerOpen,
  onCloseDrawer,
}: ThreadsListViewProps) {
  const router = useRouter();

  const handleThreadTap = useCallback(
    (thread: ThreadPreview) => {
      // Navigate to case communications tab with thread selected
      if (caseItem.id !== 'unassigned') {
        router.push(`/cases/${caseItem.id}?tab=communications&threadId=${thread.conversationId}`);
      }
    },
    [router, caseItem.id]
  );

  return (
    <div className="min-h-screen bg-linear-bg-primary flex flex-col">
      <MobileHeader
        title="Mesaje"
        onMenuClick={onMenuClick}
        leftAction={
          <button onClick={onBack} className="p-2 -ml-2 active:scale-95 transition-transform">
            <ChevronLeft className="w-5 h-5 text-linear-text-secondary" />
          </button>
        }
      />
      <MobileDrawer isOpen={isDrawerOpen} onClose={onCloseDrawer} />

      {/* Case Info */}
      <div className="px-4 py-3 border-b border-linear-border-subtle">
        <p className="text-sm font-medium text-linear-text-primary truncate">{caseItem.title}</p>
        {caseItem.caseNumber && (
          <p className="text-xs text-linear-text-muted mt-0.5">{caseItem.caseNumber}</p>
        )}
      </div>

      {/* Threads List */}
      <main className="flex-1 overflow-y-auto">
        {/* Empty State */}
        {caseItem.threads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 bg-linear-bg-tertiary rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-linear-text-muted" />
            </div>
            <p className="text-linear-text-secondary text-center font-medium">Nicio conversație</p>
            <p className="text-sm text-linear-text-muted text-center mt-1">
              Nu există mesaje în acest dosar
            </p>
          </div>
        )}

        {/* Threads List */}
        {caseItem.threads.length > 0 && (
          <div className="divide-y divide-linear-border-subtle">
            {caseItem.threads.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} onTap={() => handleThreadTap(thread)} />
            ))}
          </div>
        )}

        {/* Results count */}
        {caseItem.threads.length > 0 && (
          <div className="text-center py-4 text-sm text-linear-text-muted">
            {caseItem.threads.length}{' '}
            {caseItem.threads.length === 1 ? 'conversație' : 'conversații'}
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// CaseEmailRow Component
// ============================================================================

interface CaseEmailRowProps {
  caseItem: CaseWithThreads;
  onTap: () => void;
}

function CaseEmailRow({ caseItem, onTap }: CaseEmailRowProps) {
  // Get latest thread for preview
  const latestThread = caseItem.threads[0];

  return (
    <button
      onClick={onTap}
      className="w-full text-left p-3 bg-linear-bg-secondary border border-linear-border-subtle rounded-xl flex items-center gap-3 active:scale-[0.98] active:bg-linear-bg-tertiary transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-linear-accent/10 flex items-center justify-center relative">
        <Mail className="w-5 h-5 text-linear-accent" />
        {caseItem.unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-linear-accent rounded-full flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{caseItem.unreadCount}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm truncate ${caseItem.unreadCount > 0 ? 'font-semibold text-linear-text-primary' : 'font-medium text-linear-text-primary'}`}
        >
          {caseItem.id === 'unassigned' ? 'Neatribuit' : caseItem.title}
        </p>
        {latestThread && (
          <p className="text-xs text-linear-text-secondary truncate mt-0.5">
            {latestThread.subject}
          </p>
        )}
        <p className="text-xs text-linear-text-muted mt-0.5">
          {caseItem.totalThreads} {caseItem.totalThreads === 1 ? 'conversație' : 'conversații'}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-linear-text-muted flex-shrink-0" />
    </button>
  );
}

// ============================================================================
// ThreadRow Component
// ============================================================================

interface ThreadRowProps {
  thread: ThreadPreview;
  onTap: () => void;
}

function ThreadRow({ thread, onTap }: ThreadRowProps) {
  const senderName = thread.latestFrom?.name || thread.latestFrom?.address || 'Necunoscut';
  const dateDisplay = formatEmailDate(thread.lastMessageDate);

  return (
    <button
      onClick={onTap}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 active:bg-linear-bg-tertiary transition-colors ${
        thread.hasUnread ? 'bg-linear-bg-secondary/50' : ''
      }`}
    >
      {/* Unread indicator */}
      <div className="pt-1.5">
        {thread.hasUnread ? (
          <div className="w-2 h-2 rounded-full bg-linear-accent" />
        ) : (
          <div className="w-2 h-2" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Sender and Date */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p
            className={`text-sm truncate ${thread.hasUnread ? 'font-semibold text-linear-text-primary' : 'text-linear-text-primary'}`}
          >
            {senderName}
          </p>
          <span className="text-xs text-linear-text-muted flex-shrink-0">{dateDisplay}</span>
        </div>

        {/* Subject */}
        <p
          className={`text-sm truncate ${thread.hasUnread ? 'font-medium text-linear-text-primary' : 'text-linear-text-secondary'}`}
        >
          {thread.subject}
        </p>

        {/* Meta info */}
        <div className="flex items-center gap-2 mt-1 text-xs text-linear-text-muted">
          {thread.messageCount > 1 && <span>{thread.messageCount} mesaje</span>}
          {thread.hasAttachments && <Paperclip className="w-3 h-3" />}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-linear-text-muted mt-1 flex-shrink-0" />
    </button>
  );
}

// ============================================================================
// Skeleton Components
// ============================================================================

function CaseEmailRowSkeleton() {
  return (
    <div className="p-3 bg-linear-bg-secondary border border-linear-border-subtle rounded-xl flex items-center gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-linear-bg-tertiary" />
      <div className="flex-1">
        <div className="h-4 w-3/4 bg-linear-bg-tertiary rounded mb-1" />
        <div className="h-3 w-1/2 bg-linear-bg-tertiary rounded" />
      </div>
    </div>
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
