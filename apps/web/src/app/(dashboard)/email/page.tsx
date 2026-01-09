'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useLazyQuery } from '@apollo/client/react';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  EmailCaseSidebar,
  EmailConversationView,
  AttachmentListPanel,
  ComposeEmailModal,
  CaseAssignmentModal,
} from '@/components/email';
import { DocumentPreviewModal } from '@/components/documents';
import { useEmailStore } from '@/store/emailStore';
import { useUIStore } from '@/store/uiStore';
import { useEmailsByCase } from '@/hooks/useEmailsByCase';
import { useEmailThread } from '@/hooks/useEmailThread';
import { useEmailSync } from '@/hooks/useEmailSync';
import { useAiEmailDraft } from '@/hooks/useAiEmailDraft';
import { useAuth } from '@/hooks/useAuth';
import { apolloClient } from '@/lib/apollo-client';
import {
  SEND_EMAIL,
  REPLY_TO_EMAIL,
  CLASSIFY_UNCERTAIN_EMAIL,
  MARK_SENDER_AS_PERSONAL,
  ASSIGN_THREAD_TO_CASE,
  MARK_THREAD_AS_PERSONAL,
  UNMARK_THREAD_AS_PERSONAL,
  IS_THREAD_PERSONAL,
  GET_ATTACHMENT_PREVIEW_URL,
  GET_ATTACHMENT_CONTENT,
} from '@/graphql/queries';
import type { Attachment } from '@/types/email';
import type { PreviewDocument } from '@/components/documents/DocumentPreviewModal';
import { getFileType } from '@/types/document';

export default function EmailPage() {
  // UI store state for context panel awareness
  const { sidebarCollapsed, contextPanelVisible } = useUIStore();
  const showContextPanel = sidebarCollapsed && contextPanelVisible;

  // Store state
  const {
    selectedThreadId,
    selectedEmailId,
    viewMode,
    threadViewMode,
    expandedCaseIds,
    attachmentPanelOpen,
    isComposeOpen,
    selectThread,
    selectCourtEmail,
    selectUncertainEmail,
    toggleCaseExpanded,
    setThreadViewMode,
    toggleAttachmentPanel,
    closeAttachmentPanel,
    openCompose,
    closeCompose,
  } = useEmailStore();

  // Data fetching
  const { data: emailsData, loading: _emailsLoading, refetch: refetchEmails } = useEmailsByCase();
  const {
    thread,
    loading: threadLoading,
    error: threadError,
    refetch: refetchThread,
  } = useEmailThread(selectedThreadId);
  const { syncing, startSync } = useEmailSync();
  const { generateQuickReply, generateFromPrompt } = useAiEmailDraft();

  // Email classification mutations
  const [assignThreadToCase] = useMutation(ASSIGN_THREAD_TO_CASE);
  const [classifyUncertainEmail] = useMutation(CLASSIFY_UNCERTAIN_EMAIL);
  const [markSenderAsPersonal] = useMutation(MARK_SENDER_AS_PERSONAL);
  const [markThreadAsPersonal] = useMutation(MARK_THREAD_AS_PERSONAL);
  const [unmarkThreadAsPersonal] = useMutation(UNMARK_THREAD_AS_PERSONAL);

  // Query to check if current thread is personal
  const { data: personalThreadData, refetch: refetchPersonalStatus } = useQuery<{
    isThreadPersonal: boolean;
  }>(IS_THREAD_PERSONAL, {
    variables: { conversationId: selectedThreadId || '' },
    skip: !selectedThreadId,
  });
  const isCurrentThreadPersonal = personalThreadData?.isThreadPersonal || false;

  // Get current user email from auth context
  const { user } = useAuth();
  const userEmail = user?.email || '';

  // Assignment modal state
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [assignmentModalContext, setAssignmentModalContext] = useState<{
    isReassign: boolean;
    threadSubject?: string;
    senderName?: string;
    senderEmail?: string;
    suggestedCases?: Array<{ id: string; title: string; caseNumber: string; confidence: number }>;
    currentCaseId?: string | null;
  }>({ isReassign: false });

  // Attachment preview state
  const [previewAttachment, setPreviewAttachment] = useState<PreviewDocument | null>(null);
  const [previewEmailId, setPreviewEmailId] = useState<string | null>(null);

  // Attachment queries
  const [fetchAttachmentPreviewUrl] = useLazyQuery(GET_ATTACHMENT_PREVIEW_URL, {
    fetchPolicy: 'network-only',
  });
  const [fetchAttachmentContent] = useLazyQuery(GET_ATTACHMENT_CONTENT, {
    fetchPolicy: 'network-only',
  });

  // Extract attachments from thread
  const threadAttachments = useMemo(() => {
    if (!thread) return [];
    return thread.emails.flatMap((email) => email.attachments || []);
  }, [thread]);

  // Get selected uncertain email data for NECLAR mode
  const selectedUncertainEmail = useMemo(() => {
    if (viewMode !== 'uncertain-email' || !selectedEmailId) return null;
    return emailsData?.uncertainEmails?.find((e) => e.id === selectedEmailId) || null;
  }, [viewMode, selectedEmailId, emailsData?.uncertainEmails]);

  // Check if we're in NECLAR mode
  const isNeclarMode = viewMode === 'uncertain-email' && !!selectedUncertainEmail;

  // Handlers
  const handleSelectThread = useCallback(
    (conversationId: string, caseId?: string) => {
      selectThread(conversationId, caseId);
    },
    [selectThread]
  );

  const handleSelectCourtEmail = useCallback(
    (emailId: string) => {
      selectCourtEmail(emailId);
    },
    [selectCourtEmail]
  );

  const handleSelectUncertainEmail = useCallback(
    (emailId: string, conversationId?: string) => {
      selectUncertainEmail(emailId, conversationId);
    },
    [selectUncertainEmail]
  );

  // Handler to open assignment modal for reassigning existing threads
  const handleOpenReassignModal = useCallback(() => {
    if (!thread) return;

    const firstEmail = thread.emails[0];
    setAssignmentModalContext({
      isReassign: !!thread.case,
      threadSubject: thread.subject,
      senderName: firstEmail?.from.name || undefined,
      senderEmail: firstEmail?.from.address,
      currentCaseId: thread.case?.id || null,
    });
    setAssignmentModalOpen(true);
  }, [thread]);

  // Handler to open assignment modal for uncertain emails (from NECLAR)
  const handleOpenAssignModalForUncertain = useCallback(
    (uncertainEmailData: {
      subject: string;
      senderName?: string;
      senderEmail?: string;
      suggestedCases?: Array<{ id: string; title: string; caseNumber: string; confidence: number }>;
    }) => {
      setAssignmentModalContext({
        isReassign: false,
        threadSubject: uncertainEmailData.subject,
        senderName: uncertainEmailData.senderName,
        senderEmail: uncertainEmailData.senderEmail,
        suggestedCases: uncertainEmailData.suggestedCases,
        currentCaseId: null,
      });
      setAssignmentModalOpen(true);
    },
    []
  );

  // Handler for assignment modal submission
  const handleAssignFromModal = useCallback(
    async (caseId: string) => {
      if (!selectedThreadId) return null;

      try {
        const result = await assignThreadToCase({
          variables: { conversationId: selectedThreadId, caseId },
        });

        // Refetch data after assignment
        await refetchEmails?.();
        await refetchThread();

        // Extract result data with proper typing
        const assignmentData = result.data as
          | {
              assignThreadToCase?: {
                thread: {
                  id: string;
                  conversationId: string;
                  case: { id: string; title: string; caseNumber: string };
                };
                newContactAdded: boolean;
                contactName: string | null;
                contactEmail: string | null;
              };
            }
          | undefined;

        return assignmentData?.assignThreadToCase || null;
      } catch (error) {
        console.error('Failed to assign thread to case:', error);
        throw error;
      }
    },
    [selectedThreadId, assignThreadToCase, refetchEmails, refetchThread]
  );

  // Email classification handlers (reserved for future use)
  const _handleAssignToCase = useCallback(
    async (emailId: string, caseId: string) => {
      try {
        await assignThreadToCase({
          variables: { conversationId: emailId, caseId },
        });
        // Refetch email data after assignment
        refetchEmails?.();
        // Could also show a success toast
      } catch (error) {
        console.error('Failed to assign thread to case:', error);
        // Could show error toast
      }
    },
    [assignThreadToCase, refetchEmails]
  );

  const _handleIgnoreEmail = useCallback(
    async (emailId: string) => {
      try {
        await classifyUncertainEmail({
          variables: {
            emailId,
            action: { type: 'IGNORE' },
          },
        });
        refetchEmails?.();
      } catch (error) {
        console.error('Failed to ignore email:', error);
      }
    },
    [classifyUncertainEmail, refetchEmails]
  );

  const _handleMarkAsPersonal = useCallback(
    async (emailId: string) => {
      try {
        await markSenderAsPersonal({
          variables: { emailId, ignoreEmail: true },
        });
        refetchEmails?.();
      } catch (error) {
        console.error('Failed to mark as personal:', error);
      }
    },
    [markSenderAsPersonal, refetchEmails]
  );

  // Handler for toggling personal thread status
  const handleTogglePersonal = useCallback(async () => {
    if (!selectedThreadId) return;

    try {
      if (isCurrentThreadPersonal) {
        await unmarkThreadAsPersonal({
          variables: { conversationId: selectedThreadId },
        });
      } else {
        await markThreadAsPersonal({
          variables: { conversationId: selectedThreadId },
        });
      }
      // Refetch data after toggle
      await refetchPersonalStatus();
      await refetchEmails?.();
    } catch (error) {
      console.error('Failed to toggle personal status:', error);
    }
  }, [
    selectedThreadId,
    isCurrentThreadPersonal,
    markThreadAsPersonal,
    unmarkThreadAsPersonal,
    refetchPersonalStatus,
    refetchEmails,
  ]);

  // NECLAR mode handlers
  const handleNeclarAssignToCase = useCallback(
    async (caseId: string) => {
      if (!selectedEmailId) return;
      try {
        await classifyUncertainEmail({
          variables: {
            emailId: selectedEmailId,
            action: { type: 'ASSIGN', caseId },
          },
        });
        refetchEmails?.();
      } catch (error) {
        console.error('Failed to assign uncertain email:', error);
      }
    },
    [selectedEmailId, classifyUncertainEmail, refetchEmails]
  );

  const handleNeclarIgnore = useCallback(async () => {
    if (!selectedEmailId) return;
    try {
      await classifyUncertainEmail({
        variables: {
          emailId: selectedEmailId,
          action: { type: 'IGNORE' },
        },
      });
      refetchEmails?.();
    } catch (error) {
      console.error('Failed to ignore email:', error);
    }
  }, [selectedEmailId, classifyUncertainEmail, refetchEmails]);

  const handleNeclarMarkAsPersonal = useCallback(async () => {
    if (!selectedEmailId) return;
    try {
      await markSenderAsPersonal({
        variables: { emailId: selectedEmailId, ignoreEmail: true },
      });
      refetchEmails?.();
    } catch (error) {
      console.error('Failed to mark as personal:', error);
    }
  }, [selectedEmailId, markSenderAsPersonal, refetchEmails]);

  const handleNeclarChooseOtherCase = useCallback(() => {
    if (!selectedUncertainEmail) return;
    handleOpenAssignModalForUncertain({
      subject: selectedUncertainEmail.subject,
      senderName: selectedUncertainEmail.from.name || undefined,
      senderEmail: selectedUncertainEmail.from.address,
      suggestedCases: selectedUncertainEmail.suggestedCases,
    });
  }, [selectedUncertainEmail, handleOpenAssignModalForUncertain]);

  // Handler to mark sender as personal for unassigned threads (not NECLAR)
  const handleMarkSenderAsPersonalForThread = useCallback(async () => {
    if (!thread?.emails?.[0]?.id) return;
    try {
      // Get the first email's ID to mark sender as personal
      const firstEmailId = thread.emails[0].id;
      await markSenderAsPersonal({
        variables: { emailId: firstEmailId, ignoreEmail: true },
      });
      refetchEmails?.();
    } catch (error) {
      console.error('Failed to mark sender as personal:', error);
    }
  }, [thread, markSenderAsPersonal, refetchEmails]);

  const handleSync = useCallback(async () => {
    await startSync();
    // Refetch emails after sync completes
    // Add a small delay to allow background sync to process some emails
    setTimeout(() => {
      refetchEmails?.();
    }, 2000);
  }, [startSync, refetchEmails]);

  const handleToggleViewMode = useCallback(() => {
    setThreadViewMode(threadViewMode === 'conversation' ? 'cards' : 'conversation');
  }, [threadViewMode, setThreadViewMode]);

  // Convert Attachment to PreviewDocument and find the email it belongs to
  const handleAttachmentClick = useCallback(
    (attachment: Attachment) => {
      // Find which email this attachment belongs to
      const email = thread?.emails.find((e) => e.attachments?.some((a) => a.id === attachment.id));

      // Convert attachment to PreviewDocument format
      const previewDoc: PreviewDocument = {
        id: attachment.id,
        fileName: attachment.name || attachment.filename || 'Atașament',
        fileType: getFileType(attachment.name || attachment.filename || ''),
        fileSize: attachment.size || attachment.fileSize,
      };

      setPreviewAttachment(previewDoc);
      setPreviewEmailId(email?.id || null);
    },
    [thread]
  );

  // Close preview modal
  const handleClosePreview = useCallback(() => {
    setPreviewAttachment(null);
    setPreviewEmailId(null);
  }, []);

  // Fetch preview URL for Office documents
  const handleRequestPreviewUrl = useCallback(
    async (attachmentId: string): Promise<string | null> => {
      try {
        const result = await fetchAttachmentPreviewUrl({
          variables: { attachmentId },
        });
        const data = result.data as
          | { attachmentPreviewUrl?: { url: string; source: string; expiresAt?: string } }
          | undefined;
        return data?.attachmentPreviewUrl?.url || null;
      } catch (err) {
        console.error('Failed to fetch attachment preview URL:', err);
        return null;
      }
    },
    [fetchAttachmentPreviewUrl]
  );

  // Fetch download URL for PDFs/images by creating a blob URL from content
  // This avoids CORS issues with presigned R2 URLs
  const handleRequestDownloadUrl = useCallback(
    async (attachmentId: string): Promise<string | null> => {
      if (!previewEmailId) {
        console.error('No email ID available for attachment content fetch');
        return null;
      }

      try {
        const result = await fetchAttachmentContent({
          variables: { emailId: previewEmailId, attachmentId },
        });

        const data = result.data as
          | {
              emailAttachmentContent?: {
                content: string;
                name: string;
                contentType: string;
                size: number;
              };
            }
          | undefined;
        const content = data?.emailAttachmentContent;
        if (!content?.content) {
          console.error('No content returned for attachment');
          return null;
        }

        // Create blob URL from base64 content
        const byteCharacters = atob(content.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: content.contentType || 'application/octet-stream',
        });
        return URL.createObjectURL(blob);
      } catch (err) {
        console.error('Failed to fetch attachment content for preview:', err);
        return null;
      }
    },
    [previewEmailId, fetchAttachmentContent]
  );

  // Handle attachment download (triggers browser download)
  const handleDownloadAttachment = useCallback(
    async (attachmentId: string, attachmentName: string) => {
      // Find which email this attachment belongs to
      const email = thread?.emails.find((e) => e.attachments?.some((a) => a.id === attachmentId));

      if (!email) {
        console.error('Could not find email for attachment');
        return;
      }

      try {
        const result = await fetchAttachmentContent({
          variables: { emailId: email.id, attachmentId },
        });

        const data = result.data as
          | {
              emailAttachmentContent?: {
                content: string;
                name: string;
                contentType: string;
                size: number;
              };
            }
          | undefined;
        const content = data?.emailAttachmentContent;
        if (!content?.content) {
          console.error('No content returned for attachment');
          return;
        }

        // Create blob from base64 content and trigger download
        const byteCharacters = atob(content.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: content.contentType || 'application/octet-stream',
        });

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachmentName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Failed to download attachment:', err);
      }
    },
    [thread, fetchAttachmentContent]
  );

  // Handle download from preview modal
  const handleDownloadFromPreview = useCallback(
    (document: PreviewDocument) => {
      if (previewEmailId) {
        handleDownloadAttachment(document.id, document.fileName);
      }
    },
    [previewEmailId, handleDownloadAttachment]
  );

  const handleSendReply = useCallback(
    async (threadId: string, body: string, _attachments?: File[]) => {
      try {
        await apolloClient.mutate({
          mutation: REPLY_TO_EMAIL,
          variables: {
            input: {
              threadId,
              body,
              // Note: File attachments would need to be uploaded separately and passed as attachment IDs
            },
          },
        });
        await refetchThread();
      } catch (err) {
        console.error('Failed to send reply:', err);
        throw err;
      }
    },
    [refetchThread]
  );

  const handleGenerateQuickReply = useCallback(
    async (emailId: string) => {
      const result = await generateQuickReply(emailId);
      return result?.body || null;
    },
    [generateQuickReply]
  );

  const handleGenerateFromPrompt = useCallback(
    async (emailId: string, prompt: string) => {
      const result = await generateFromPrompt(emailId, prompt);
      return result?.body || null;
    },
    [generateFromPrompt]
  );

  const handleNewCompose = useCallback(() => {
    openCompose('new');
  }, [openCompose]);

  const handleSendNewEmail = useCallback(
    async (data: {
      to: string;
      cc?: string;
      subject: string;
      body: string;
      attachments?: File[];
      caseId?: string;
    }) => {
      try {
        await apolloClient.mutate({
          mutation: SEND_EMAIL,
          variables: {
            input: {
              to: data.to.split(',').map((email) => email.trim()),
              cc: data.cc ? data.cc.split(',').map((email) => email.trim()) : undefined,
              subject: data.subject,
              body: data.body,
              caseId: data.caseId,
              // Note: File attachments would need to be uploaded separately and passed as attachment IDs
            },
          },
        });
        await refetchEmails();
        closeCompose();
      } catch (err) {
        console.error('Failed to send email:', err);
        throw err;
      }
    },
    [refetchEmails, closeCompose]
  );

  const handleGenerateAiForCompose = useCallback(async (prompt: string) => {
    // TODO: Implement AI generation for new compose
    console.log('Generate AI for compose:', prompt);
    return 'AI-generated content would go here...';
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar */}
      <EmailCaseSidebar
        cases={emailsData?.cases || []}
        unassignedCase={emailsData?.unassignedCase || null}
        courtEmails={emailsData?.courtEmails || []}
        courtEmailsCount={emailsData?.courtEmailsCount || 0}
        uncertainEmails={emailsData?.uncertainEmails || []}
        uncertainEmailsCount={emailsData?.uncertainEmailsCount || 0}
        selectedThreadId={selectedThreadId}
        selectedEmailId={selectedEmailId}
        expandedCaseIds={expandedCaseIds}
        onSelectThread={handleSelectThread}
        onSelectCourtEmail={handleSelectCourtEmail}
        onSelectUncertainEmail={handleSelectUncertainEmail}
        onToggleCaseExpanded={toggleCaseExpanded}
        onSync={handleSync}
        syncing={syncing}
      />

      {/* Main Content */}
      <EmailConversationView
        thread={thread}
        loading={threadLoading}
        error={threadError}
        userEmail={userEmail}
        threadViewMode={threadViewMode}
        attachmentPanelOpen={attachmentPanelOpen}
        onToggleViewMode={handleToggleViewMode}
        onToggleAttachmentPanel={toggleAttachmentPanel}
        onNewCompose={handleNewCompose}
        onAttachmentClick={handleAttachmentClick}
        onDownloadAttachment={handleDownloadAttachment}
        onSendReply={handleSendReply}
        onGenerateQuickReply={handleGenerateQuickReply}
        onGenerateFromPrompt={handleGenerateFromPrompt}
        onReassign={handleOpenReassignModal}
        isPersonal={isCurrentThreadPersonal}
        onTogglePersonal={handleTogglePersonal}
        onMarkSenderAsPersonal={handleMarkSenderAsPersonalForThread}
        neclarMode={isNeclarMode}
        neclarData={selectedUncertainEmail || undefined}
        onNeclarAssignToCase={handleNeclarAssignToCase}
        onNeclarIgnore={handleNeclarIgnore}
        onNeclarMarkAsPersonal={handleNeclarMarkAsPersonal}
        onNeclarChooseOtherCase={handleNeclarChooseOtherCase}
      />

      {/* Attachment Panel */}
      {attachmentPanelOpen && threadAttachments.length > 0 && (
        <AttachmentListPanel
          attachments={threadAttachments}
          onClose={closeAttachmentPanel}
          onPreview={handleAttachmentClick}
        />
      )}

      {/* Compose Modal */}
      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={closeCompose}
        onSend={handleSendNewEmail}
        onGenerateAi={handleGenerateAiForCompose}
      />

      {/* Case Assignment Modal */}
      <CaseAssignmentModal
        isOpen={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        onAssign={handleAssignFromModal}
        threadSubject={assignmentModalContext.threadSubject}
        senderName={assignmentModalContext.senderName}
        senderEmail={assignmentModalContext.senderEmail}
        suggestedCases={assignmentModalContext.suggestedCases}
        currentCaseId={assignmentModalContext.currentCaseId}
        isReassign={assignmentModalContext.isReassign}
      />

      {/* Attachment Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewAttachment}
        onClose={handleClosePreview}
        document={previewAttachment}
        onRequestPreviewUrl={handleRequestPreviewUrl}
        onRequestDownloadUrl={handleRequestDownloadUrl}
        onDownload={handleDownloadFromPreview}
      />

      {/* Floating Compose Button (when no thread selected) */}
      {viewMode === 'none' && (
        <Button
          onClick={handleNewCompose}
          className={cn(
            'fixed bottom-6 h-12 px-5 shadow-lg transition-[right] duration-300 ease-spring',
            showContextPanel ? 'right-[344px] xl:right-[408px]' : 'right-6'
          )}
        >
          <Edit className="h-4 w-4 mr-2" />
          Compune
        </Button>
      )}
    </div>
  );
}
