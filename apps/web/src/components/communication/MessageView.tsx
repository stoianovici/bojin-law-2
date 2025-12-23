'use client';

// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAuth } from '../../contexts/AuthContext';
import { useMyCases } from '../../hooks/useMyCases';
import { format } from 'date-fns';
import type { CommunicationMessage } from '@legal-platform/types';
import {
  Paperclip,
  Reply,
  ArrowUpDown,
  Download,
  Loader2,
  Link2,
  FolderInput,
  EyeOff,
  X,
  Users,
  Eye,
  FileText,
  FileCode,
} from 'lucide-react';
import { NotifyStakeholdersModal } from './NotifyStakeholdersModal';
import { DocumentPreviewModal, type PreviewableDocument } from '@/components/preview';
import { useState, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useMutation, useLazyQuery } from '@apollo/client/react';

// GraphQL query for getting attachment preview URL
const GET_ATTACHMENT_PREVIEW_URL = gql`
  query GetAttachmentPreviewUrl($attachmentId: ID!) {
    attachmentPreviewUrl(attachmentId: $attachmentId) {
      url
      source
      expiresAt
    }
  }
`;

// GraphQL mutation for syncing attachments
const SYNC_EMAIL_ATTACHMENTS = gql`
  mutation SyncEmailAttachments($emailId: ID!) {
    syncEmailAttachments(emailId: $emailId) {
      id
      name
      contentType
      size
      downloadUrl
    }
  }
`;

// GraphQL query for downloading attachment content directly from MS Graph
const GET_ATTACHMENT_CONTENT = gql`
  query GetAttachmentContent($emailId: ID!, $attachmentId: ID!) {
    emailAttachmentContent(emailId: $emailId, attachmentId: $attachmentId) {
      content
      name
      contentType
      size
    }
  }
`;

// GraphQL mutation for assigning thread to case (OPS-125: returns AssignThreadResult)
const ASSIGN_THREAD_TO_CASE = gql`
  mutation AssignThreadToCase($conversationId: String!, $caseId: ID!) {
    assignThreadToCase(conversationId: $conversationId, caseId: $caseId) {
      thread {
        id
        conversationId
        case {
          id
          title
        }
      }
      newContactAdded
      contactName
      contactEmail
    }
  }
`;

// GraphQL mutation for ignoring a thread (mark as not case-related)
const IGNORE_EMAIL_THREAD = gql`
  mutation IgnoreEmailThread($conversationId: String!) {
    ignoreEmailThread(conversationId: $conversationId) {
      id
      conversationId
    }
  }
`;

// Type definitions for GraphQL mutation results (OPS-125: updated for AssignThreadResult)
interface AssignThreadToCaseResult {
  assignThreadToCase: {
    thread: {
      id: string;
      conversationId: string;
      case: {
        id: string;
        title: string;
      } | null;
    };
    newContactAdded: boolean;
    contactName?: string;
    contactEmail?: string;
  };
}

interface IgnoreEmailThreadResult {
  ignoreEmailThread: {
    id: string;
    conversationId: string;
  };
}

// Extended message type with hasAttachments flag
interface ExtendedMessage extends CommunicationMessage {
  hasAttachments?: boolean;
  bodyClean?: string; // OPS-090: AI-cleaned content
}

function Message({
  message,
  threadId,
  isExpanded,
  onToggle,
  onReply,
  isCollapsed: _isCollapsed,
  onAttachmentsSynced,
  hasMsalAccount,
  onReconnectMicrosoft,
  isSentByUser, // OPS-091: Visual distinction for sent emails
  onPreviewAttachment, // OPS-122: Panel-based preview
}: {
  message: ExtendedMessage;
  threadId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onReply: (threadId: string) => void;
  isCollapsed?: boolean;
  onAttachmentsSynced?: (messageId: string, attachments: any[]) => void;
  hasMsalAccount?: boolean;
  onReconnectMicrosoft?: () => void;
  isSentByUser?: boolean; // OPS-091
  onPreviewAttachment?: (attachmentId: string, messageId: string) => void; // OPS-122
}) {
  const [syncingAttachments, setSyncingAttachments] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PreviewableDocument | null>(null);
  // OPS-090: Toggle between clean and original content
  const [showOriginal, setShowOriginal] = useState(false);
  const [syncEmailAttachments] = useMutation(SYNC_EMAIL_ATTACHMENTS);
  const [fetchAttachmentContent] = useLazyQuery(GET_ATTACHMENT_CONTENT, {
    fetchPolicy: 'network-only',
  });
  const [fetchPreviewUrl] = useLazyQuery(GET_ATTACHMENT_PREVIEW_URL, {
    fetchPolicy: 'network-only',
  });

  // Handle attachment download - fetches from MS Graph and triggers browser download
  const handleDownloadAttachment = useCallback(
    async (e: React.MouseEvent, attachmentId: string, attachmentName: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (downloadingId) return; // Already downloading
      setDownloadingId(attachmentId);

      try {
        const result = await fetchAttachmentContent({
          variables: { emailId: message.id, attachmentId },
        });

        const data = (result.data as any)?.emailAttachmentContent;
        if (data?.content) {
          // Convert base64 to blob and trigger download
          const byteCharacters = atob(data.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: data.contentType });

          // Create download link
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = data.name || attachmentName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error('Failed to download attachment:', error);
        setSyncError('Nu s-a putut descărca fișierul');
      } finally {
        setDownloadingId(null);
      }
    },
    [message.id, fetchAttachmentContent, downloadingId]
  );

  // Handle attachment preview - opens preview panel (OPS-122) or modal (fallback)
  const handlePreviewAttachment = useCallback(
    (e: React.MouseEvent, attachment: any) => {
      e.preventDefault();
      e.stopPropagation();

      // OPS-122: Use side panel if callback provided
      if (onPreviewAttachment) {
        onPreviewAttachment(attachment.id, message.id);
        return;
      }

      // Fallback to modal for standalone usage
      setPreviewDocument({
        id: attachment.id,
        name: attachment.name || 'Attachment',
        contentType: attachment.mimeType || attachment.contentType || 'application/octet-stream',
        size: attachment.size || attachment.fileSize || 0,
        downloadUrl: attachment.url || attachment.downloadUrl || null,
        previewUrl: null, // Will be fetched on demand
        // Store emailId for fallback content fetch when no OneDrive document exists
        emailId: message.id,
      } as PreviewableDocument & { emailId?: string });
    },
    [message.id, onPreviewAttachment]
  );

  // Fetch preview URL for the modal
  // First tries OneDrive preview URL, then falls back to fetching content from MS Graph
  const handleRequestPreviewUrl = useCallback(
    async (attachmentId: string): Promise<string | null> => {
      try {
        // First, try to get OneDrive preview URL (for case-assigned emails)
        const result = await fetchPreviewUrl({
          variables: { attachmentId },
        });
        const data = result.data as { attachmentPreviewUrl?: { url: string } } | undefined;

        if (data?.attachmentPreviewUrl?.url) {
          return data.attachmentPreviewUrl.url;
        }

        // Fallback: Fetch content directly from MS Graph and create blob URL
        // This works for uncategorized emails where attachments aren't in OneDrive yet
        const emailId = (previewDocument as any)?.emailId;
        if (!emailId) {
          console.error('No emailId available for fallback content fetch');
          return null;
        }

        const contentResult = await fetchAttachmentContent({
          variables: { emailId, attachmentId },
        });

        const contentData = (contentResult.data as any)?.emailAttachmentContent;
        if (contentData?.content) {
          // Convert base64 to blob URL
          const byteCharacters = atob(contentData.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], {
            type: contentData.contentType || 'application/octet-stream',
          });

          const blobUrl = URL.createObjectURL(blob);
          return blobUrl;
        }

        return null;
      } catch (error) {
        console.error('Failed to fetch preview URL:', error);
        return null;
      }
    },
    [fetchPreviewUrl, fetchAttachmentContent, previewDocument]
  );

  const handleSyncAttachments = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (syncingAttachments) return;

      setSyncingAttachments(true);
      setSyncError(null);

      try {
        console.log('[MessageView] Syncing attachments for email:', message.id);
        const result = await syncEmailAttachments({
          variables: { emailId: message.id },
        });

        console.log('[MessageView] Sync result:', result);
        const syncedData = result.data as { syncEmailAttachments: any[] } | null | undefined;

        // Check for errors in result
        const resultError = (result as any).error;
        if ((result as any).errors || resultError) {
          const errorObj = (result as any).errors?.[0] || resultError;
          console.error('[MessageView] GraphQL errors:', errorObj);
          // Try to extract a meaningful message
          let errorMsg = 'Eroare la sincronizare';
          if (errorObj?.message) {
            errorMsg = errorObj.message;
          } else if (errorObj?.graphQLErrors?.[0]?.message) {
            errorMsg = errorObj.graphQLErrors[0].message;
          }
          // Check for MS Graph specific errors
          if (errorMsg.includes('404') || errorMsg.includes('NotFound')) {
            errorMsg = 'Email-ul nu mai există în Outlook';
          } else if (errorMsg.includes('400')) {
            errorMsg = 'Email-ul nu mai este accesibil în Outlook';
          }
          setSyncError(errorMsg);
          return;
        }

        if (syncedData?.syncEmailAttachments) {
          console.log('[MessageView] Synced attachments:', syncedData.syncEmailAttachments);
          // Transform synced attachments to local format
          const syncedAttachments = syncedData.syncEmailAttachments.map((att: any) => ({
            id: att.id,
            name: att.name,
            size: att.size || 0,
            mimeType: att.contentType || 'application/octet-stream',
            url: att.downloadUrl || '',
          }));
          console.log('[MessageView] Transformed attachments:', syncedAttachments);
          if (syncedAttachments.length === 0) {
            setSyncError('Nu s-au găsit atașamente');
          } else {
            onAttachmentsSynced?.(message.id, syncedAttachments);
          }
        } else {
          console.log('[MessageView] No attachments in response');
          setSyncError('Nu s-au găsit atașamente');
        }
      } catch (error: any) {
        console.error('[MessageView] Failed to sync attachments:', error);
        // Try to extract meaningful error message
        const graphqlError = error?.graphQLErrors?.[0];
        const errorMessage =
          graphqlError?.message || error?.message || 'Nu s-au putut descărca atașamentele';
        console.error('[MessageView] Error details:', {
          graphqlError,
          message: errorMessage,
          fullError: JSON.stringify(error, null, 2),
        });
        setSyncError(errorMessage);
      } finally {
        setSyncingAttachments(false);
      }
    },
    [message.id, syncEmailAttachments, syncingAttachments, onAttachmentsSynced]
  );

  const handleReplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReply(threadId);
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onReply(threadId);
    }
  };

  // Check if we need to show "sync attachments" button
  const needsAttachmentSync = message.hasAttachments && message.attachments.length === 0;

  // OPS-091: Visual distinction for sent emails
  return (
    <div
      className={`border-b ${
        isSentByUser ? 'ml-8 border-l-4 border-l-blue-400 bg-blue-50/50 p-3' : 'p-4'
      }`}
    >
      <div className="flex items-start justify-between cursor-pointer" onClick={onToggle}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {isSentByUser && (
              <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                Dvs.
              </span>
            )}
            <div
              className={`rounded-full flex items-center justify-center text-sm ${
                isSentByUser ? 'w-6 h-6 bg-blue-400 text-white' : 'w-8 h-8 bg-blue-500 text-white'
              }`}
            >
              {message.senderName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className={`font-semibold ${isSentByUser ? 'text-xs' : 'text-sm'}`}>
                {message.senderName}
              </div>
              <div className="text-xs text-gray-500">{message.senderEmail}</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {message.sentDate && !isNaN(new Date(message.sentDate).getTime())
            ? format(new Date(message.sentDate), 'dd.MM.yyyy HH:mm')
            : '—'}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pl-10">
          {/* OPS-090: Toggle between clean and original content */}
          {message.bodyClean && (
            <div className="flex items-center gap-2 mb-2 text-xs">
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
                title={showOriginal ? 'Arată versiunea curată' : 'Arată originalul'}
              >
                {showOriginal ? (
                  <>
                    <FileText className="h-3.5 w-3.5" />
                    <span>Arată versiunea curată</span>
                  </>
                ) : (
                  <>
                    <FileCode className="h-3.5 w-3.5" />
                    <span>Arată originalul</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Render email content - use clean version by default if available */}
          {(() => {
            // Determine which content to show
            const displayCleanContent = message.bodyClean && !showOriginal;
            const contentToShow = displayCleanContent ? message.bodyClean : message.body;

            // Clean content is always plain text, render as-is
            if (displayCleanContent) {
              return <div className="text-sm whitespace-pre-wrap">{contentToShow}</div>;
            }

            // Original content: check if HTML or plain text
            if (contentToShow?.trim().startsWith('<')) {
              return (
                <iframe
                  srcDoc={contentToShow}
                  className="w-full min-h-[200px] border-0 bg-white"
                  sandbox="allow-same-origin"
                  title="Email content"
                  style={{ height: 'auto' }}
                  onLoad={(e) => {
                    // Auto-resize iframe to fit content
                    const iframe = e.target as HTMLIFrameElement;
                    if (iframe.contentDocument) {
                      iframe.style.height = iframe.contentDocument.body.scrollHeight + 20 + 'px';
                    }
                  }}
                />
              );
            }

            return <div className="text-sm whitespace-pre-wrap">{contentToShow}</div>;
          })()}
          {/* Show attachments if available */}
          {message.attachments.length > 0 && (
            <div className="mt-3 space-y-1">
              {message.attachments.map((att: any) => (
                <div key={att.id} className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate">
                    {att.name || att.filename || 'Attachment'}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({Math.round((att.size || att.fileSize || 0) / 1024)} KB)
                  </span>
                  {/* Preview button */}
                  <button
                    onClick={(e) => handlePreviewAttachment(e, att)}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Previzualizează"
                    aria-label="Previzualizează"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {/* Download button */}
                  <button
                    onClick={(e) => handleDownloadAttachment(e, att.id, att.name)}
                    disabled={downloadingId === att.id}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                    title="Descarcă"
                    aria-label="Descarcă"
                  >
                    {downloadingId === att.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Show sync button if message has attachments but they haven't been synced yet */}
          {needsAttachmentSync && (
            <div className="mt-3">
              {hasMsalAccount ? (
                <button
                  onClick={handleSyncAttachments}
                  disabled={syncingAttachments}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncingAttachments ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Se încarcă atașamentele...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Încarcă atașamentele</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReconnectMicrosoft?.();
                  }}
                  className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700"
                >
                  <Link2 className="h-4 w-4" />
                  <span>Conectează Microsoft pentru atașamente</span>
                </button>
              )}
              {syncError && <p className="text-xs text-red-500 mt-1">{syncError}</p>}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleReplyClick}
              onKeyDown={handleReplyKeyDown}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              aria-label="Răspunde la acest mesaj"
            >
              <Reply className="h-4 w-4" />
              <span>Răspunde</span>
            </button>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
        document={previewDocument}
        onRequestPreviewUrl={handleRequestPreviewUrl}
      />
    </div>
  );
}

export function MessageView() {
  const {
    getSelectedThread,
    expandedMessageIds,
    toggleMessageExpanded,
    expandAllMessages,
    collapseAllMessages,
    openCompose,
    threads,
    setThreads,
    selectThread,
    userEmail,
    // OPS-122: Attachment preview panel
    openPreviewPanel,
  } = useCommunicationStore();
  const { addNotification } = useNotificationStore();
  const { hasMsalAccount, reconnectMicrosoft } = useAuth();
  const thread = getSelectedThread();

  // Fetch user's cases for the assign modal
  const { cases: userCases, loading: casesLoading } = useMyCases();

  // Message display order: 'newest' shows newest first, 'oldest' shows oldest first
  const [messageOrder, setMessageOrder] = useState<'newest' | 'oldest'>('newest');

  // Modal state for assigning to case
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  // Modal state for notifying stakeholders
  const [showNotifyModal, setShowNotifyModal] = useState(false);

  // Mutations
  const [assignThreadToCase, { loading: assigning }] =
    useMutation<AssignThreadToCaseResult>(ASSIGN_THREAD_TO_CASE);
  const [ignoreEmailThread, { loading: ignoring }] =
    useMutation<IgnoreEmailThreadResult>(IGNORE_EMAIL_THREAD);

  // Handle when attachments are synced for a message
  // IMPORTANT: This hook must be called before any early returns to satisfy Rules of Hooks
  const handleAttachmentsSynced = useCallback(
    (messageId: string, attachments: any[]) => {
      const currentThread = getSelectedThread();
      if (!currentThread) return;

      const updatedThreads = threads.map((t) => {
        if (t.id !== currentThread.id) return t;
        return {
          ...t,
          messages: t.messages.map((m) => {
            if (m.id !== messageId) return m;
            return { ...m, attachments };
          }),
        };
      });
      setThreads(updatedThreads);
    },
    [threads, getSelectedThread, setThreads]
  );

  // OPS-122: Handle attachment preview (opens side panel)
  const handlePreviewAttachment = useCallback(
    (attachmentId: string, messageId: string) => {
      openPreviewPanel(attachmentId, messageId);
    },
    [openPreviewPanel]
  );

  // Handle assigning thread to case (OPS-125: updated for AssignThreadResult)
  const handleAssignToCase = async () => {
    const currentThread = getSelectedThread();
    if (!currentThread || !selectedCaseId) return;

    try {
      const result = await assignThreadToCase({
        variables: {
          conversationId: currentThread.conversationId,
          caseId: selectedCaseId,
        },
      });

      // Update local state with the assigned case (OPS-125: access via .thread)
      const assignedCase = result.data?.assignThreadToCase?.thread?.case;
      if (assignedCase) {
        const updatedThreads = threads.map((t) =>
          t.id === currentThread.id
            ? { ...t, caseId: assignedCase.id, caseName: assignedCase.title }
            : t
        );
        setThreads(updatedThreads);
      }

      setShowAssignModal(false);
      setSelectedCaseId('');
    } catch (error) {
      console.error('Failed to assign thread to case:', error);
    }
  };

  // Handle ignoring a thread (marking as not case-related)
  const handleIgnoreThread = async () => {
    const currentThread = getSelectedThread();
    if (!currentThread) return;

    try {
      await ignoreEmailThread({
        variables: {
          conversationId: currentThread.conversationId,
        },
      });

      // Remove from local threads list (or mark as ignored)
      const updatedThreads = threads.filter((t) => t.id !== currentThread.id);
      setThreads(updatedThreads);

      // Clear selection since thread is now hidden
      selectThread('');
    } catch (error) {
      console.error('Failed to ignore thread:', error);
    }
  };

  if (!thread) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Selectați o conversație</p>
      </div>
    );
  }

  // OPS-091: Show ALL messages including sent emails (user's own replies)
  // Previously filtered out sent emails, now we show them with visual distinction
  const allMessages = thread.messages;

  // Sort messages based on user preference
  const sortedMessages = [...allMessages].sort((a, b) => {
    const dateA =
      a.sentDate instanceof Date ? a.sentDate.getTime() : new Date(a.sentDate).getTime() || 0;
    const dateB =
      b.sentDate instanceof Date ? b.sentDate.getTime() : new Date(b.sentDate).getTime() || 0;
    return messageOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  // OPS-091: Count sent messages for display (not hidden, just marked differently)
  const sentMessageCount = userEmail
    ? allMessages.filter((m) => m.senderEmail?.toLowerCase() === userEmail.toLowerCase()).length
    : 0;

  const allExpanded = allMessages.every((m) => expandedMessageIds.has(m.id));
  const isUnassigned = !thread.caseId;

  const handleReply = (threadId: string) => {
    openCompose('reply', threadId);
  };

  const handleMarkAsProcessed = () => {
    if (thread) {
      // Update thread to mark as processed
      const updatedThreads = threads.map((t) =>
        t.id === thread.id ? { ...t, isProcessed: true, processedAt: new Date() } : t
      );
      setThreads(updatedThreads);

      // Show success toast notification
      addNotification({
        type: 'success',
        title: 'Comunicare procesată',
        message: 'Comunicarea a fost marcată ca procesată',
      });
    }
  };

  const toggleMessageOrder = () => {
    setMessageOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'));
  };

  // Calculate stats for processed decision
  const totalExtractedItems =
    (thread.extractedItems.deadlines?.length || 0) +
    (thread.extractedItems.commitments?.length || 0) +
    (thread.extractedItems.actionItems?.length || 0);

  // For prototype, we can't track converted items across components
  // In production, this would be tracked in the store
  const unconvertedCount = totalExtractedItems;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 bg-white space-y-3">
        <div>
          <h2 className="font-semibold text-lg mb-1">{thread.subject}</h2>
          <div className="text-sm text-gray-600">
            {thread.caseName} • {allMessages.length} mesaje
            {sentMessageCount > 0 && (
              <span className="text-blue-500 ml-1">
                ({sentMessageCount} {sentMessageCount === 1 ? 'trimis' : 'trimise'})
              </span>
            )}
          </div>
        </div>

        {/* Unassigned email banner */}
        {isUnassigned && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 mb-2">
              Această conversație nu este asociată cu un dosar.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAssignModal(true)}
                disabled={assigning}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <FolderInput className="h-4 w-4" />
                Atribuie la dosar
              </button>
              <button
                onClick={handleIgnoreThread}
                disabled={ignoring}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {ignoring ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
                Ignoră
              </button>
            </div>
          </div>
        )}

        {/* Processing Stats */}
        {unconvertedCount > 0 && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <p className="text-yellow-800">
              ⚠️ Au mai rămas {unconvertedCount} elemente neconvertite
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMessageOrder}
            className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
            title={
              messageOrder === 'newest'
                ? 'Sortare: cele mai noi primele'
                : 'Sortare: cele mai vechi primele'
            }
          >
            <ArrowUpDown className="h-4 w-4" />
            {messageOrder === 'newest' ? 'Noi → Vechi' : 'Vechi → Noi'}
          </button>
          <button
            onClick={allExpanded ? collapseAllMessages : expandAllMessages}
            className="text-sm text-blue-600 hover:underline"
          >
            {allExpanded ? 'Restrânge tot' : 'Extinde tot'}
          </button>
          {/* Notify stakeholders button - only when assigned to a case */}
          {!isUnassigned && (
            <button
              onClick={() => setShowNotifyModal(true)}
              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-1.5"
              title="Trimite o notificare părților interesate"
            >
              <Users className="h-4 w-4" />
              Notifică părțile
            </button>
          )}
          <button
            onClick={handleMarkAsProcessed}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Marchează ca Procesat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {sortedMessages.map((message, index) => (
          <Message
            key={message.id}
            onAttachmentsSynced={handleAttachmentsSynced}
            message={message}
            threadId={thread.id}
            isExpanded={expandedMessageIds.has(message.id)}
            onToggle={() => toggleMessageExpanded(message.id)}
            onReply={handleReply}
            isCollapsed={!expandedMessageIds.has(message.id) && index > 0}
            hasMsalAccount={hasMsalAccount}
            onReconnectMicrosoft={reconnectMicrosoft}
            isSentByUser={(message as any).folderType === 'sent'}
            onPreviewAttachment={handlePreviewAttachment}
          />
        ))}
      </div>

      {/* Assign to Case Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg">Atribuie la dosar</h3>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedCaseId('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Selectați dosarul la care doriți să atribuiți această conversație.
              </p>
              {casesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : userCases.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  Nu aveți dosare disponibile.
                </p>
              ) : (
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selectați un dosar...</option>
                  {userCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.caseNumber} - {c.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedCaseId('');
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Anulează
              </button>
              <button
                onClick={handleAssignToCase}
                disabled={!selectedCaseId || assigning}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
                Atribuie
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notify Stakeholders Modal */}
      {showNotifyModal && (
        <NotifyStakeholdersModal thread={thread} onClose={() => setShowNotifyModal(false)} />
      )}
    </div>
  );
}
