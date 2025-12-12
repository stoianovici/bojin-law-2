'use client';

// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { FilterBar } from '../../components/communication/FilterBar';
import { ThreadList } from '../../components/communication/ThreadList';
import { MessageView } from '../../components/communication/MessageView';
import { AIDraftResponsePanel } from '../../components/communication/AIDraftResponsePanel';
import { ExtractedItemsPanel } from '../../components/communication/ExtractedItemsPanel';
import { ComposeInterface } from '../../components/communication/ComposeInterface';
import { useCommunicationStore } from '../../stores/communication.store';
import { useEmailSync, useEmailThreads } from '../../hooks/useEmailSync';
import { useAuth } from '../../contexts/AuthContext';
import { RefreshCw, Mail, AlertCircle, Link2 } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

export default function CommunicationsPage() {
  const { setThreads, getSelectedThread, setUserEmail } = useCommunicationStore();
  const selectedThread = getSelectedThread();

  // Auth context for Microsoft account status and user email
  const { hasMsalAccount, reconnectMicrosoft, user } = useAuth();

  // State for MS token required error (shows reconnect prompt)
  const [showMsReconnectPrompt, setShowMsReconnectPrompt] = useState(false);

  // Set user email in store for sent/received filtering
  useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email);
    }
  }, [user?.email, setUserEmail]);

  // Listen for MS_TOKEN_REQUIRED errors from Apollo client
  useEffect(() => {
    const handleMsTokenRequired = () => {
      console.log('[Communications] MS token required event received');
      setShowMsReconnectPrompt(true);
    };

    window.addEventListener('ms-token-required', handleMsTokenRequired);
    return () => window.removeEventListener('ms-token-required', handleMsTokenRequired);
  }, []);

  // Handle Microsoft reconnect
  const handleReconnectMicrosoft = useCallback(async () => {
    setShowMsReconnectPrompt(false);
    await reconnectMicrosoft();
  }, [reconnectMicrosoft]);

  // Email sync status and actions
  const { syncStatus, syncing, startSync, loading: syncLoading } = useEmailSync();

  // Fetch email threads from API
  const {
    threads: apiThreads,
    loading: threadsLoading,
    error: threadsError,
    refetch,
  } = useEmailThreads();

  // Transform API threads to communication store format and update store
  useEffect(() => {
    console.log(
      '[Communications] apiThreads received:',
      apiThreads?.length,
      'loading:',
      threadsLoading,
      'error:',
      threadsError?.message
    );
    if (apiThreads && apiThreads.length > 0) {
      // Transform EmailThread[] to CommunicationThread[]
      const communicationThreads = apiThreads.map((thread: any) => {
        // Build unique participants from all emails in thread
        const participantMap = new Map<string, { id: string; name: string; email: string }>();

        (thread.emails || []).forEach((email: any) => {
          // Add sender
          if (email.from?.address && !participantMap.has(email.from.address)) {
            participantMap.set(email.from.address, {
              id: email.from.address,
              name: email.from.name || email.from.address,
              email: email.from.address,
            });
          }
          // Add recipients
          (email.toRecipients || []).forEach((r: any) => {
            if (r.address && !participantMap.has(r.address)) {
              participantMap.set(r.address, {
                id: r.address,
                name: r.name || r.address,
                email: r.address,
              });
            }
          });
          // Add CC recipients
          (email.ccRecipients || []).forEach((r: any) => {
            if (r.address && !participantMap.has(r.address)) {
              participantMap.set(r.address, {
                id: r.address,
                name: r.name || r.address,
                email: r.address,
              });
            }
          });
        });

        return {
          id: thread.id || thread.conversationId,
          conversationId: thread.conversationId,
          subject: thread.subject || '(Fără subiect)',
          caseId: thread.case?.id || '',
          caseType: thread.case?.type || 'Other',
          caseName: thread.case?.title || 'Neatribuit',
          participants: Array.from(participantMap.values()),
          messages: (thread.emails || []).map((email: any) => ({
            id: email.id,
            threadId: thread.id || thread.conversationId,
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
            // Use sentDate to match CommunicationMessage type, with fallback for invalid dates
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
          lastMessageDate: new Date(thread.lastMessageDate || Date.now()),
          isUnread: thread.hasUnread ?? false,
          hasAttachments: thread.hasAttachments ?? false,
          isProcessed: false,
          extractedItems: {
            deadlines: [],
            commitments: [],
            actionItems: [],
          },
        };
      });
      setThreads(communicationThreads);
    }
  }, [apiThreads, setThreads]);

  const handleSync = async () => {
    console.log('[Communications] handleSync called, hasMsalAccount:', hasMsalAccount);
    try {
      console.log('[Communications] Calling startSync mutation...');
      const result = await startSync();
      console.log('[Communications] startSync result:', result);
      // Refetch threads after sync completes
      setTimeout(() => refetch(), 2000);
    } catch (error) {
      console.error('[Communications] Email sync failed:', error);
    }
  };

  const isLoading = syncLoading || threadsLoading;
  const needsSync = !syncStatus || syncStatus.emailCount === 0;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* Page Header - Controls only, title now in TopBar */}
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        {/* Left: Sync status and button */}
        <div className="flex items-center gap-4">
          {/* Always show sync button - it will work if MSAL token available, or prompt to connect */}
          <button
            onClick={hasMsalAccount ? handleSync : () => reconnectMicrosoft()}
            disabled={syncing || isLoading}
            className={`px-4 py-2 rounded transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              hasMsalAccount
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing
              ? 'Sincronizare...'
              : hasMsalAccount
                ? 'Sincronizează email'
                : 'Conectează pentru sincronizare'}
          </button>

          {/* Show sync status if available */}
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

        {/* Right: Open Outlook for new messages */}
        <a
          href="https://outlook.office.com/mail/0/deeplink/compose"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center gap-2"
          title="Deschide Outlook pentru mesaje noi"
        >
          <Mail className="h-4 w-4" />
          Outlook
        </a>
      </div>

      {/* Show MS reconnect prompt when token is expired/missing */}
      {showMsReconnectPrompt && (
        <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <Link2 className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-amber-900">Reconectare Microsoft necesară</h3>
            <p className="text-sm text-amber-700 mt-1">
              Sesiunea Microsoft a expirat. Reconectați contul pentru a sincroniza emailuri și
              descărca atașamente.
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

      {/* Show sync prompt only if no emails exist yet */}
      {needsSync && !isLoading && !syncing && !showMsReconnectPrompt && (
        <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
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

      {/* Show error if any */}
      {threadsError && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Eroare la încărcarea emailurilor</h3>
            <p className="text-sm text-red-700 mt-1">{threadsError.message}</p>
          </div>
        </div>
      )}

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Thread List */}
        <div className="flex w-full flex-col border-r bg-white md:w-96 lg:w-1/4">
          <FilterBar />
          <ThreadList className="flex-1" />
        </div>

        {/* Center Column: Message View (hidden on mobile, shown on md+) */}
        <div className="hidden flex-1 flex-col md:flex overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <MessageView />
          </div>
          <div className="flex-shrink-0">
            <AIDraftResponsePanel />
          </div>
        </div>

        {/* Right Column: Extracted Items Panel (hidden on tablet, shown on lg+) */}
        <div className="hidden w-80 flex-col border-l bg-white lg:flex overflow-y-auto">
          {selectedThread ? (
            selectedThread.caseId ? (
              <ExtractedItemsPanel caseId={selectedThread.caseId} />
            ) : (
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Elemente extrase</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Această conversație nu este asociată cu un dosar.
                </p>
                <p className="text-xs text-gray-400">
                  Asociați emailul cu un dosar pentru a extrage automat termene, angajamente și
                  acțiuni folosind AI.
                </p>
              </div>
            )
          ) : (
            <div className="p-4 text-sm text-gray-500">
              Selectați o conversație pentru a vedea elementele extrase
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      <ComposeInterface />
    </main>
  );
}
