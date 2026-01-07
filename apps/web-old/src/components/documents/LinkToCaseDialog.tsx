'use client';

/**
 * LinkToCaseDialog Component
 * OPS-162: Document Preview - Implement Secondary Action Buttons
 *
 * Dialog for linking a document to additional cases.
 * Uses the linkDocumentsToCase mutation via useLinkDocuments hook.
 * Role restricted: Partner, Associate only.
 */

import React, { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link, X, Loader2, Search, Briefcase, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useNotificationStore } from '../../stores/notificationStore';
import { useLinkDocuments } from '../../hooks/useDocumentActions';
import { useCases } from '../../hooks/useCases';

// ============================================================================
// Types
// ============================================================================

export interface LinkToCaseDialogProps {
  /** Document ID to link */
  documentId: string;
  documentName: string;
  /** Current case ID (to exclude from list) */
  currentCaseId: string;
  /** Client ID to filter cases (only same client) */
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function LinkToCaseDialog({
  documentId,
  documentName,
  currentCaseId,
  clientId,
  open,
  onOpenChange,
  onSuccess,
}: LinkToCaseDialogProps) {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { linkDocuments, loading: linkLoading } = useLinkDocuments();
  const { cases, loading: casesLoading } = useCases({ clientId });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSelectedCaseId(null);
    }
  }, [open]);

  // Filter cases: same client, exclude current case, apply search
  const filteredCases = useMemo(() => {
    if (!cases) return [];

    return cases
      .filter((c) => c.id !== currentCaseId)
      .filter((c) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          c.title.toLowerCase().includes(query) ||
          c.caseNumber.toLowerCase().includes(query) ||
          c.client.name.toLowerCase().includes(query)
        );
      });
  }, [cases, currentCaseId, searchQuery]);

  const selectedCase = filteredCases.find((c) => c.id === selectedCaseId);

  const handleLink = async () => {
    if (!selectedCaseId) return;

    try {
      await linkDocuments({
        caseId: selectedCaseId,
        documentIds: [documentId],
      });
      addNotification({
        type: 'success',
        title: 'Document legat',
        message: `„${documentName}" a fost legat de dosarul „${selectedCase?.title}".`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to link document:', error);
      addNotification({
        type: 'error',
        title: 'Eroare la legare',
        message: 'Nu s-a putut lega documentul de dosar.',
      });
    }
  };

  const loading = linkLoading || casesLoading;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-lg focus:outline-none z-50">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Link className="h-5 w-5 text-blue-500" />
              Leagă de Alt Dosar
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                aria-label="Închide"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Selectați un dosar pentru a lega <strong>&ldquo;{documentName}&rdquo;</strong>:
          </p>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Căutați după nume sau număr dosar..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Case list */}
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto mb-6">
            {casesLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                {searchQuery
                  ? 'Niciun dosar găsit pentru această căutare.'
                  : 'Nu există alte dosare disponibile pentru acest client.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredCases.map((caseItem) => (
                  <div
                    key={caseItem.id}
                    onClick={() => setSelectedCaseId(caseItem.id)}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                      selectedCaseId === caseItem.id
                        ? 'bg-blue-50 border-l-2 border-l-blue-500'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <Briefcase
                      className={clsx(
                        'h-5 w-5 flex-shrink-0',
                        selectedCaseId === caseItem.id ? 'text-blue-500' : 'text-gray-400'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {caseItem.title}
                        </span>
                        {selectedCaseId === caseItem.id && (
                          <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {caseItem.caseNumber} • {caseItem.client.name}
                      </div>
                    </div>
                    <span
                      className={clsx(
                        'text-xs px-2 py-0.5 rounded-full',
                        caseItem.status === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : caseItem.status === 'Closed'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-yellow-100 text-yellow-700'
                      )}
                    >
                      {caseItem.status === 'Active'
                        ? 'Activ'
                        : caseItem.status === 'Closed'
                          ? 'Închis'
                          : caseItem.status === 'OnHold'
                            ? 'În așteptare'
                            : caseItem.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <Dialog.Close asChild>
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={loading}
              >
                Anulează
              </button>
            </Dialog.Close>
            <button
              onClick={handleLink}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={loading || !selectedCaseId}
            >
              {linkLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Leagă
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

LinkToCaseDialog.displayName = 'LinkToCaseDialog';
