'use client';

import { useState, useCallback, useMemo } from 'react';
import { Mail, RefreshCw, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ScrollArea } from '@/components/ui';
import {
  CaseEmailFilter,
  ThreadItem,
  EmailConversationView,
  InternalNoteComposer,
  UnlinkThreadModal,
  type CaseEmailFilterMode,
} from '@/components/email';
import { useEmailsByContact } from '@/hooks/useEmailsByContact';
import { useEmailSync } from '@/hooks/useEmailSync';
import type { ThreadPreview, EmailThread, Attachment, ThreadViewMode } from '@/types/email';

// ============================================================================
// Types
// ============================================================================

interface CaseEmailsTabProps {
  caseId: string;
  caseName: string;
  userEmail: string;
  className?: string;
}

// ============================================================================
// Component Implementation
// ============================================================================

export function CaseEmailsTab({ caseId, caseName, userEmail, className }: CaseEmailsTabProps) {
  // State
  const [filterMode, setFilterMode] = useState<CaseEmailFilterMode>('case');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadViewMode, setThreadViewMode] = useState<ThreadViewMode>('conversation');
  const [attachmentPanelOpen, setAttachmentPanelOpen] = useState(false);
  const [unlinkModalOpen, setUnlinkModalOpen] = useState(false);

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

  const handleToggleViewMode = useCallback(() => {
    setThreadViewMode((prev) => (prev === 'conversation' ? 'cards' : 'conversation'));
  }, []);

  const handleToggleAttachmentPanel = useCallback(() => {
    setAttachmentPanelOpen((prev) => !prev);
  }, []);

  const handleAttachmentClick = useCallback((attachment: Attachment) => {
    // TODO: Open attachment preview
    console.log('Attachment clicked:', attachment);
  }, []);

  const handleSendReply = useCallback(async (threadId: string, body: string) => {
    // TODO: Implement reply sending
    console.log('Send reply:', { threadId, body });
  }, []);

  const handleGenerateQuickReply = useCallback(async (threadId: string) => {
    // TODO: Implement AI quick reply
    return null;
  }, []);

  const handleGenerateFromPrompt = useCallback(async (threadId: string, prompt: string) => {
    // TODO: Implement AI prompt-based reply
    return null;
  }, []);

  const handleInternalNote = useCallback(async (note: string) => {
    // TODO: Implement internal note saving
    console.log('Internal note:', note);
  }, []);

  const handleUnlinkThread = useCallback(async () => {
    // TODO: Implement thread unlinking
    console.log('Unlink thread:', selectedThreadId);
    setUnlinkModalOpen(false);
  }, [selectedThreadId]);

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
        {/* Thread list (left) */}
        <div className="w-80 border-r border-linear-border-subtle flex-shrink-0 overflow-y-auto">
          {threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isSelected={thread.id === selectedThreadId}
              onClick={() => handleSelectThread(thread)}
            />
          ))}
        </div>

        {/* Conversation view (right) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedThread ? (
            <>
              {/* Action bar for selected thread */}
              <div className="px-4 py-2 border-b border-linear-border-subtle flex items-center justify-end gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUnlinkModalOpen(true)}
                  className="text-linear-text-secondary hover:text-linear-error"
                >
                  <Unlink className="h-4 w-4 mr-1.5" />
                  Dezasociaza
                </Button>
              </div>

              <EmailConversationView
                thread={selectedThread}
                loading={false}
                userEmail={userEmail}
                threadViewMode={threadViewMode}
                attachmentPanelOpen={attachmentPanelOpen}
                onToggleViewMode={handleToggleViewMode}
                onToggleAttachmentPanel={handleToggleAttachmentPanel}
                onAttachmentClick={handleAttachmentClick}
                onSendReply={handleSendReply}
                onGenerateQuickReply={handleGenerateQuickReply}
                onGenerateFromPrompt={handleGenerateFromPrompt}
                className="flex-1"
              />

              {/* Internal note composer */}
              <InternalNoteComposer threadId={selectedThread.id} onSubmit={handleInternalNote} />
            </>
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

      {/* Unlink modal */}
      <UnlinkThreadModal
        open={unlinkModalOpen}
        onOpenChange={setUnlinkModalOpen}
        threadSubject={selectedThread?.subject || ''}
        caseName={caseName}
        onConfirm={handleUnlinkThread}
      />
    </div>
  );
}
