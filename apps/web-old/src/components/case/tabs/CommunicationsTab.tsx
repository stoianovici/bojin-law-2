/**
 * CommunicationsTab - Shows email threads for a case in conversation view
 *
 * OPS-037: Read-only view of all firm users' communications for a case.
 * OPS-185: Unified with /communications - uses ConversationView for threads
 *
 * - Thread list on left, conversation view on right
 * - AI summary panel at top (collapsible)
 * - Same chat-style display as /communications page
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Brain,
  Mail,
  Paperclip,
  MessageSquare,
  LayoutList,
  Loader2,
} from 'lucide-react';
import { ConversationView } from '../../communication/ConversationView';
import { MessageView } from '../../communication/MessageView';
import { CaseConversationSummaryPanel } from '../../communication/CaseConversationSummaryPanel';
import { useEmailThreads, useEmailThread } from '../../../hooks/useEmailSync';
import { useCommunicationStore } from '../../../stores/communication.store';
import { useAuth } from '../../../contexts/AuthContext';

// ============================================================================
// Animation Variants
// ============================================================================

const listItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

// ============================================================================
// Types
// ============================================================================

export interface CommunicationsTabProps {
  caseId?: string;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

interface ThreadItemProps {
  thread: {
    id: string;
    conversationId: string;
    subject: string;
    hasUnread: boolean;
    hasAttachments: boolean;
    lastMessageDate: string;
    messageCount: number;
  };
  isSelected: boolean;
  onClick: () => void;
}

function ThreadItem({ thread, isSelected, onClick }: ThreadItemProps) {
  const formattedDate = new Date(thread.lastMessageDate).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full px-3 py-2.5 text-left text-sm transition-colors border-b border-linear-border-subtle',
        isSelected
          ? 'bg-linear-accent/10 border-l-2 border-l-linear-accent'
          : 'hover:bg-linear-bg-tertiary border-l-2 border-l-transparent'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              'truncate',
              thread.hasUnread
                ? 'font-semibold text-linear-text-primary'
                : 'text-linear-text-secondary'
            )}
          >
            {thread.subject || '(Fără subiect)'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {thread.hasAttachments && <Paperclip className="h-3 w-3 text-linear-text-muted" />}
          {thread.hasUnread && <span className="w-2 h-2 bg-linear-accent rounded-full" />}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-linear-text-muted">{formattedDate}</span>
        {thread.messageCount > 1 && (
          <span className="text-xs text-linear-text-muted">{thread.messageCount} mesaje</span>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CommunicationsTab({ caseId, className }: CommunicationsTabProps) {
  const [isAISummaryExpanded, setIsAISummaryExpanded] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  // Auth context for user email
  const { user } = useAuth();

  // Communication store for thread data and view mode
  const {
    setThreads,
    selectThread,
    getSelectedThread,
    setUserEmail,
    threadViewMode,
    setThreadViewMode,
  } = useCommunicationStore();

  // Set user email in store
  useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email);
    }
  }, [user?.email, setUserEmail]);

  // Fetch threads for this case
  const {
    threads,
    loading: threadsLoading,
    error: threadsError,
  } = useEmailThreads(
    caseId ? { caseId } : undefined,
    500 // Fetch up to 500 threads to avoid pagination
  );

  // Auto-select first thread when threads load
  // Using useMemo to derive the effective conversation ID without setState in effect
  const effectiveConversationId = useMemo(() => {
    if (selectedConversationId) return selectedConversationId;
    if (threads.length > 0) return threads[0].conversationId;
    return null;
  }, [selectedConversationId, threads]);

  // Fetch selected thread details
  const { thread: selectedThreadData, loading: threadLoading } = useEmailThread(
    effectiveConversationId || ''
  );

  // Update communication store when thread data is loaded
  useEffect(() => {
    if (selectedThreadData && effectiveConversationId) {
      // Transform to CommunicationThread format (same as /communications page)
      const transformedThread = {
        id: selectedThreadData.id || selectedThreadData.conversationId,
        conversationId: selectedThreadData.conversationId,
        subject: selectedThreadData.subject || '(Fără subiect)',
        caseId: selectedThreadData.case?.id || caseId || '',
        caseType: 'Other' as const,
        caseName: selectedThreadData.case?.title || 'Dosar',
        participants: [],
        messages: (selectedThreadData.emails || []).map((email: any) => ({
          id: email.id,
          threadId: selectedThreadData.id || selectedThreadData.conversationId,
          senderId: email.from?.address || '',
          senderName: email.from?.name || email.from?.address || 'Unknown',
          senderEmail: email.from?.address || '',
          recipientIds: (email.toRecipients || []).map((r: any) => r.address),
          recipients: (email.toRecipients || []).map((r: any) => ({
            id: r.address,
            name: r.name || r.address,
            email: r.address,
          })),
          subject: email.subject || '(Fără subiect)',
          body: email.bodyContent || email.bodyPreview || '',
          bodyFormat: email.bodyContentType === 'html' ? 'html' : 'text',
          bodyClean: email.bodyContentClean || undefined,
          folderType: email.folderType || null,
          sentDate:
            email.sentDateTime || email.receivedDateTime
              ? new Date(email.sentDateTime || email.receivedDateTime)
              : new Date(),
          isRead: email.isRead ?? true,
          hasAttachments: email.hasAttachments ?? false,
          attachments: (email.attachments || []).map((att: any) => ({
            id: att.id,
            name: att.name,
            size: att.size || 0,
            mimeType: att.contentType || 'application/octet-stream',
            url: att.downloadUrl || '',
          })),
        })),
        lastMessageDate: new Date(selectedThreadData.lastMessageDate || Date.now()),
        isUnread: selectedThreadData.hasUnread ?? false,
        hasAttachments: selectedThreadData.hasAttachments ?? false,
        isProcessed: false,
        extractedItems: {
          deadlines: [],
          commitments: [],
          actionItems: [],
        },
        createdAt: new Date(selectedThreadData.lastMessageDate || Date.now()),
        updatedAt: new Date(selectedThreadData.lastMessageDate || Date.now()),
      };

      setThreads([transformedThread as any]);
      selectThread(transformedThread.id);
    }
  }, [selectedThreadData, effectiveConversationId, caseId, setThreads, selectThread]);

  // Handle thread selection
  const handleSelectThread = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
  }, []);

  const selectedThread = getSelectedThread();

  if (!caseId) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center h-full bg-linear-bg-secondary p-8',
          className
        )}
      >
        <p className="text-linear-text-tertiary">Selectați un dosar pentru a vedea comunicările.</p>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full bg-linear-bg-secondary', className)}>
      {/* Header with view mode toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-linear-border-subtle bg-linear-bg-tertiary flex-shrink-0">
        <h3 className="text-sm font-medium text-linear-text-secondary">Comunicări</h3>

        {/* View mode toggle */}
        <div className="flex items-center bg-linear-bg-quaternary rounded-lg p-0.5">
          <button
            onClick={() => setThreadViewMode('conversation')}
            className={clsx(
              'px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1',
              threadViewMode === 'conversation'
                ? 'bg-linear-bg-secondary text-linear-text-primary shadow-sm'
                : 'text-linear-text-secondary hover:text-linear-text-primary'
            )}
            title="Vizualizare conversație"
          >
            <MessageSquare className="h-3 w-3" />
            <span className="hidden sm:inline">Chat</span>
          </button>
          <button
            onClick={() => setThreadViewMode('cards')}
            className={clsx(
              'px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1',
              threadViewMode === 'cards'
                ? 'bg-linear-bg-secondary text-linear-text-primary shadow-sm'
                : 'text-linear-text-secondary hover:text-linear-text-primary'
            )}
            title="Vizualizare carduri"
          >
            <LayoutList className="h-3 w-3" />
            <span className="hidden sm:inline">Carduri</span>
          </button>
        </div>
      </div>

      {/* AI Thread Summary Section */}
      <div className="border-b border-linear-border-subtle flex-shrink-0">
        <button
          onClick={() => setIsAISummaryExpanded(!isAISummaryExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-linear-bg-tertiary transition-colors"
          aria-expanded={isAISummaryExpanded}
          aria-controls="ai-summary-panel"
        >
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" aria-hidden="true" />
            <span className="text-sm font-medium text-linear-text-secondary">
              Rezumat AI Thread-uri
            </span>
          </div>
          {isAISummaryExpanded ? (
            <ChevronUp className="h-4 w-4 text-linear-text-muted" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-linear-text-muted" aria-hidden="true" />
          )}
        </button>
        {isAISummaryExpanded && (
          <div id="ai-summary-panel" className="px-4 pb-4">
            <CaseConversationSummaryPanel caseId={caseId} />
          </div>
        )}
      </div>

      {/* Two-column layout: Thread list + Conversation view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Thread List */}
        <div className="w-64 lg:w-72 border-r border-linear-border-subtle flex flex-col overflow-hidden bg-linear-bg-secondary flex-shrink-0">
          {/* Thread list header */}
          <div className="px-3 py-2 bg-linear-bg-tertiary border-b border-linear-border-subtle">
            <span className="text-xs font-medium text-linear-text-tertiary uppercase tracking-wide">
              Conversații ({threads.length})
            </span>
          </div>

          {/* Thread list content */}
          <div className="flex-1 overflow-y-auto">
            {threadsLoading && threads.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-linear-text-muted" />
              </div>
            ) : threadsError ? (
              <div className="px-3 py-4 text-sm text-linear-error">
                Eroare la încărcarea conversațiilor
              </div>
            ) : threads.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Mail className="h-8 w-8 text-linear-text-muted mx-auto mb-2" />
                <p className="text-sm text-linear-text-tertiary">
                  Nu există conversații pentru acest dosar
                </p>
              </div>
            ) : (
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible">
                {threads.map((thread) => (
                  <motion.div key={thread.conversationId} variants={listItemVariants}>
                    <ThreadItem
                      thread={thread}
                      isSelected={effectiveConversationId === thread.conversationId}
                      onClick={() => handleSelectThread(thread.conversationId)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* Right: Conversation View */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {threadLoading && !selectedThread ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-linear-text-muted" />
            </div>
          ) : selectedThread ? (
            threadViewMode === 'conversation' ? (
              <ConversationView />
            ) : (
              <MessageView />
            )
          ) : (
            <div className="flex-1 flex items-center justify-center text-linear-text-tertiary">
              <div className="text-center">
                <Mail className="h-12 w-12 text-linear-text-muted mx-auto mb-3" />
                <p>Selectați o conversație din stânga</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

CommunicationsTab.displayName = 'CommunicationsTab';
