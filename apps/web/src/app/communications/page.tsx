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
import { Plus, RefreshCw, Mail, AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function CommunicationsPage() {
  const { openCompose, setThreads, getSelectedThread } = useCommunicationStore();
  const selectedThread = getSelectedThread();

  // Auth context for Microsoft account status
  const { hasMsalAccount, reconnectMicrosoft } = useAuth();

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
    if (apiThreads && apiThreads.length > 0) {
      // Transform EmailThread[] to CommunicationThread[]
      const communicationThreads = apiThreads.map((thread: any) => ({
        id: thread.id || thread.conversationId,
        conversationId: thread.conversationId,
        subject: thread.subject || '(Fără subiect)',
        caseId: thread.case?.id || '',
        caseType: thread.case?.type || 'Other',
        caseName: thread.case?.title || 'Neatribuit',
        participants: [], // TODO: populate from thread participants
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
      }));
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

        {/* Right: New message button */}
        <button
          onClick={() => openCompose('new')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Mesaj nou
        </button>
      </div>

      {/* Show sync prompt only if no emails exist yet */}
      {needsSync && !isLoading && !syncing && (
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
        <div className="hidden flex-1 flex-col md:flex">
          <MessageView />
          <AIDraftResponsePanel />
        </div>

        {/* Right Column: Extracted Items Panel (hidden on tablet, shown on lg+) */}
        <div className="hidden w-80 flex-col border-l bg-white lg:flex overflow-y-auto">
          {selectedThread?.caseId ? (
            <ExtractedItemsPanel caseId={selectedThread.caseId} />
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
