'use client';

/**
 * Communications Page - Case-Organized Redesign
 * OPS-041: /communications Case-Organized Redesign
 * OPS-328: Mobile Page Consistency - Added mobile view
 *
 * User's email workspace organized by case with separate sections
 * for court emails (INSTANȚE) and uncertain classifications (NECLAR).
 * On mobile devices (< 768px), shows MobileCommunications instead.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Mail,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  LayoutList,
} from 'lucide-react';
import { clsx } from 'clsx';

// Components
import { CaseSidebar, type MoveThreadInfo } from '../../components/communication/CaseSidebar';
import { MessageView } from '../../components/communication/MessageView';
import { ConversationView } from '../../components/communication/ConversationView';
import { ComposeInterface } from '../../components/communication/ComposeInterface';
import { MoveThreadModal } from '../../components/communication/MoveThreadModal';
import { AttachmentPreviewPanel } from '../../components/communication/AttachmentPreviewPanel';
import { MobileCommunications } from '../../components/mobile';
import { PageLayout } from '../../components/linear/PageLayout';

// Hooks
import { useMyEmailsByCase } from '../../hooks/useMyEmailsByCase';
import { useEmailsByFolder } from '../../hooks/useEmailsByFolder';
import { useEmailSync, useEmailThread } from '../../hooks/useEmailSync';
import { useCommunicationStore } from '../../stores/communication.store';
import { useAuth } from '../../contexts/AuthContext';
import { useSetAIContext } from '../../contexts/AIAssistantContext';
import { useThreadAttachments, findAttachmentById } from '../../hooks/useThreadAttachments';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';

// ============================================================================
// GraphQL Queries
// ============================================================================

// OPS-122: Query for getting attachment preview URL
const GET_ATTACHMENT_PREVIEW_URL = gql`
  query GetAttachmentPreviewUrl($attachmentId: ID!) {
    attachmentPreviewUrl(attachmentId: $attachmentId) {
      url
      source
      expiresAt
    }
  }
`;

// OPS-122: Query for downloading attachment content directly from MS Graph
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

// OPS-291: Mutation to backfill folder info for existing emails
const BACKFILL_EMAIL_FOLDER_INFO = gql`
  mutation BackfillEmailFolderInfo {
    backfillEmailFolderInfo
  }
`;

// ============================================================================
// Types
// ============================================================================

// OPS-293: Added 'folder-email' mode for emails from Outlook folders
type ViewMode = 'thread' | 'court-email' | 'uncertain-email' | 'folder-email' | 'none';

interface ViewState {
  mode: ViewMode;
  threadId: string | null;
  emailId: string | null;
  caseId: string | null;
  folderId: string | null; // OPS-293: Track selected folder for folder emails
}

// OPS-196: NECLAR email data for inline assignment
// OPS-200: Added conversationId for thread view loading
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

// ============================================================================
// Main Component
// ============================================================================

export default function CommunicationsPage() {
  const isMobile = useIsMobile();

  // On mobile, render MobileCommunications
  if (isMobile) {
    return <MobileCommunications />;
  }

  // Desktop: render full communications page
  return <CommunicationsPageDesktop />;
}

function CommunicationsPageDesktop() {
  // Set AI assistant context to communications
  useSetAIContext('communications');

  // Auth context for Microsoft account status
  const { hasMsalAccount, reconnectMicrosoft, user, getAccessToken } = useAuth();

  // Communication store for compose and thread selection
  const {
    setThreads,
    setUserEmail,
    selectThread,
    getSelectedThread,
    // OPS-121: Thread view mode (conversation vs cards)
    threadViewMode,
    setThreadViewMode,
    // OPS-122: Attachment preview panel state
    previewPanelOpen,
    selectedAttachmentId,
    closePreviewPanel,
    selectAttachment,
  } = useCommunicationStore();

  // State for MS token required error
  const [showMsReconnectPrompt, setShowMsReconnectPrompt] = useState(false);

  // View state for what's displayed in the main panel
  const [viewState, setViewState] = useState<ViewState>({
    mode: 'none',
    threadId: null,
    emailId: null,
    caseId: null,
    folderId: null, // OPS-293
  });

  // OPS-196: NECLAR inline assignment - store the selected uncertain email data
  // Instead of opening a modal, we now load the email in ConversationView
  const [neclarEmailData, setNeclarEmailData] = useState<NeclarEmailData | null>(null);

  // Move thread modal state
  const [moveThreadInfo, setMoveThreadInfo] = useState<MoveThreadInfo | null>(null);

  // Set user email in store
  useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email);
    }
  }, [user?.email, setUserEmail]);

  // Listen for MS_TOKEN_REQUIRED errors
  useEffect(() => {
    const handleMsTokenRequired = () => {
      setShowMsReconnectPrompt(true);
    };

    window.addEventListener('ms-token-required', handleMsTokenRequired);
    return () => window.removeEventListener('ms-token-required', handleMsTokenRequired);
  }, []);

  // OPS-176: Proactively check if MS token is available
  // This helps show the reconnect prompt earlier if the token is expired
  useEffect(() => {
    // Only check if user thinks they have an MSAL account but haven't been prompted yet
    if (hasMsalAccount && !showMsReconnectPrompt) {
      getAccessToken().then((token) => {
        if (!token) {
          // Token couldn't be obtained - show reconnect prompt
          console.log('[Communications] MS token check failed - showing reconnect prompt');
          setShowMsReconnectPrompt(true);
        }
      });
    }
  }, [hasMsalAccount, showMsReconnectPrompt, getAccessToken]);

  // Email sync hook
  const { syncStatus, syncing, startSync, loading: syncLoading } = useEmailSync();

  // Fetch case-organized email data
  const {
    data: emailData,
    loading: emailsLoading,
    error: emailsError,
    refetch,
    // OPS-132: Load more support
    loadMore,
    hasMore,
    loadingMore,
  } = useMyEmailsByCase();

  // OPS-293: Fetch emails grouped by Outlook folder
  const { folders: outlookFolders, refetch: refetchFolders } = useEmailsByFolder();

  // OPS-291: Backfill folder info mutation (kept for potential admin use)
  const [_backfillFolderInfo] = useMutation(BACKFILL_EMAIL_FOLDER_INFO);

  // Fetch selected thread if viewing a thread
  const { thread: selectedThreadData } = useEmailThread(viewState.threadId || '');

  // Update communication store when thread data is loaded
  useEffect(() => {
    if (selectedThreadData && viewState.threadId) {
      // Transform and set threads for MessageView compatibility
      const transformedThread = {
        id: selectedThreadData.id || selectedThreadData.conversationId,
        conversationId: selectedThreadData.conversationId,
        subject: selectedThreadData.subject || '(Fără subiect)',
        caseId: selectedThreadData.case?.id || '',
        caseType: 'Other' as const,
        caseName: selectedThreadData.case?.title || 'Neatribuit',
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
          bodyClean: email.bodyContentClean || undefined, // OPS-090
          folderType: email.folderType || null, // OPS-126: Source folder for direction
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
  }, [selectedThreadData, viewState.threadId, setThreads, selectThread]);

  // Handle sync
  const handleSync = async () => {
    try {
      await startSync();
      // Refetch both case-organized emails and folder emails after sync
      setTimeout(() => {
        refetch();
        refetchFolders();
      }, 2000);
    } catch (error) {
      console.error('[Communications] Email sync failed:', error);
    }
  };

  // Handle thread selection from sidebar
  const handleSelectThread = useCallback((conversationId: string, caseId?: string) => {
    setViewState({
      mode: 'thread',
      threadId: conversationId,
      emailId: null,
      caseId: caseId || null,
      folderId: null,
    });
  }, []);

  // Handle court email selection - show in main panel (future: could show details)
  const handleSelectCourtEmail = useCallback((emailId: string) => {
    setViewState({
      mode: 'court-email',
      threadId: null,
      emailId,
      caseId: null,
      folderId: null,
    });
  }, []);

  // OPS-196: Handle uncertain email selection - load in ConversationView with inline assignment
  // OPS-200: Use conversationId for thread loading so SplitAssignmentButton renders
  const handleSelectUncertainEmail = useCallback(
    (emailId: string) => {
      // Find the uncertain email data to get conversationId and suggestions
      const uncertainEmail = emailData.uncertain.find((e) => e.id === emailId);
      if (!uncertainEmail) return;

      // Store the NECLAR data for the action bar
      setNeclarEmailData({
        id: uncertainEmail.id,
        conversationId: uncertainEmail.conversationId,
        suggestedCases: uncertainEmail.suggestedCases,
      });

      // OPS-200: Use conversationId (not email ID) so useEmailThread can find the thread
      // This allows the thread to load properly and SplitAssignmentButton to render
      setViewState({
        mode: 'uncertain-email',
        threadId: uncertainEmail.conversationId || uncertainEmail.id, // Prefer conversationId
        emailId,
        caseId: null,
        folderId: null,
      });
    },
    [emailData.uncertain]
  );

  // OPS-196: Handle assignment complete - clear NECLAR state and refetch
  const handleNeclarAssignmentComplete = useCallback(() => {
    setNeclarEmailData(null);
    refetch();
  }, [refetch]);

  // OPS-206: Handle unassigned thread selection from merged NECLAR section
  // These are threads without a case that need inline assignment
  const handleSelectUnassignedThread = useCallback((conversationId: string) => {
    // For unassigned threads, we don't have AI suggestions
    // The CasePickerDropup will be shown in ConversationView
    setNeclarEmailData({
      id: conversationId, // Use conversationId as a pseudo-id
      conversationId,
      suggestedCases: [], // No suggestions - will trigger CasePickerDropup
    });

    setViewState({
      mode: 'uncertain-email', // Use same mode as uncertain emails for NECLAR bar
      threadId: conversationId,
      emailId: null,
      caseId: null,
      folderId: null,
    });
  }, []);

  // OPS-293: Handle folder email selection - show in main panel
  const handleSelectFolderEmail = useCallback((emailId: string, folderId: string) => {
    // For folder emails, we use the email directly without ConversationView
    // The email will be displayed in a simple card view
    setViewState({
      mode: 'folder-email',
      threadId: null,
      emailId,
      caseId: null,
      folderId,
    });
  }, []);

  // OPS-293: Handle assigning a folder email to a case
  // This will trigger the classification flow
  const handleAssignFolderEmailToCase = useCallback((emailId: string) => {
    // TODO: Open a case picker modal to assign the email
    // For now, log the action - this will be implemented in a follow-up
    console.log('[Communications] Assign folder email to case:', emailId);
  }, []);

  // Handle move thread request from sidebar
  const handleMoveThread = useCallback((info: MoveThreadInfo) => {
    setMoveThreadInfo(info);
  }, []);

  // Handle move thread modal close
  const handleMoveThreadClose = useCallback(() => {
    setMoveThreadInfo(null);
  }, []);

  // Handle move thread complete - refetch data
  const handleMoveThreadComplete = useCallback(() => {
    setMoveThreadInfo(null);
    refetch();
  }, [refetch]);

  const isLoading = syncLoading || emailsLoading;
  const selectedThread = getSelectedThread();

  // OPS-122: Thread attachments for preview panel
  const threadAttachments = useThreadAttachments(selectedThread);
  const selectedAttachment = selectedAttachmentId
    ? findAttachmentById(threadAttachments, selectedAttachmentId)
    : null;

  // OPS-122: GraphQL queries for attachment preview
  const [fetchPreviewUrl] = useLazyQuery(GET_ATTACHMENT_PREVIEW_URL, {
    fetchPolicy: 'network-only',
  });
  const [fetchAttachmentContent] = useLazyQuery(GET_ATTACHMENT_CONTENT, {
    fetchPolicy: 'network-only',
  });

  // OPS-122: Handle attachment preview URL request
  const handleRequestPreviewUrl = useCallback(
    async (attachmentId: string): Promise<string | null> => {
      try {
        // First, try to get OneDrive preview URL
        const result = await fetchPreviewUrl({
          variables: { attachmentId },
        });
        const data = result.data as { attachmentPreviewUrl?: { url: string } } | undefined;

        if (data?.attachmentPreviewUrl?.url) {
          return data.attachmentPreviewUrl.url;
        }

        // Fallback: Fetch content directly from MS Graph and create blob URL
        const attachment = findAttachmentById(threadAttachments, attachmentId);
        if (!attachment) {
          console.error('Attachment not found for fallback content fetch');
          return null;
        }

        const contentResult = await fetchAttachmentContent({
          variables: { emailId: attachment.messageId, attachmentId },
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

          return URL.createObjectURL(blob);
        }

        return null;
      } catch (error) {
        console.error('Failed to fetch preview URL:', error);
        return null;
      }
    },
    [fetchPreviewUrl, fetchAttachmentContent, threadAttachments]
  );

  // OPS-122: Handle attachment selection
  const handleSelectAttachment = useCallback(
    (attachmentId: string, messageId: string) => {
      selectAttachment(attachmentId, messageId);
    },
    [selectAttachment]
  );

  // Find selected court email for display
  const selectedCourtEmail =
    viewState.mode === 'court-email'
      ? emailData.courtUnassigned.find((e) => e.id === viewState.emailId)
      : null;

  // OPS-293: Find selected folder email for display
  const selectedFolderEmail =
    viewState.mode === 'folder-email' && viewState.folderId
      ? (() => {
          const folder = outlookFolders.find((f) => f.id === viewState.folderId);
          return folder?.emails.find((e) => e.id === viewState.emailId) || null;
        })()
      : null;
  const selectedFolder =
    viewState.mode === 'folder-email' && viewState.folderId
      ? outlookFolders.find((f) => f.id === viewState.folderId)
      : null;

  return (
    <PageLayout className="flex h-screen flex-col overflow-hidden p-0">
      {/* OPS-363: Simplified header with Linear styling */}
      <div className="border-b border-linear-border-subtle bg-linear-bg-secondary px-4 py-3 flex items-center justify-between flex-shrink-0">
        {/* Left: Sync button and status */}
        <div className="flex items-center gap-3">
          <button
            onClick={hasMsalAccount ? handleSync : () => reconnectMicrosoft()}
            disabled={syncing || isLoading}
            className={clsx(
              'px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
              hasMsalAccount
                ? 'bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover border border-linear-border-subtle'
                : 'bg-linear-warning text-white hover:bg-linear-warning/90'
            )}
          >
            <RefreshCw className={clsx('h-4 w-4', syncing && 'animate-spin')} />
            {syncing ? 'Sincronizare...' : hasMsalAccount ? 'Sincronizează' : 'Conectează MS'}
          </button>

          {syncStatus && (
            <span className="text-[13px] text-linear-text-tertiary">
              {syncStatus.emailCount} emailuri
              {syncStatus.lastSyncAt && (
                <span className="ml-1.5">
                  •{' '}
                  {new Date(syncStatus.lastSyncAt).toLocaleString('ro-RO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Right: View toggle + Outlook link */}
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-linear-bg-tertiary rounded-lg p-0.5 border border-linear-border-subtle">
            <button
              onClick={() => setThreadViewMode('conversation')}
              className={clsx(
                'px-2.5 py-1 text-[13px] rounded-md transition-colors flex items-center gap-1.5',
                threadViewMode === 'conversation'
                  ? 'bg-linear-bg-elevated text-linear-text-primary'
                  : 'text-linear-text-tertiary hover:text-linear-text-secondary'
              )}
              title="Vizualizare conversație"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Conversație</span>
            </button>
            <button
              onClick={() => setThreadViewMode('cards')}
              className={clsx(
                'px-2.5 py-1 text-[13px] rounded-md transition-colors flex items-center gap-1.5',
                threadViewMode === 'cards'
                  ? 'bg-linear-bg-elevated text-linear-text-primary'
                  : 'text-linear-text-tertiary hover:text-linear-text-secondary'
              )}
              title="Vizualizare carduri"
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Carduri</span>
            </button>
          </div>

          <a
            href="https://outlook.office.com/mail/0/deeplink/compose"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-[13px] bg-linear-bg-tertiary text-linear-text-secondary rounded-lg hover:bg-linear-bg-hover transition-colors flex items-center gap-1.5 border border-linear-border-subtle"
            title="Deschide Outlook pentru mesaje noi"
          >
            <Mail className="h-3.5 w-3.5" />
            Outlook
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>
        </div>
      </div>

      {/* Error Display - only show critical errors */}
      {emailsError && (
        <div className="mx-4 mt-3 p-3 bg-linear-error/10 border border-linear-error/30 rounded-lg flex items-start gap-2 flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-linear-error mt-0.5 flex-shrink-0" />
          <p className="text-sm text-linear-error">{emailsError.message}</p>
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Case Sidebar */}
        <div className="w-80 lg:w-96 border-r border-linear-border-subtle bg-linear-bg-secondary flex-shrink-0 overflow-hidden">
          <CaseSidebar
            cases={emailData.cases}
            unassignedCase={emailData.unassignedCase}
            courtUnassigned={emailData.courtUnassigned}
            courtUnassignedCount={emailData.courtUnassignedCount}
            uncertain={emailData.uncertain}
            uncertainCount={emailData.uncertainCount}
            selectedThreadId={viewState.threadId}
            selectedEmailId={viewState.emailId}
            onSelectThread={handleSelectThread}
            onSelectCourtEmail={handleSelectCourtEmail}
            onSelectUncertainEmail={handleSelectUncertainEmail}
            onSelectUnassignedThread={handleSelectUnassignedThread}
            onMoveThread={handleMoveThread}
            // OPS-132: Load more support
            hasMoreThreads={hasMore}
            onLoadMore={loadMore}
            loadingMore={loadingMore}
            // OPS-293: Outlook folders with unassigned emails
            outlookFolders={outlookFolders.map((folder) => ({
              ...folder,
              emails: folder.emails.map((email) => ({
                id: email.id,
                subject: email.subject,
                from: email.from,
                receivedDateTime: email.receivedDateTime,
                bodyPreview: email.bodyPreview,
                hasAttachments: email.hasAttachments,
                isRead: email.isRead,
              })),
            }))}
            onSelectFolderEmail={handleSelectFolderEmail}
            onAssignFolderEmailToCase={handleAssignFolderEmailToCase}
            className="h-full"
          />
        </div>

        {/* Right Column: Content View + Attachment Preview Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Content View */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* OPS-196: NECLAR emails now open in ConversationView with inline assignment */}
            {(viewState.mode === 'thread' || viewState.mode === 'uncertain-email') &&
            selectedThread ? (
              // OPS-121: Conditionally render conversation or card view
              threadViewMode === 'conversation' ? (
                <ConversationView
                  neclarMode={viewState.mode === 'uncertain-email'}
                  neclarData={neclarEmailData}
                  onNeclarAssigned={handleNeclarAssignmentComplete}
                />
              ) : (
                <MessageView />
              )
            ) : viewState.mode === 'court-email' && selectedCourtEmail ? (
              /* OPS-363: Court email view with Linear styling */
              <div className="flex-1 p-4 overflow-y-auto bg-linear-bg-tertiary">
                <div className="max-w-3xl mx-auto">
                  <div className="bg-linear-bg-secondary rounded-xl border border-linear-border-subtle p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-base font-semibold text-linear-text-primary">
                          {selectedCourtEmail.subject || '(Fără subiect)'}
                        </h2>
                        <p className="text-sm text-linear-text-secondary mt-1">
                          De la: {selectedCourtEmail.from.name || selectedCourtEmail.from.address}
                          {selectedCourtEmail.from.name && (
                            <span className="text-linear-text-tertiary ml-1">
                              &lt;{selectedCourtEmail.from.address}&gt;
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-linear-text-muted mt-1">
                          {new Date(selectedCourtEmail.receivedDateTime).toLocaleDateString(
                            'ro-RO',
                            {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </p>
                      </div>
                      {selectedCourtEmail.institutionCategory && (
                        <span className="px-2 py-1 text-xs font-medium bg-linear-accent/15 text-linear-accent rounded">
                          {selectedCourtEmail.institutionCategory}
                        </span>
                      )}
                    </div>

                    {selectedCourtEmail.extractedReferences.length > 0 && (
                      <div className="mb-4 p-3 bg-linear-accent/10 rounded-lg border border-linear-accent/20">
                        <p className="text-[13px] font-medium text-linear-accent mb-2">
                          Numere de referință extrase:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCourtEmail.extractedReferences.map((ref, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-linear-bg-secondary text-linear-accent text-[13px] rounded border border-linear-accent/30"
                            >
                              {ref}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-sm text-linear-text-secondary leading-relaxed">
                      {selectedCourtEmail.bodyPreview}
                    </div>

                    {selectedCourtEmail.suggestedCases.length > 0 && (
                      <div className="mt-5 p-4 bg-linear-bg-tertiary rounded-lg border border-linear-border-subtle">
                        <p className="text-[13px] font-medium text-linear-text-secondary mb-3">
                          Dosare sugerate pentru atribuire:
                        </p>
                        <div className="space-y-2">
                          {selectedCourtEmail.suggestedCases.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between p-2.5 bg-linear-bg-secondary rounded-lg border border-linear-border-subtle"
                            >
                              <div>
                                <span className="font-medium text-linear-text-primary text-[13px]">
                                  {c.title}
                                </span>
                                <span className="text-xs text-linear-text-muted ml-2">
                                  {c.caseNumber}
                                </span>
                              </div>
                              <button className="px-3 py-1.5 text-xs bg-linear-accent text-white rounded-lg hover:bg-linear-accent-hover transition-colors">
                                Atribuie
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : viewState.mode === 'folder-email' && selectedFolderEmail && selectedFolder ? (
              /* OPS-363: Folder email view with Linear styling */
              <div className="flex-1 p-4 overflow-y-auto bg-linear-bg-tertiary">
                <div className="max-w-3xl mx-auto">
                  <div className="bg-linear-bg-secondary rounded-xl border border-linear-border-subtle p-5">
                    {/* Folder indicator */}
                    <div className="mb-4 pb-4 border-b border-linear-border-subtle">
                      <span className="px-2 py-1 text-xs font-medium bg-linear-accent/15 text-linear-accent rounded">
                        {selectedFolder.name}
                      </span>
                    </div>

                    {/* Email header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-base font-semibold text-linear-text-primary">
                          {selectedFolderEmail.subject || '(Fără subiect)'}
                        </h2>
                        <p className="text-sm text-linear-text-secondary mt-1">
                          De la: {selectedFolderEmail.from.name || selectedFolderEmail.from.address}
                          {selectedFolderEmail.from.name && (
                            <span className="text-linear-text-tertiary ml-1">
                              &lt;{selectedFolderEmail.from.address}&gt;
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-linear-text-muted mt-1">
                          {new Date(selectedFolderEmail.receivedDateTime).toLocaleDateString(
                            'ro-RO',
                            {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Body preview */}
                    <div className="text-sm text-linear-text-secondary leading-relaxed">
                      {selectedFolderEmail.bodyPreview || 'Fără previzualizare disponibilă'}
                    </div>

                    {/* Action bar */}
                    <div className="mt-5 pt-4 border-t border-linear-border-subtle flex justify-end">
                      <button
                        onClick={() => handleAssignFolderEmailToCase(selectedFolderEmail.id)}
                        className="px-4 py-2 text-[13px] bg-linear-accent text-white rounded-lg hover:bg-linear-accent-hover transition-colors"
                      >
                        Atribuie la dosar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* OPS-363: Empty state with Linear styling */
              <div className="flex-1 flex items-center justify-center bg-linear-bg-tertiary">
                <div className="text-center">
                  <Mail className="h-12 w-12 text-linear-text-muted mx-auto mb-3" />
                  <p className="text-sm text-linear-text-tertiary">
                    Selectați o conversație din stânga
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* OPS-122: Attachment Preview Panel */}
          {/* OPS-140: Added caseId for action toolbar */}
          {/* OPS-197: Added isEmailAssigned to disable save for NECLAR emails */}
          {previewPanelOpen && threadAttachments.length > 0 && (
            <AttachmentPreviewPanel
              isOpen={previewPanelOpen}
              onClose={closePreviewPanel}
              selectedAttachment={selectedAttachment || null}
              threadAttachments={threadAttachments}
              onSelectAttachment={handleSelectAttachment}
              onRequestPreviewUrl={handleRequestPreviewUrl}
              caseId={selectedThread?.caseId}
              isEmailAssigned={
                viewState.mode !== 'uncertain-email' && Boolean(selectedThread?.caseId)
              }
            />
          )}
        </div>
      </div>

      {/* Compose Modal */}
      <ComposeInterface />

      {/* Move Thread Modal */}
      {moveThreadInfo && (
        <MoveThreadModal
          conversationId={moveThreadInfo.conversationId}
          threadSubject={moveThreadInfo.subject}
          currentCaseId={moveThreadInfo.currentCaseId}
          currentCaseTitle={moveThreadInfo.currentCaseTitle}
          onClose={handleMoveThreadClose}
          onMoved={handleMoveThreadComplete}
        />
      )}
    </PageLayout>
  );
}
