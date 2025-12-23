'use client';

/**
 * ConversationView Component
 * OPS-121: Conversation-first thread view for chat-style email display
 *
 * Displays email threads as a flowing conversation with chat-style bubbles.
 * All messages are visible by default (no expand/collapse needed).
 * Sent messages are right-aligned with blue styling, received left-aligned.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Reply, Loader2, FolderInput, EyeOff, X, Users } from 'lucide-react';
import { gql } from '@apollo/client';
import { useMutation, useLazyQuery } from '@apollo/client/react';
import { ConversationBubble } from './ConversationBubble';
import { ConversationHeader } from './ConversationHeader';
import { DocumentPreviewModal, type PreviewableDocument } from '@/components/preview';
import { NotifyStakeholdersModal } from './NotifyStakeholdersModal';
import { useCommunicationStore } from '../../stores/communication.store';
import { useNotificationStore } from '../../stores/notificationStore';
import { useMyCases } from '../../hooks/useMyCases';

// ============================================================================
// GraphQL Operations
// ============================================================================

const GET_ATTACHMENT_PREVIEW_URL = gql`
  query GetAttachmentPreviewUrl($attachmentId: ID!) {
    attachmentPreviewUrl(attachmentId: $attachmentId) {
      url
      source
      expiresAt
    }
  }
`;

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

const IGNORE_EMAIL_THREAD = gql`
  mutation IgnoreEmailThread($conversationId: String!) {
    ignoreEmailThread(conversationId: $conversationId) {
      id
      conversationId
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface Attachment {
  id: string;
  name?: string;
  filename?: string;
  size?: number;
  fileSize?: number;
  mimeType?: string;
  contentType?: string;
  url?: string;
  downloadUrl?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ConversationView() {
  const { getSelectedThread, openCompose, threads, setThreads, selectThread, userEmail } =
    useCommunicationStore();
  const { addNotification } = useNotificationStore();
  const thread = getSelectedThread();

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // State
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PreviewableDocument | null>(null);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [showNotifyModal, setShowNotifyModal] = useState(false);

  // GraphQL
  const [fetchAttachmentContent] = useLazyQuery(GET_ATTACHMENT_CONTENT, {
    fetchPolicy: 'network-only',
  });
  const [fetchPreviewUrl] = useLazyQuery(GET_ATTACHMENT_PREVIEW_URL, {
    fetchPolicy: 'network-only',
  });
  const [assignThreadToCase, { loading: assigning }] = useMutation(ASSIGN_THREAD_TO_CASE);
  const [ignoreEmailThread, { loading: ignoring }] = useMutation(IGNORE_EMAIL_THREAD);

  // Hooks
  const { cases: userCases, loading: casesLoading } = useMyCases();

  // Auto-scroll to bottom when thread changes or new messages arrive
  useEffect(() => {
    if (thread && messagesEndRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [thread?.id, thread?.messages.length]);

  // Handlers
  const handleReply = useCallback(() => {
    if (thread) {
      openCompose('reply', thread.id);
    }
  }, [thread, openCompose]);

  const handleAttachmentClick = useCallback((attachment: Attachment, messageId: string) => {
    setCurrentMessageId(messageId);
    setPreviewDocument({
      id: attachment.id,
      name: attachment.name || attachment.filename || 'Atașament',
      contentType: attachment.mimeType || attachment.contentType || 'application/octet-stream',
      size: attachment.size || attachment.fileSize || 0,
      downloadUrl: attachment.url || attachment.downloadUrl || null,
      previewUrl: null,
      emailId: messageId,
    } as PreviewableDocument & { emailId?: string });
  }, []);

  const handleDownloadAttachment = useCallback(
    async (attachmentId: string, attachmentName: string) => {
      if (downloadingId || !currentMessageId) return;
      setDownloadingId(attachmentId);

      try {
        const result = await fetchAttachmentContent({
          variables: { emailId: currentMessageId, attachmentId },
        });

        const data = (result.data as any)?.emailAttachmentContent;
        if (data?.content) {
          const byteCharacters = atob(data.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: data.contentType });

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
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: 'Nu s-a putut descărca fișierul',
        });
      } finally {
        setDownloadingId(null);
      }
    },
    [currentMessageId, fetchAttachmentContent, downloadingId, addNotification]
  );

  const handleRequestPreviewUrl = useCallback(
    async (attachmentId: string): Promise<string | null> => {
      try {
        const result = await fetchPreviewUrl({
          variables: { attachmentId },
        });
        const data = result.data as { attachmentPreviewUrl?: { url: string } } | undefined;

        if (data?.attachmentPreviewUrl?.url) {
          return data.attachmentPreviewUrl.url;
        }

        // Fallback: Fetch content directly from MS Graph
        const emailId = currentMessageId;
        if (!emailId) return null;

        const contentResult = await fetchAttachmentContent({
          variables: { emailId, attachmentId },
        });

        const contentData = (contentResult.data as any)?.emailAttachmentContent;
        if (contentData?.content) {
          const byteCharacters = atob(contentData.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], {
            type: contentData.contentType || 'application/octet-stream',
          });

          return URL.createObjectURL(blob);
        }

        return null;
      } catch (error) {
        console.error('Failed to fetch preview URL:', error);
        return null;
      }
    },
    [fetchPreviewUrl, fetchAttachmentContent, currentMessageId]
  );

  const handleAssignToCase = useCallback(async () => {
    if (!thread || !selectedCaseId) return;

    try {
      const result = await assignThreadToCase({
        variables: {
          conversationId: thread.conversationId,
          caseId: selectedCaseId,
        },
      });

      const data = result.data as {
        assignThreadToCase?: {
          thread?: { case?: { id: string; title: string } };
          newContactAdded?: boolean;
          contactName?: string;
          contactEmail?: string;
        };
      };
      const assignResult = data?.assignThreadToCase;
      const assignedCase = assignResult?.thread?.case;

      if (assignedCase) {
        const updatedThreads = threads.map((t) =>
          t.id === thread.id ? { ...t, caseId: assignedCase.id, caseName: assignedCase.title } : t
        );
        setThreads(updatedThreads);
      }

      setShowAssignModal(false);
      setSelectedCaseId('');

      // OPS-125: Show different toast if contact was auto-added
      if (assignResult?.newContactAdded && assignResult?.contactEmail) {
        addNotification({
          type: 'success',
          title: 'Conversație atribuită',
          message: `Contactul ${assignResult.contactName || assignResult.contactEmail} a fost adăugat automat la dosar`,
        });
      } else {
        addNotification({
          type: 'success',
          title: 'Succes',
          message: 'Conversația a fost atribuită dosarului',
        });
      }
    } catch (error) {
      console.error('Failed to assign thread to case:', error);
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Nu s-a putut atribui conversația',
      });
    }
  }, [thread, selectedCaseId, assignThreadToCase, threads, setThreads, addNotification]);

  const handleIgnoreThread = useCallback(async () => {
    if (!thread) return;

    try {
      await ignoreEmailThread({
        variables: {
          conversationId: thread.conversationId,
        },
      });

      const updatedThreads = threads.filter((t) => t.id !== thread.id);
      setThreads(updatedThreads);
      selectThread('');
      addNotification({
        type: 'success',
        title: 'Succes',
        message: 'Conversația a fost ignorată',
      });
    } catch (error) {
      console.error('Failed to ignore thread:', error);
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Nu s-a putut ignora conversația',
      });
    }
  }, [thread, ignoreEmailThread, threads, setThreads, selectThread, addNotification]);

  const handleMarkAsProcessed = useCallback(() => {
    if (thread) {
      const updatedThreads = threads.map((t) =>
        t.id === thread.id ? { ...t, isProcessed: true, processedAt: new Date() } : t
      );
      setThreads(updatedThreads);
      addNotification({
        type: 'success',
        title: 'Comunicare procesată',
        message: 'Comunicarea a fost marcată ca procesată',
      });
    }
  }, [thread, threads, setThreads, addNotification]);

  // Empty state
  if (!thread) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Selectați o conversație</p>
      </div>
    );
  }

  // Sort messages chronologically (oldest first for conversation flow)
  const sortedMessages = [...thread.messages].sort((a, b) => {
    const dateA =
      a.sentDate instanceof Date ? a.sentDate.getTime() : new Date(a.sentDate).getTime() || 0;
    const dateB =
      b.sentDate instanceof Date ? b.sentDate.getTime() : new Date(b.sentDate).getTime() || 0;
    return dateA - dateB;
  });

  // Count sent messages
  const sentCount = userEmail
    ? sortedMessages.filter((m) => m.senderEmail?.toLowerCase() === userEmail.toLowerCase()).length
    : 0;

  const isUnassigned = !thread.caseId;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <ConversationHeader
        thread={thread}
        sentCount={sentCount}
        totalCount={sortedMessages.length}
        userEmail={userEmail}
      />

      {/* Unassigned email banner */}
      {isUnassigned && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 mb-2">
            Această conversație nu este asociată cu un dosar.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAssignModal(true)}
              disabled={assigning}
              className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <FolderInput className="h-4 w-4" />
              Atribuie la dosar
            </button>
            <button
              onClick={handleIgnoreThread}
              disabled={ignoring}
              className="px-3 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
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

      {/* Messages - Chat style */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {sortedMessages.map((message) => {
          // OPS-126: Use folderType as authoritative source for direction
          // 'sent' folder means user sent it, anything else means received
          const isSent = (message as any).folderType === 'sent';

          return (
            <ConversationBubble
              key={message.id}
              message={message}
              isSent={isSent}
              onAttachmentClick={(att) => handleAttachmentClick(att, message.id)}
              onDownloadAttachment={handleDownloadAttachment}
              downloadingId={downloadingId}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply bar */}
      <div className="border-t bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleReply}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors font-medium"
          >
            <Reply className="h-4 w-4" />
            Răspunde
          </button>
          {!isUnassigned && (
            <>
              <button
                onClick={() => setShowNotifyModal(true)}
                className="px-3 py-2.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
                title="Notifică părțile"
              >
                <Users className="h-5 w-5" />
              </button>
              <button
                onClick={handleMarkAsProcessed}
                className="px-4 py-2.5 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
              >
                Marchează ca procesat
              </button>
            </>
          )}
        </div>
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

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
        document={previewDocument}
        onRequestPreviewUrl={handleRequestPreviewUrl}
      />

      {/* Notify Stakeholders Modal */}
      {showNotifyModal && (
        <NotifyStakeholdersModal thread={thread} onClose={() => setShowNotifyModal(false)} />
      )}
    </div>
  );
}

ConversationView.displayName = 'ConversationView';
