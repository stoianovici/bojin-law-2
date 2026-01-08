'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui';
import { ConversationHeader } from './ConversationHeader';
import { MessageBubble } from './MessageBubble';
import { ReplyArea } from './ReplyArea';
import { HistoricalSyncStatus } from '@/components/communication/HistoricalSyncStatus';
import { NeclarAssignmentBar } from './NeclarAssignmentBar';
import type { EmailThread, Attachment, ThreadViewMode, UncertainEmail } from '@/types/email';

interface EmailConversationViewProps {
  thread: EmailThread | null;
  loading?: boolean;
  error?: Error;
  userEmail: string;
  threadViewMode: ThreadViewMode;
  attachmentPanelOpen: boolean;
  readOnly?: boolean;
  // Normal mode props
  onToggleViewMode: () => void;
  onToggleAttachmentPanel: () => void;
  onNewCompose?: () => void;
  onOpenInOutlook?: () => void;
  onReassign?: () => void;
  onAttachmentClick: (attachment: Attachment) => void;
  onDownloadAttachment?: (attachmentId: string, attachmentName: string) => Promise<void>;
  onSendReply: (threadId: string, body: string, attachments?: File[]) => Promise<void>;
  onGenerateQuickReply: (emailId: string) => Promise<string | null>;
  onGenerateFromPrompt: (emailId: string, prompt: string) => Promise<string | null>;
  // Personal thread toggle props
  isPersonal?: boolean;
  onTogglePersonal?: () => void;
  // Mark sender as personal (for unassigned threads)
  onMarkSenderAsPersonal?: () => void;
  // NECLAR mode props
  neclarMode?: boolean;
  neclarData?: UncertainEmail;
  onNeclarAssigned?: () => void;
  onNeclarAssignToCase?: (caseId: string) => Promise<void>;
  onNeclarIgnore?: () => Promise<void>;
  onNeclarMarkAsPersonal?: () => Promise<void>;
  onNeclarChooseOtherCase?: () => void;
  neclarLoading?: boolean;
  className?: string;
}

export function EmailConversationView({
  thread,
  loading,
  error,
  userEmail,
  threadViewMode,
  attachmentPanelOpen,
  readOnly = false,
  onToggleViewMode,
  onToggleAttachmentPanel,
  onNewCompose,
  onOpenInOutlook,
  onReassign,
  onAttachmentClick,
  onDownloadAttachment,
  onSendReply,
  onGenerateQuickReply,
  onGenerateFromPrompt,
  isPersonal,
  onTogglePersonal,
  onMarkSenderAsPersonal,
  neclarMode = false,
  neclarData,
  onNeclarAssigned: _onNeclarAssigned,
  onNeclarAssignToCase,
  onNeclarIgnore,
  onNeclarMarkAsPersonal,
  onNeclarChooseOtherCase,
  neclarLoading = false,
  className,
}: EmailConversationViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Auto-scroll to bottom when emails change
  useEffect(() => {
    if (thread?.emails) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thread?.emails]);

  // Handle attachment download
  const handleDownloadAttachment = useCallback(
    async (attachmentId: string, attachmentName: string) => {
      if (!onDownloadAttachment) return;

      setDownloadingId(attachmentId);
      try {
        await onDownloadAttachment(attachmentId, attachmentName);
      } finally {
        setDownloadingId(null);
      }
    },
    [onDownloadAttachment]
  );

  // Handle reply send
  const handleSendReply = useCallback(
    async (body: string, attachments?: File[]) => {
      if (!thread) return;
      await onSendReply(thread.id, body, attachments);
    },
    [thread, onSendReply]
  );

  // Get the last email ID for AI generation (most recent email to reply to)
  const getLastEmailId = useCallback(() => {
    if (!thread?.emails?.length) return null;
    // Sort by date descending and get the most recent email
    const sorted = [...thread.emails].sort(
      (a, b) => new Date(b.sentDateTime).getTime() - new Date(a.sentDateTime).getTime()
    );
    return sorted[0]?.id || null;
  }, [thread]);

  // Handle quick reply generation
  const handleQuickReply = useCallback(async () => {
    const emailId = getLastEmailId();
    if (!emailId) return null;
    return onGenerateQuickReply(emailId);
  }, [getLastEmailId, onGenerateQuickReply]);

  // Handle prompt-based generation
  const handleGenerateFromPrompt = useCallback(
    async (prompt: string) => {
      const emailId = getLastEmailId();
      if (!emailId) return null;
      return onGenerateFromPrompt(emailId, prompt);
    },
    [getLastEmailId, onGenerateFromPrompt]
  );

  // Loading state
  if (loading) {
    return (
      <div className={cn('flex-1 flex flex-col', className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-linear-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-linear-text-secondary">Se încarcă conversația...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex-1 flex flex-col', className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-linear-error mb-2">Eroare la încărcarea conversației</p>
            <p className="text-xs text-linear-text-tertiary">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state (no thread selected)
  if (!thread) {
    return (
      <div className={cn('flex-1 flex flex-col', className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-linear-bg-tertiary rounded-2xl flex items-center justify-center">
              <Mail className="w-8 h-8 text-linear-text-tertiary" />
            </div>
            <p className="text-base font-medium text-linear-text-secondary mb-1">
              Selectează o conversație
            </p>
            <p className="text-sm text-linear-text-tertiary">
              Alege un email din lista din stânga pentru a-l vizualiza
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Sort emails chronologically (oldest first)
  const sortedEmails = [...thread.emails].sort(
    (a, b) => new Date(a.sentDateTime).getTime() - new Date(b.sentDateTime).getTime()
  );

  return (
    <div className={cn('flex-1 min-w-0 flex flex-col overflow-hidden', className)}>
      {/* Header */}
      <ConversationHeader
        thread={thread}
        threadViewMode={threadViewMode}
        attachmentPanelOpen={attachmentPanelOpen}
        onToggleViewMode={onToggleViewMode}
        onToggleAttachmentPanel={onToggleAttachmentPanel}
        onNewCompose={onNewCompose}
        onOpenInOutlook={onOpenInOutlook}
        onReassign={onReassign}
        isPersonal={isPersonal}
        onTogglePersonal={onTogglePersonal}
        onMarkSenderAsPersonal={onMarkSenderAsPersonal}
      />

      {/* Historical Email Sync Status */}
      {thread.case && (
        <div className="px-5 pt-3">
          <HistoricalSyncStatus caseId={thread.case.id} />
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-5">
          {sortedEmails.map((email) => {
            const isSent =
              email.folderType === 'sent' ||
              email.from.address.toLowerCase() === userEmail.toLowerCase();

            return (
              <MessageBubble
                key={email.id}
                message={email}
                isSent={isSent}
                onAttachmentClick={onAttachmentClick}
                onDownloadAttachment={handleDownloadAttachment}
                downloadingId={downloadingId}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Reply Area (only in normal mode, not NECLAR or read-only) */}
      {!neclarMode && !readOnly && (
        <ReplyArea
          threadId={thread.id}
          onSend={handleSendReply}
          onGenerateQuickReply={handleQuickReply}
          onGenerateFromPrompt={handleGenerateFromPrompt}
        />
      )}

      {/* NECLAR Assignment Bar for uncertain emails */}
      {neclarMode &&
        neclarData &&
        onNeclarAssignToCase &&
        onNeclarIgnore &&
        onNeclarMarkAsPersonal &&
        onNeclarChooseOtherCase && (
          <NeclarAssignmentBar
            email={neclarData}
            onAssignToCase={onNeclarAssignToCase}
            onIgnore={onNeclarIgnore}
            onMarkAsPersonal={onNeclarMarkAsPersonal}
            onChooseOtherCase={onNeclarChooseOtherCase}
            loading={neclarLoading}
          />
        )}
    </div>
  );
}
