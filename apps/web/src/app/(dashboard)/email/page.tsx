'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  EmailCaseSidebar,
  EmailConversationView,
  AttachmentListPanel,
  ComposeEmailModal,
  CaseAssignmentModal,
} from '@/components/email';
import { useEmailStore } from '@/store/emailStore';
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
} from '@/graphql/queries';
import type { Attachment } from '@/types/email';

export default function EmailPage() {
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
  const { data: emailsData, loading: emailsLoading, refetch: refetchEmails } = useEmailsByCase();
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

  // Extract attachments from thread
  const threadAttachments = useMemo(() => {
    if (!thread) return [];
    return thread.emails.flatMap((email) => email.attachments || []);
  }, [thread]);

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

  // Email classification handlers
  const handleAssignToCase = useCallback(
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

  const handleIgnoreEmail = useCallback(
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

  const handleMarkAsPersonal = useCallback(
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

  const handleAttachmentClick = useCallback((attachment: Attachment) => {
    // TODO: Open document preview modal
    console.log('Preview attachment:', attachment);
  }, []);

  const handleDownloadAttachment = useCallback(
    async (attachmentId: string, attachmentName: string) => {
      // TODO: Implement attachment download
      console.log('Download attachment:', attachmentId, attachmentName);
    },
    []
  );

  const handleSendReply = useCallback(
    async (threadId: string, body: string, attachments?: File[]) => {
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
    async (threadId: string) => {
      const result = await generateQuickReply(threadId);
      return result?.body || null;
    },
    [generateQuickReply]
  );

  const handleGenerateFromPrompt = useCallback(
    async (threadId: string, prompt: string) => {
      const result = await generateFromPrompt(threadId, prompt);
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

      {/* Floating Compose Button (when no thread selected) */}
      {viewMode === 'none' && (
        <Button onClick={handleNewCompose} className="fixed bottom-6 right-6 h-12 px-5 shadow-lg">
          <Edit className="h-4 w-4 mr-2" />
          Compune
        </Button>
      )}
    </div>
  );
}
