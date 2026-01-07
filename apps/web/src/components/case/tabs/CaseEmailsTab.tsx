'use client';

import { useState, useCallback, useMemo, Fragment } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import {
  CaseEmailFilter,
  ThreadItem,
  EmailConversationView,
  type CaseEmailFilterMode,
} from '@/components/email';
import { useEmailsByContact } from '@/hooks/useEmailsByContact';
import { useEmailSync } from '@/hooks/useEmailSync';
import type { ThreadPreview, EmailThread } from '@/types/email';

// ============================================================================
// Types
// ============================================================================

interface CaseEmailsTabProps {
  caseId: string;
  caseName?: string;
  userEmail?: string;
  className?: string;
}

// ============================================================================
// Component Implementation
// ============================================================================

export function CaseEmailsTab({ caseId, className }: CaseEmailsTabProps) {
  // State
  const [filterMode, setFilterMode] = useState<CaseEmailFilterMode>('case');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // Data fetching
  const { threads, fullThreads, loading, error, refetch, participantEmails } = useEmailsByContact(
    caseId,
    filterMode
  );
  const { syncStatus, syncing, startSync } = useEmailSync();

  // Get selected thread data - use full thread with emails
  const selectedThread: EmailThread | null = useMemo(() => {
    if (!selectedThreadId) return null;
    // Find the full thread with email content
    return fullThreads.find((t) => t.id === selectedThreadId) || null;
  }, [selectedThreadId, fullThreads]);

  // Handlers
  const handleSelectThread = useCallback((thread: ThreadPreview) => {
    setSelectedThreadId(thread.id);
  }, []);

  // Group threads by month
  const threadsByMonth = useMemo(() => {
    const groups = new Map<string, { label: string; threads: ThreadPreview[] }>();

    // Sort threads by date (newest first)
    const sorted = [...threads].sort(
      (a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()
    );

    // Group by month
    for (const thread of sorted) {
      const date = new Date(thread.lastMessageDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
      // Capitalize first letter
      const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

      if (!groups.has(key)) {
        groups.set(key, { label: capitalizedLabel, threads: [] });
      }
      groups.get(key)!.threads.push(thread);
    }

    // Convert to array and sort by key (descending = newest first)
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, group]) => ({ key, ...group }));
  }, [threads]);

  // Loading state
  if (loading && threads.length === 0) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-linear-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-linear-text-secondary">Se incarca emailurile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center">
          <p className="text-sm text-linear-error mb-2">Eroare la incarcarea emailurilor</p>
          <p className="text-xs text-linear-text-tertiary mb-4">{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Reincearca
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (threads.length === 0 && !loading) {
    return (
      <div className={cn('flex-1 flex flex-col', className)}>
        {/* Header with filter */}
        <div className="px-5 py-3 border-b border-linear-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CaseEmailFilter value={filterMode} onChange={setFilterMode} className="w-48" />
          </div>
          <div className="flex items-center gap-2">
            {syncStatus && (
              <span className="text-xs text-linear-text-tertiary">
                Ultima sincronizare:{' '}
                {syncStatus.lastSyncAt
                  ? new Date(syncStatus.lastSyncAt).toLocaleTimeString('ro-RO')
                  : 'niciodata'}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={startSync} disabled={syncing}>
              <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Empty content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-linear-bg-tertiary rounded-2xl flex items-center justify-center">
              <Mail className="w-8 h-8 text-linear-text-tertiary" />
            </div>
            <p className="text-base font-medium text-linear-text-secondary mb-1">
              Nu exista emailuri
            </p>
            <p className="text-sm text-linear-text-tertiary max-w-sm">
              {filterMode === 'case'
                ? 'Nu am gasit emailuri asociate cu acest dosar.'
                : 'Nu am gasit emailuri de la sau catre contactele din acest dosar.'}
            </p>
            {participantEmails.length === 0 && (
              <p className="text-xs text-linear-warning mt-3">
                Clientul sau actorii nu au adrese de email configurate.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col min-h-0 overflow-hidden', className)}>
      {/* Header with filter */}
      <div className="px-5 py-3 border-b border-linear-border-subtle flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <CaseEmailFilter value={filterMode} onChange={setFilterMode} className="w-48" />
          <span className="text-xs text-linear-text-tertiary">{threads.length} conversatii</span>
        </div>
        <div className="flex items-center gap-2">
          {syncStatus && (
            <span className="text-xs text-linear-text-tertiary">
              Ultima sincronizare:{' '}
              {syncStatus.lastSyncAt
                ? new Date(syncStatus.lastSyncAt).toLocaleTimeString('ro-RO')
                : 'niciodata'}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={startSync} disabled={syncing}>
            <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Thread list (left) - grouped by month */}
        <div className="w-80 border-r border-linear-border-subtle flex-shrink-0 overflow-y-auto">
          {threadsByMonth.map((group) => (
            <Fragment key={group.key}>
              {/* Month header */}
              <div className="sticky top-0 bg-linear-bg-primary px-4 py-2 border-b border-linear-border-subtle z-10">
                <span className="text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                  {group.label}
                </span>
                <span className="text-xs text-linear-text-tertiary ml-2">
                  ({group.threads.length})
                </span>
              </div>
              {/* Threads in this month */}
              {group.threads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  isSelected={thread.id === selectedThreadId}
                  onClick={() => handleSelectThread(thread)}
                />
              ))}
            </Fragment>
          ))}
        </div>

        {/* Conversation view (right) - read only */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedThread ? (
            <EmailConversationView
              thread={selectedThread}
              loading={false}
              userEmail=""
              threadViewMode="conversation"
              attachmentPanelOpen={false}
              readOnly
              onToggleViewMode={() => {}}
              onToggleAttachmentPanel={() => {}}
              onAttachmentClick={() => {}}
              onSendReply={async () => {}}
              onGenerateQuickReply={async () => null}
              onGenerateFromPrompt={async () => null}
              className="flex-1"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-linear-bg-tertiary rounded-2xl flex items-center justify-center">
                  <Mail className="w-8 h-8 text-linear-text-tertiary" />
                </div>
                <p className="text-base font-medium text-linear-text-secondary mb-1">
                  Selecteaza o conversatie
                </p>
                <p className="text-sm text-linear-text-tertiary">
                  Alege un email din lista din stanga pentru a-l vizualiza
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
