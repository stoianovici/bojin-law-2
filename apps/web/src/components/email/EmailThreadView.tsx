/**
 * Email Thread View Component
 * Story 5.1: Email Integration and Synchronization
 * Story 5.3: AI-Powered Email Drafting (Reply with AI button)
 *
 * Displays full email thread with messages in chronological order (AC: 3)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { useEmailThread, useThreadParticipants, useDeleteEmail } from '@/hooks/useEmailSync';
import { useAuth } from '@/contexts/AuthContext';
import { CaseAssignmentSelector } from './CaseAssignmentSelector';
import { EmailAttachmentsPanel } from './EmailAttachmentsPanel';
import { EmailIntelligenceSidebar } from './EmailIntelligenceSidebar';
import { DraftGenerationPanel } from './DraftGenerationPanel';
import { EmailComposer } from './EmailComposer';
import { Spinner } from '@/components/ui/spinner';
import type { EmailDraft } from '@/hooks/useEmailDraft';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Sanitize email HTML and remove cid: image references that cause console errors.
 * CID (Content-ID) URLs are email-specific references to inline attachments
 * that browsers cannot load directly.
 */
function sanitizeEmailHtml(html: string): string {
  // Replace cid: src attributes with a transparent 1x1 GIF to prevent browser errors
  const sanitizedCid = html.replace(
    /src=["']cid:[^"']*["']/gi,
    'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-cid-placeholder="true"'
  );
  return DOMPurify.sanitize(sanitizedCid);
}

// ============================================================================
// Types
// ============================================================================

interface Email {
  id: string;
  subject: string;
  bodyPreview: string;
  bodyContent: string;
  bodyContentType: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  ccRecipients: Array<{ name?: string; address: string }>;
  receivedDateTime: string;
  hasAttachments: boolean;
  isRead: boolean;
  attachments: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
  }>;
}

interface EmailThreadViewProps {
  conversationId: string;
  onClose?: () => void;
}

export function EmailThreadView({ conversationId, onClose }: EmailThreadViewProps) {
  const { thread, loading, error, markRead, assignToCase, refetch } =
    useEmailThread(conversationId);
  const { participants } = useThreadParticipants(conversationId);
  const { user } = useAuth();
  const { deleteEmail, loading: deleting } = useDeleteEmail();
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [showCaseSelector, setShowCaseSelector] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [_highlightedExtraction, setHighlightedExtraction] = useState<{
    emailId: string;
    extractionId: string;
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check if user can delete (Partner or BusinessOwner)
  const canDelete = user?.role === 'Partner' || user?.role === 'BusinessOwner';

  // Story 5.3: AI Email Drafting state
  const [showDraftPanel, setShowDraftPanel] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [activeDraft, setActiveDraft] = useState<EmailDraft | null>(null);
  const [replyToEmailId, setReplyToEmailId] = useState<string | null>(null);

  // Handle extraction highlight from sidebar
  const handleHighlightExtraction = useCallback((emailId: string, extractionId: string) => {
    setHighlightedExtraction({ emailId, extractionId });
    // Note: _highlightedExtraction can be used to add visual highlighting to emails
    // Expand the email containing the extraction
    setExpandedEmails((prev) => new Set(prev).add(emailId));
    // Scroll to the email
    const emailElement = document.getElementById(`email-${emailId}`);
    if (emailElement) {
      emailElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Clear highlight after a delay
    setTimeout(() => setHighlightedExtraction(null), 3000);
  }, []);

  // Auto-mark as read when viewing
  useEffect(() => {
    if (thread?.hasUnread) {
      markRead();
    }
  }, [thread?.hasUnread, markRead]);

  // Expand latest email by default
  useEffect(() => {
    if (thread?.emails?.length && expandedEmails.size === 0) {
      const latestEmail = thread.emails[thread.emails.length - 1];
      setExpandedEmails(new Set([latestEmail.id]));
    }
  }, [thread?.emails]);

  const toggleEmail = (emailId: string) => {
    setExpandedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  };

  const handleAssignCase = async (caseId: string) => {
    await assignToCase(caseId);
    setShowCaseSelector(false);
    refetch();
  };

  // Story 5.3: Handle Reply with AI
  const handleReplyWithAI = useCallback(
    (emailId?: string) => {
      const latestEmail = thread?.emails?.[thread.emails.length - 1];
      setReplyToEmailId(emailId || latestEmail?.id || null);
      setShowDraftPanel(true);
      setShowComposer(false);
      setActiveDraft(null);
    },
    [thread?.emails]
  );

  const handleDraftSelect = useCallback((draft: EmailDraft) => {
    setActiveDraft(draft);
    setShowDraftPanel(false);
    setShowComposer(true);
  }, []);

  const handleComposerClose = useCallback(() => {
    setShowComposer(false);
    setActiveDraft(null);
    setReplyToEmailId(null);
  }, []);

  const handleDraftSent = useCallback(() => {
    setShowComposer(false);
    setActiveDraft(null);
    setReplyToEmailId(null);
    refetch();
  }, [refetch]);

  // Handle delete all emails in thread
  const handleDeleteThread = useCallback(async () => {
    if (!thread?.emails) return;

    try {
      // Delete all emails in the thread
      for (const email of thread.emails) {
        await deleteEmail(email.id);
      }
      setShowDeleteConfirm(false);
      onClose?.();
    } catch (err) {
      console.error('Failed to delete thread:', err);
    }
  }, [thread?.emails, deleteEmail, onClose]);

  if (loading && !thread) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-600">
        Error loading thread: {error.message}
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        Select an email thread
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* Main content */}
      <div className="flex h-full flex-1 flex-col" id="email-content">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {thread.subject}
              </h2>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{thread.messageCount} messages</span>
                <span>·</span>
                <span>{thread.participantCount} participants</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Reply with AI button - Story 5.3 */}
              <button
                onClick={() => handleReplyWithAI()}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <SparklesIcon />
                Reply with AI
              </button>

              {/* Intelligence toggle button */}
              <button
                onClick={() => setShowIntelligence(!showIntelligence)}
                className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                aria-expanded={showIntelligence}
                aria-controls="intelligence-sidebar"
              >
                <BrainIcon />
                Intelligence
              </button>

              {/* Delete button - Partners/BusinessOwners only */}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500"
                  title="Șterge conversația"
                >
                  <TrashIcon />
                  Șterge
                </button>
              )}

              {onClose && (
                <button
                  onClick={onClose}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          </div>

          {/* Case assignment */}
          <div className="mt-3 flex items-center gap-2">
            {thread.case ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">Assigned to:</span>
                <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  {thread.case.caseNumber} - {thread.case.title}
                </span>
                <button
                  onClick={() => setShowCaseSelector(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCaseSelector(true)}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <FolderIcon />
                Assign to Case
              </button>
            )}
          </div>
        </div>

        {/* Participants */}
        {participants.length > 0 && (
          <div className="border-b border-gray-200 p-3 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {participants.slice(0, 5).map((p: any) => (
                <span
                  key={p.email}
                  className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                >
                  {p.name || p.email}
                  {p.roles.includes('sender') && (
                    <span className="ml-1 text-gray-400">({p.messageCount})</span>
                  )}
                </span>
              ))}
              {participants.length > 5 && (
                <span className="text-xs text-gray-500">+{participants.length - 5} more</span>
              )}
            </div>
          </div>
        )}

        {/* Email messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {thread.emails.map((email: Email) => (
              <EmailMessage
                key={email.id}
                email={email}
                expanded={expandedEmails.has(email.id)}
                onToggle={() => toggleEmail(email.id)}
              />
            ))}
          </div>
        </div>

        {/* Case assignment modal */}
        {showCaseSelector && (
          <CaseAssignmentSelector
            onSelect={handleAssignCase}
            onClose={() => setShowCaseSelector(false)}
            currentCaseId={thread.case?.id}
          />
        )}

        {/* Story 5.3: Draft Generation Panel */}
        {showDraftPanel && replyToEmailId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl dark:bg-gray-900">
              <DraftGenerationPanel
                emailId={replyToEmailId}
                onDraftSelect={handleDraftSelect}
                onCancel={() => setShowDraftPanel(false)}
              />
            </div>
          </div>
        )}

        {/* Story 5.3: Email Composer */}
        {showComposer &&
          activeDraft &&
          replyToEmailId &&
          (() => {
            const emailToReply =
              thread.emails.find((e: Email) => e.id === replyToEmailId) ||
              thread.emails[thread.emails.length - 1];
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl dark:bg-gray-900">
                  <EmailComposer
                    draft={activeDraft}
                    originalEmail={{
                      id: emailToReply.id,
                      subject: emailToReply.subject,
                      from: emailToReply.from,
                      bodyPreview: emailToReply.bodyPreview,
                      receivedDateTime: emailToReply.receivedDateTime,
                    }}
                    onClose={handleComposerClose}
                    onSent={handleDraftSent}
                    onDiscard={handleComposerClose}
                  />
                </div>
              </div>
            );
          })()}

        {/* Delete confirmation dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Confirmare ștergere
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Sigur doriți să ștergeți permanent această conversație cu {thread.messageCount}{' '}
                {thread.messageCount === 1 ? 'mesaj' : 'mesaje'}? Această acțiune nu poate fi
                anulată.
              </p>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  disabled={deleting}
                >
                  Anulează
                </button>
                <button
                  onClick={handleDeleteThread}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Se șterge...
                    </>
                  ) : (
                    <>
                      <TrashIcon />
                      Șterge permanent
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Intelligence Sidebar */}
      <EmailIntelligenceSidebar
        conversationId={conversationId}
        caseId={thread.case?.id}
        isOpen={showIntelligence}
        onClose={() => setShowIntelligence(false)}
        onHighlightExtraction={handleHighlightExtraction}
      />
    </div>
  );
}

function EmailMessage({
  email,
  expanded,
  onToggle,
}: {
  email: Email;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Email header - always visible */}
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`email-content-${email.id}`}
        className="flex w-full items-start justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white">
              {email.from.name || email.from.address}
            </span>
            {!expanded && email.hasAttachments && (
              <AttachmentIcon className="h-4 w-4 text-gray-400" aria-label="Has attachments" />
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {format(new Date(email.receivedDateTime), 'MMM d, yyyy h:mm a')}
          </div>
          {!expanded && (
            <div className="mt-1 truncate text-sm text-gray-600 dark:text-gray-300">
              {email.bodyPreview}
            </div>
          )}
        </div>
        <ChevronIcon expanded={expanded} />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          id={`email-content-${email.id}`}
          className="border-t border-gray-200 dark:border-gray-700"
        >
          {/* Recipients */}
          <div className="border-b border-gray-100 p-4 text-sm dark:border-gray-800">
            <div className="flex gap-2">
              <span className="text-gray-500">To:</span>
              <span className="text-gray-700 dark:text-gray-300">
                {email.toRecipients.map((r) => r.name || r.address).join(', ')}
              </span>
            </div>
            {email.ccRecipients.length > 0 && (
              <div className="mt-1 flex gap-2">
                <span className="text-gray-500">Cc:</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {email.ccRecipients.map((r) => r.name || r.address).join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-4">
            {email.bodyContentType === 'html' ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(email.bodyContent) }}
              />
            ) : (
              <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {email.bodyContent}
              </div>
            )}
          </div>

          {/* Attachments */}
          {email.hasAttachments && email.attachments.length > 0 && (
            <EmailAttachmentsPanel attachments={email.attachments} emailId={email.id} />
          )}
        </div>
      )}
    </div>
  );
}

// Icons
function SparklesIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function AttachmentIcon({
  className,
  'aria-label': ariaLabel,
}: {
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
      />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
