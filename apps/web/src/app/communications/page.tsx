'use client';

/**
 * Communications Page - Case-Organized Redesign
 * OPS-041: /communications Case-Organized Redesign
 *
 * User's email workspace organized by case with separate sections
 * for court emails (INSTANȚE) and uncertain classifications (NECLAR).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Mail,
  AlertCircle,
  Link2,
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

// Hooks
import { useMyEmailsByCase } from '../../hooks/useMyEmailsByCase';
import { useEmailSync, useEmailThread } from '../../hooks/useEmailSync';
import { useCommunicationStore } from '../../stores/communication.store';
import { useAuth } from '../../contexts/AuthContext';
import { useSetAIContext } from '../../contexts/AIAssistantContext';
import { useThreadAttachments, findAttachmentById } from '../../hooks/useThreadAttachments';
import { useLazyQuery } from '@apollo/client/react';
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

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'thread' | 'court-email' | 'uncertain-email' | 'none';

interface ViewState {
  mode: ViewMode;
  threadId: string | null;
  emailId: string | null;
  caseId: string | null;
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

  // Handle Microsoft reconnect
  const handleReconnectMicrosoft = useCallback(async () => {
    setShowMsReconnectPrompt(false);
    await reconnectMicrosoft();
  }, [reconnectMicrosoft]);

  // Handle sync
  const handleSync = async () => {
    try {
      await startSync();
      setTimeout(() => refetch(), 2000);
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
    });
  }, []);

  // Handle court email selection - show in main panel (future: could show details)
  const handleSelectCourtEmail = useCallback((emailId: string) => {
    setViewState({
      mode: 'court-email',
      threadId: null,
      emailId,
      caseId: null,
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
    });
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
  const needsSync = !syncStatus || syncStatus.emailCount === 0;
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

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* Page Header */}
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between flex-shrink-0">
        {/* Left: Sync status and button */}
        <div className="flex items-center gap-4">
          <button
            onClick={hasMsalAccount ? handleSync : () => reconnectMicrosoft()}
            disabled={syncing || isLoading}
            className={clsx(
              'px-4 py-2 rounded transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
              hasMsalAccount
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-amber-500 text-white hover:bg-amber-600'
            )}
          >
            <RefreshCw className={clsx('h-4 w-4', syncing && 'animate-spin')} />
            {syncing
              ? 'Sincronizare...'
              : hasMsalAccount
                ? 'Sincronizează email'
                : 'Conectează pentru sincronizare'}
          </button>

          {syncStatus && (
            <span className="text-sm text-gray-500">
              {syncStatus.emailCount} emailuri sincronizate
              {syncStatus.lastSyncAt && (
                <span className="ml-2">
                  • Ultima sincronizare: {new Date(syncStatus.lastSyncAt).toLocaleString('ro-RO')}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Right: View mode toggle + Open Outlook */}
        <div className="flex items-center gap-3">
          {/* OPS-121: View mode toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setThreadViewMode('conversation')}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5',
                threadViewMode === 'conversation'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
              title="Vizualizare conversație"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Conversație</span>
            </button>
            <button
              onClick={() => setThreadViewMode('cards')}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5',
                threadViewMode === 'cards'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
              title="Vizualizare carduri"
            >
              <LayoutList className="h-4 w-4" />
              <span className="hidden sm:inline">Carduri</span>
            </button>
          </div>

          <a
            href="https://outlook.office.com/mail/0/deeplink/compose"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center gap-2"
            title="Deschide Outlook pentru mesaje noi"
          >
            <Mail className="h-4 w-4" />
            Outlook
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* MS Reconnect Prompt */}
      {showMsReconnectPrompt && (
        <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 flex-shrink-0">
          <Link2 className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-amber-900">Reconectare Microsoft necesară</h3>
            <p className="text-sm text-amber-700 mt-1">
              Sesiunea Microsoft a expirat. Reconectați contul pentru a sincroniza emailuri.
            </p>
          </div>
          <button
            onClick={handleReconnectMicrosoft}
            className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors flex items-center gap-2 text-sm"
          >
            <Link2 className="h-4 w-4" />
            Reconectează
          </button>
        </div>
      )}

      {/* Sync Prompt */}
      {needsSync && !isLoading && !syncing && !showMsReconnectPrompt && (
        <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3 flex-shrink-0">
          <Mail className="h-5 w-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">
              {hasMsalAccount ? 'Sincronizați emailurile' : 'Conectați contul Microsoft'}
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              {hasMsalAccount
                ? 'Apăsați butonul "Sincronizează email" pentru a importa emailurile din contul Microsoft.'
                : 'Apăsați butonul "Conectează pentru sincronizare" pentru a importa emailurile din Outlook.'}
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {emailsError && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Eroare la încărcarea emailurilor</h3>
            <p className="text-sm text-red-700 mt-1">{emailsError.message}</p>
          </div>
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Case Sidebar */}
        <div className="w-80 lg:w-96 border-r bg-white flex-shrink-0 overflow-hidden">
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
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-3xl mx-auto">
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {selectedCourtEmail.subject || '(Fără subiect)'}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                          De la: {selectedCourtEmail.from.name || selectedCourtEmail.from.address}
                          {selectedCourtEmail.from.name && (
                            <span className="text-gray-400 ml-1">
                              &lt;{selectedCourtEmail.from.address}&gt;
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
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
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                          {selectedCourtEmail.institutionCategory}
                        </span>
                      )}
                    </div>

                    {selectedCourtEmail.extractedReferences.length > 0 && (
                      <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                        <p className="text-sm font-medium text-purple-900 mb-2">
                          Numere de referință extrase:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCourtEmail.extractedReferences.map((ref, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-white text-purple-700 text-sm rounded border border-purple-200"
                            >
                              {ref}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="prose prose-sm max-w-none text-gray-700">
                      {selectedCourtEmail.bodyPreview}
                    </div>

                    {selectedCourtEmail.suggestedCases.length > 0 && (
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-3">
                          Dosare sugerate pentru atribuire:
                        </p>
                        <div className="space-y-2">
                          {selectedCourtEmail.suggestedCases.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between p-2 bg-white rounded border"
                            >
                              <div>
                                <span className="font-medium text-gray-900">{c.title}</span>
                                <span className="text-sm text-gray-500 ml-2">{c.caseNumber}</span>
                              </div>
                              <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
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
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Mail className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p>Selectați o conversație din stânga</p>
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
    </main>
  );
}
