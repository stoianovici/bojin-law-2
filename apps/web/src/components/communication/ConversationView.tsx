'use client';

/**
 * ConversationView Component
 * OPS-121: Conversation-first thread view for chat-style email display
 * OPS-194: Partner privacy UI + case details filter
 * OPS-196: NECLAR inline assignment with SplitAssignmentButton
 *
 * Displays email threads as a flowing conversation with chat-style bubbles.
 * All messages are visible by default (no expand/collapse needed).
 * Sent messages are right-aligned with blue styling, received left-aligned.
 *
 * In NECLAR mode (neclarMode=true), shows inline assignment buttons instead of reply buttons.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Reply,
  Forward,
  Users,
  Loader2,
  FolderInput,
  X,
  Ban,
  ExternalLink,
  Lock,
  LockOpen,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { gql } from '@apollo/client';
import { useMutation, useLazyQuery } from '@apollo/client/react';
import { ConversationBubble } from './ConversationBubble';
import { ConversationHeader } from './ConversationHeader';
import { SplitAssignmentButton, type CaseSuggestion } from './SplitAssignmentButton';
import { CasePickerDropup } from './CasePickerDropup';
import { NotifyStakeholdersModal } from './NotifyStakeholdersModal';
import { DocumentPreviewModal, type PreviewableDocument } from '@/components/preview';
import { useCommunicationStore } from '../../stores/communication.store';
import { useNotificationStore } from '../../stores/notificationStore';
import { useMyCases } from '../../hooks/useMyCases';
import { useEmailPrivacy } from '../../hooks/useEmailPrivacy';
import { useAuth } from '../../contexts/AuthContext';
import { openOutlookCompose, openOutlookReply } from '../../utils/outlook';

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

// OPS-196: Mutation for classifying uncertain emails (NECLAR)
const CLASSIFY_UNCERTAIN_EMAIL = gql`
  mutation ClassifyUncertainEmail($emailId: ID!, $action: ClassificationActionInput!) {
    classifyUncertainEmail(emailId: $emailId, action: $action) {
      email {
        id
        classificationState
      }
      case {
        id
        title
        caseNumber
      }
      wasIgnored
    }
  }
`;

// OPS-196: Mutation for marking sender as personal contact
const MARK_SENDER_AS_PERSONAL = gql`
  mutation MarkSenderAsPersonal($emailId: ID!, $ignoreEmail: Boolean) {
    markSenderAsPersonal(emailId: $emailId, ignoreEmail: $ignoreEmail) {
      id
      email
      createdAt
    }
  }
`;

// OPS-195: Mutation for confirming email assignment (multi-case confirmation flow)
const CONFIRM_EMAIL_ASSIGNMENT = gql`
  mutation ConfirmEmailAssignment($emailId: ID!, $caseId: ID!) {
    confirmEmailAssignment(emailId: $emailId, caseId: $caseId) {
      email {
        id
        caseLinks {
          id
          caseId
          isConfirmed
          needsConfirmation
          case {
            id
            title
            caseNumber
          }
        }
      }
      caseLink {
        id
        isConfirmed
        confirmedAt
      }
      wasReassigned
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

// OPS-196: Props for NECLAR mode
interface NeclarEmailData {
  id: string;
  conversationId?: string;
  suggestedCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    score: number;
  }>;
}

// OPS-195: Case link with confirmation state
interface CaseLinkData {
  id: string;
  caseId: string;
  isConfirmed: boolean;
  needsConfirmation: boolean;
  isPrimary?: boolean;
  confidence?: number;
  case: {
    id: string;
    title: string;
    caseNumber: string;
  };
}

interface ConversationViewProps {
  /** OPS-196: When true, show assignment UI instead of reply UI */
  neclarMode?: boolean;
  /** OPS-196: Data for NECLAR email including suggested cases */
  neclarData?: NeclarEmailData | null;
  /** OPS-196: Callback when NECLAR email is assigned or sender marked as personal */
  onNeclarAssigned?: () => void;
  /** OPS-195: Unconfirmed case link data when sender has multiple cases */
  unconfirmedCaseLink?: CaseLinkData | null;
  /** OPS-195: Alternative case suggestions for multi-case confirmation */
  alternativeCases?: CaseLinkData[] | null;
  /** OPS-195: Callback when assignment is confirmed */
  onConfirmed?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function ConversationView({
  neclarMode = false,
  neclarData = null,
  onNeclarAssigned,
  unconfirmedCaseLink = null,
  alternativeCases = null,
  onConfirmed,
}: ConversationViewProps) {
  // OPS-203: Restored openCompose for in-app AI draft compose
  const { getSelectedThread, threads, setThreads, userEmail, openCompose } =
    useCommunicationStore();
  const { addNotification } = useNotificationStore();
  const { user } = useAuth();
  const thread = getSelectedThread();

  // OPS-194: Privacy state - check if any message in thread is private
  const threadIsPrivate = thread?.messages.some((m) => (m as any).isPrivate) ?? false;
  const {
    canToggle: canTogglePrivacy,
    loading: privacyLoading,
    toggleThreadPrivacy,
  } = useEmailPrivacy({
    conversationId: thread?.conversationId,
    isCurrentlyPrivate: threadIsPrivate,
    onToggled: (isPrivate) => {
      // Update local thread state to reflect privacy change
      if (thread) {
        const updatedThreads = threads.map((t) =>
          t.id === thread.id
            ? {
                ...t,
                messages: t.messages.map((m) => ({
                  ...m,
                  isPrivate,
                  markedPrivateBy: isPrivate ? user?.id : null,
                })),
              }
            : t
        );
        setThreads(updatedThreads as any);
      }
    },
  });

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // State
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PreviewableDocument | null>(null);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  // OPS-203: Restored NotifyStakeholdersModal for assigned emails
  const [showNotifyModal, setShowNotifyModal] = useState(false);

  // GraphQL
  const [fetchAttachmentContent] = useLazyQuery(GET_ATTACHMENT_CONTENT, {
    fetchPolicy: 'network-only',
  });
  const [fetchPreviewUrl] = useLazyQuery(GET_ATTACHMENT_PREVIEW_URL, {
    fetchPolicy: 'network-only',
  });
  const [assignThreadToCase, { loading: assigning }] = useMutation(ASSIGN_THREAD_TO_CASE);
  // Note: ignoreEmailThread mutation removed per OPS-204 - NECLAR uses "Privat" instead
  // OPS-196: NECLAR mutations
  const [classifyUncertainEmail, { loading: classifying }] = useMutation(CLASSIFY_UNCERTAIN_EMAIL);
  const [markSenderAsPersonalMutation, { loading: markingPersonal }] =
    useMutation(MARK_SENDER_AS_PERSONAL);
  // OPS-195: Multi-case confirmation mutation
  const [confirmEmailAssignment, { loading: confirming }] = useMutation(CONFIRM_EMAIL_ASSIGNMENT);

  // OPS-196: Track if NECLAR assignment completed (for transition to reply mode)
  const [neclarAssigned, setNeclarAssigned] = useState(false);
  // OPS-195: Track if assignment confirmed (for enabling reply)
  const [isConfirmed, setIsConfirmed] = useState(!unconfirmedCaseLink);

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
  // OPS-203: Open ComposeInterface with AI draft panel for replies
  const handleReply = useCallback(() => {
    if (thread) {
      openCompose('reply', thread.id);
    }
  }, [thread, openCompose]);

  // OPS-203: Open ComposeInterface in forward mode
  const handleForward = useCallback(() => {
    if (thread) {
      openCompose('forward', thread.id);
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

  // OPS-203: Removed handleMarkAsProcessed - button removed from action bar

  // OPS-194: Handle privacy toggle
  const handleTogglePrivacy = useCallback(async () => {
    if (!thread || !canTogglePrivacy || !thread.conversationId) return;
    await toggleThreadPrivacy(thread.conversationId, threadIsPrivate);
  }, [thread, canTogglePrivacy, toggleThreadPrivacy, threadIsPrivate]);

  // OPS-204: Handle NECLAR reply via Outlook
  const handleNeclarReply = useCallback(() => {
    if (thread && thread.messages.length > 0) {
      // Get the last received message to reply to
      const lastMessage = thread.messages[thread.messages.length - 1];
      const senderEmail = lastMessage.senderEmail || '';
      const subject = thread.subject || '';
      openOutlookReply(senderEmail, subject);
    }
  }, [thread]);

  // OPS-196: Handle NECLAR assignment to case
  const handleNeclarAssign = useCallback(
    async (caseId: string) => {
      if (!neclarData) return;

      try {
        const result = await classifyUncertainEmail({
          variables: {
            emailId: neclarData.id,
            action: { type: 'ASSIGN_TO_CASE', caseId },
          },
        });

        const data = result.data as {
          classifyUncertainEmail?: {
            case?: { id: string; title: string; caseNumber: string };
          };
        };
        const assignedCase = data?.classifyUncertainEmail?.case;

        setNeclarAssigned(true);
        addNotification({
          type: 'success',
          title: 'Email atribuit',
          message: assignedCase
            ? `Email atribuit la ${assignedCase.caseNumber}`
            : 'Email clasificat cu succes',
        });

        // Notify parent that assignment is complete
        onNeclarAssigned?.();
      } catch (error) {
        console.error('Failed to classify uncertain email:', error);
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: 'Nu s-a putut atribui email-ul',
        });
      }
    },
    [neclarData, classifyUncertainEmail, addNotification, onNeclarAssigned]
  );

  // OPS-204: Removed handleNeclarIgnore - NECLAR emails use "Privat" to block sender instead

  // OPS-196: Handle marking sender as personal contact
  const handleMarkSenderAsPersonal = useCallback(async () => {
    if (!neclarData) return;

    try {
      await markSenderAsPersonalMutation({
        variables: {
          emailId: neclarData.id,
          ignoreEmail: true, // Also ignore the email
        },
      });

      addNotification({
        type: 'success',
        title: 'Contact personal adăugat',
        message: 'Expeditorul a fost adăugat la contactele personale și email-ul va fi ignorat',
      });

      onNeclarAssigned?.();
    } catch (error) {
      console.error('Failed to mark sender as personal:', error);
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Nu s-a putut marca expeditorul ca personal',
      });
    }
  }, [neclarData, markSenderAsPersonalMutation, addNotification, onNeclarAssigned]);

  // OPS-195: Handle multi-case confirmation
  const handleConfirmAssignment = useCallback(
    async (caseId: string) => {
      if (!thread?.messages?.[0]?.id) return;

      const emailId = thread.messages[0].id; // Use first email in thread

      try {
        await confirmEmailAssignment({
          variables: { emailId, caseId },
        });

        setIsConfirmed(true);
        addNotification({
          type: 'success',
          title: 'Atribuire confirmată',
          message: 'Email-ul a fost confirmat la dosar',
        });

        onConfirmed?.();
      } catch (error) {
        console.error('Failed to confirm email assignment:', error);
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: 'Nu s-a putut confirma atribuirea',
        });
      }
    },
    [thread, confirmEmailAssignment, addNotification, onConfirmed]
  );

  // OPS-196: Prepare suggested cases for SplitAssignmentButton
  const neclarSuggestions: CaseSuggestion[] =
    neclarData?.suggestedCases.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      confidence: c.score / 100, // Convert score (0-100) to confidence (0-1)
    })) || [];
  // Get primary and secondary case suggestions for SplitAssignmentButton
  const primaryCase = neclarSuggestions[0];
  const secondaryCase = neclarSuggestions[1];

  // OPS-195: Check if confirmation is needed
  const needsConfirmation = !!unconfirmedCaseLink && !isConfirmed;

  // Empty state
  if (!thread) {
    return (
      <div className="flex items-center justify-center h-full text-linear-text-tertiary">
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
    <div className="flex flex-col h-full bg-linear-bg-tertiary">
      {/* Header - OPS-201: Added new compose button */}
      <ConversationHeader
        thread={thread}
        sentCount={sentCount}
        totalCount={sortedMessages.length}
        userEmail={userEmail}
        onNewCompose={openOutlookCompose}
      />

      {/* OPS-194: Private email indicator banner */}
      {threadIsPrivate && (
        <div className="mx-4 mt-3 p-3 bg-linear-accent/10 border border-linear-accent/30 rounded-lg flex items-center gap-2">
          <Lock className="h-4 w-4 text-linear-accent flex-shrink-0" />
          <p className="text-sm text-linear-accent">
            Această conversație este privată (doar pentru tine)
          </p>
        </div>
      )}

      {/* Unassigned email banner */}
      {isUnassigned && (
        <div className="mx-4 mt-3 p-3 bg-linear-warning/10 border border-linear-warning/30 rounded-lg">
          <p className="text-sm text-linear-warning mb-2">
            Această conversație nu este asociată cu un dosar.
          </p>
          <button
            onClick={() => setShowAssignModal(true)}
            disabled={assigning}
            className="px-3 py-1.5 text-sm bg-linear-warning text-white rounded hover:bg-linear-warning/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <FolderInput className="h-4 w-4" />
            Atribuie la dosar
          </button>
        </div>
      )}

      {/* OPS-195: Multi-case confirmation banner */}
      {needsConfirmation && unconfirmedCaseLink && (
        <div className="mx-4 mt-3 p-3 bg-linear-warning/10 border border-linear-warning/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-linear-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-linear-warning mb-1">
                Confirmați dosarul pentru acest email
              </p>
              <p className="text-sm text-linear-warning/80 mb-3">
                Expeditorul are mai multe dosare active. Confirmați dosarul corect înainte de a
                răspunde.
              </p>
              <div className="flex flex-wrap gap-2">
                {/* Primary suggestion - confirm current assignment */}
                <button
                  onClick={() => handleConfirmAssignment(unconfirmedCaseLink.case.id)}
                  disabled={confirming}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-linear-warning text-white rounded-lg hover:bg-linear-warning/90 transition-colors disabled:opacity-50"
                >
                  {confirming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {unconfirmedCaseLink.case.caseNumber}
                </button>

                {/* Alternative cases */}
                {alternativeCases?.slice(0, 3).map((alt) => (
                  <button
                    key={alt.case.id}
                    onClick={() => handleConfirmAssignment(alt.case.id)}
                    disabled={confirming}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-linear-bg-secondary text-linear-warning border border-linear-warning/30 rounded-lg hover:bg-linear-warning/10 transition-colors disabled:opacity-50"
                  >
                    {alt.case.caseNumber}
                  </button>
                ))}

                {/* Show more - link to full case list */}
                {(alternativeCases?.length ?? 0) > 3 && (
                  <span className="text-sm text-linear-warning self-center">
                    +{(alternativeCases?.length ?? 0) - 3} altele
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages - Chat style */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {sortedMessages.map((message, index) => {
          // OPS-126: Use folderType as authoritative source for direction
          // 'sent' folder means user sent it, anything else means received
          const isSent = (message as any).folderType === 'sent';

          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.2,
                delay: Math.min(index * 0.03, 0.3), // Cap delay at 300ms for long threads
              }}
            >
              <ConversationBubble
                message={message}
                isSent={isSent}
                onAttachmentClick={(att) => handleAttachmentClick(att, message.id)}
                onDownloadAttachment={handleDownloadAttachment}
                downloadingId={downloadingId}
              />
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Action bar - OPS-192/OPS-196: NECLAR mode vs normal mode */}
      <AnimatePresence mode="wait">
        {neclarMode && !neclarAssigned ? (
          /* OPS-196: NECLAR mode action bar with SplitAssignmentButton */
          <motion.div
            key="neclar-actions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border-t border-linear-border-subtle bg-linear-warning/10 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              {/* OPS-204/OPS-206: SplitAssignmentButton or CasePickerDropup */}
              <div className="flex-1">
                {primaryCase ? (
                  <SplitAssignmentButton
                    primaryCase={primaryCase}
                    secondaryCase={secondaryCase}
                    allSuggestions={neclarSuggestions}
                    onAssign={handleNeclarAssign}
                    onPersonal={handleMarkSenderAsPersonal}
                    loading={classifying}
                    disabled={classifying || markingPersonal}
                  />
                ) : (
                  /* OPS-206: CasePickerDropup for emails without suggestions */
                  <CasePickerDropup
                    onSelect={handleNeclarAssign}
                    loading={classifying}
                    disabled={classifying || markingPersonal}
                  />
                )}
              </div>

              {/* OPS-204: Răspunde button - opens Outlook reply */}
              <button
                onClick={handleNeclarReply}
                disabled={classifying || markingPersonal}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-linear-border text-linear-text-secondary rounded-full hover:bg-linear-bg-secondary transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Reply className="h-4 w-4" />
                Răspunde
                <ExternalLink className="h-3 w-3 opacity-70" />
              </button>

              {/* OPS-204: Privat button - blocks sender from future sync */}
              <button
                onClick={handleMarkSenderAsPersonal}
                disabled={markingPersonal || classifying}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-linear-border text-linear-text-secondary rounded-full hover:bg-linear-bg-secondary transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {markingPersonal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                Privat
              </button>
            </div>
          </motion.div>
        ) : (
          /* OPS-203: Normal mode action bar - Răspunde (ComposeInterface), Forward, Notify, Privat */
          <motion.div
            key="normal-actions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border-t border-linear-border-subtle bg-linear-bg-secondary px-4 py-3"
          >
            <div className="flex items-center gap-3">
              {/* OPS-203: Răspunde button - opens ComposeInterface with AI draft panel */}
              {/* OPS-195: Disabled when confirmation is needed */}
              <button
                onClick={handleReply}
                disabled={needsConfirmation}
                title={needsConfirmation ? 'Confirmați dosarul înainte de a răspunde' : undefined}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full transition-colors font-medium ${
                  needsConfirmation
                    ? 'bg-linear-bg-hover text-linear-text-muted cursor-not-allowed'
                    : 'bg-linear-accent text-white hover:bg-linear-accent-hover'
                }`}
              >
                <Reply className="h-4 w-4" />
                {needsConfirmation ? 'Confirmați dosarul' : 'Răspunde'}
              </button>

              {/* OPS-203: Forward button - opens ComposeInterface in forward mode */}
              <button
                onClick={handleForward}
                disabled={needsConfirmation}
                title={
                  needsConfirmation ? 'Confirmați dosarul înainte de a redirecționa' : undefined
                }
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full transition-colors font-medium ${
                  needsConfirmation
                    ? 'bg-linear-bg-tertiary text-linear-text-muted cursor-not-allowed'
                    : 'border border-linear-border text-linear-text-secondary hover:bg-linear-bg-hover'
                }`}
              >
                <Forward className="h-4 w-4" />
                Forward
              </button>

              {/* OPS-203: Notify button - opens NotifyStakeholdersModal */}
              <button
                onClick={() => setShowNotifyModal(true)}
                disabled={needsConfirmation}
                title={needsConfirmation ? 'Confirmați dosarul înainte de a notifica' : undefined}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full transition-colors font-medium ${
                  needsConfirmation
                    ? 'bg-linear-bg-tertiary text-linear-text-muted cursor-not-allowed'
                    : 'border border-linear-border text-linear-text-secondary hover:bg-linear-bg-hover'
                }`}
              >
                <Users className="h-4 w-4" />
                Notify
              </button>

              {/* OPS-194: Privacy toggle - only for partners */}
              {canTogglePrivacy && (
                <button
                  onClick={handleTogglePrivacy}
                  disabled={privacyLoading}
                  title={
                    threadIsPrivate
                      ? 'Anulează marcarea ca privat'
                      : 'Marchează conversația ca privată (doar pentru tine)'
                  }
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full transition-colors font-medium ${
                    threadIsPrivate
                      ? 'bg-linear-accent/15 text-linear-accent hover:bg-linear-accent/25'
                      : 'border border-linear-border text-linear-text-secondary hover:bg-linear-bg-hover'
                  } ${privacyLoading ? 'opacity-50 cursor-wait' : ''}`}
                >
                  {privacyLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : threadIsPrivate ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <LockOpen className="h-4 w-4" />
                  )}
                  {threadIsPrivate ? 'Privat' : 'Privat'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign to Case Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-linear-bg-secondary rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-linear-border-subtle">
              <h3 className="font-semibold text-lg text-linear-text-primary">Atribuie la dosar</h3>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedCaseId('');
                }}
                className="text-linear-text-muted hover:text-linear-text-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-linear-text-secondary mb-4">
                Selectați dosarul la care doriți să atribuiți această conversație.
              </p>
              {casesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-linear-accent" />
                </div>
              ) : userCases.length === 0 ? (
                <p className="text-sm text-linear-text-tertiary py-4 text-center">
                  Nu aveți dosare disponibile.
                </p>
              ) : (
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full px-3 py-2 border border-linear-border-subtle bg-linear-bg-tertiary rounded-lg focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent"
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
            <div className="flex items-center justify-end gap-3 p-4 border-t border-linear-border-subtle bg-linear-bg-tertiary">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedCaseId('');
                }}
                className="px-4 py-2 text-sm text-linear-text-secondary hover:text-linear-text-primary"
              >
                Anulează
              </button>
              <button
                onClick={handleAssignToCase}
                disabled={!selectedCaseId || assigning}
                className="px-4 py-2 text-sm bg-linear-accent text-white rounded hover:bg-linear-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

      {/* OPS-203: NotifyStakeholdersModal for assigned emails */}
      {showNotifyModal && thread && (
        <NotifyStakeholdersModal thread={thread} onClose={() => setShowNotifyModal(false)} />
      )}
    </div>
  );
}

ConversationView.displayName = 'ConversationView';
