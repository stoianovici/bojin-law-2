'use client';

/**
 * DeleteFolderDialog Component
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 *
 * Confirmation dialog for deleting a folder with options for handling documents.
 */

import React, { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useFolderActions } from '../../hooks/useFolderActions';

// ============================================================================
// Types
// ============================================================================

export interface DeleteFolderDialogProps {
  folderId: string;
  folderName: string;
  documentCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function DeleteFolderDialog({
  folderId,
  folderName,
  documentCount,
  open,
  onOpenChange,
  onSuccess,
}: DeleteFolderDialogProps) {
  const { deleteFolder, deleting } = useFolderActions();
  const [deleteDocuments, setDeleteDocuments] = useState(false);

  const hasDocuments = documentCount > 0;

  const handleConfirm = async () => {
    try {
      const result = await deleteFolder(folderId, deleteDocuments);

      if (result) {
        onSuccess?.();
        onOpenChange(false);
      }
    } catch {
      // Error handled by hook
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setDeleteDocuments(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn z-50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md focus:outline-none z-50">
          <AlertDialog.Title className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Șterge Dosar
          </AlertDialog.Title>

          <AlertDialog.Description asChild>
            <div className="text-sm text-gray-600 mb-6 space-y-3">
              <p>
                Sunteți sigur că doriți să ștergeți dosarul{' '}
                <strong>&ldquo;{folderName}&rdquo;</strong>?
              </p>

              {hasDocuments && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">
                      Acest dosar conține {documentCount} document{documentCount !== 1 ? 'e' : ''}.
                    </p>
                    <p className="text-amber-700 mt-1">Alegeți ce se întâmplă cu documentele:</p>
                  </div>
                </div>
              )}

              {hasDocuments && (
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="documentAction"
                      checked={!deleteDocuments}
                      onChange={() => setDeleteDocuments(false)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Mută la rădăcină</p>
                      <p className="text-xs text-gray-500">
                        Documentele vor fi mutate în folderul principal al dosarului
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="documentAction"
                      checked={deleteDocuments}
                      onChange={() => setDeleteDocuments(true)}
                      className="h-4 w-4 text-red-600"
                    />
                    <div>
                      <p className="font-medium text-red-600">Șterge documentele</p>
                      <p className="text-xs text-gray-500">
                        Documentele vor fi șterse permanent din dosar
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {!hasDocuments && (
                <p className="text-gray-500">Dosarul este gol și poate fi șters în siguranță.</p>
              )}
            </div>
          </AlertDialog.Description>

          <div className="flex gap-3 justify-end">
            <AlertDialog.Cancel asChild>
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={deleting}
              >
                Anulează
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={deleting}
              >
                {deleting && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                <Trash2 className="h-4 w-4" />
                Șterge
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

DeleteFolderDialog.displayName = 'DeleteFolderDialog';
