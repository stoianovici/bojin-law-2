'use client';

/**
 * DeleteDocumentDialog Component
 * OPS-162: Document Preview - Implement Secondary Action Buttons
 *
 * Confirmation dialog for permanently deleting a document.
 * Uses the permanentlyDeleteDocument mutation (Partners only).
 */

import React from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useNotificationStore } from '../../stores/notificationStore';

// ============================================================================
// GraphQL
// ============================================================================

const PERMANENTLY_DELETE_DOCUMENT = gql`
  mutation PermanentlyDeleteDocument($documentId: UUID!) {
    permanentlyDeleteDocument(documentId: $documentId)
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface DeleteDocumentDialogProps {
  documentId: string;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function DeleteDocumentDialog({
  documentId,
  documentName,
  open,
  onOpenChange,
  onSuccess,
}: DeleteDocumentDialogProps) {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [deleteDocument, { loading }] = useMutation(PERMANENTLY_DELETE_DOCUMENT, {
    refetchQueries: ['CaseDocumentsGrid', 'CaseFolderTree', 'FolderContents'],
  });

  const handleConfirm = async () => {
    try {
      await deleteDocument({ variables: { documentId } });
      addNotification({
        type: 'success',
        title: 'Document șters',
        message: `„${documentName}" a fost șters permanent.`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete document:', error);
      addNotification({
        type: 'error',
        title: 'Eroare la ștergere',
        message: 'Nu s-a putut șterge documentul. Verificați dacă aveți permisiunile necesare.',
      });
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn z-50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md focus:outline-none z-50">
          <AlertDialog.Title className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Șterge Document
          </AlertDialog.Title>

          <AlertDialog.Description asChild>
            <div className="text-sm text-gray-600 mb-6 space-y-3">
              <p>
                Sunteți sigur că doriți să ștergeți documentul{' '}
                <strong>&ldquo;{documentName}&rdquo;</strong>?
              </p>

              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Această acțiune este ireversibilă.</p>
                  <p className="text-red-700 mt-1">
                    Documentul va fi șters permanent din toate dosarele și din spațiul de stocare.
                  </p>
                </div>
              </div>
            </div>
          </AlertDialog.Description>

          <div className="flex gap-3 justify-end">
            <AlertDialog.Cancel asChild>
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={loading}
              >
                Anulează
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <Trash2 className="h-4 w-4" />
                Șterge permanent
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

DeleteDocumentDialog.displayName = 'DeleteDocumentDialog';
