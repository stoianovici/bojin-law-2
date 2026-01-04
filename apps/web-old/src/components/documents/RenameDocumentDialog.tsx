'use client';

/**
 * RenameDocumentDialog Component
 * OPS-162: Document Preview - Implement Secondary Action Buttons
 *
 * Dialog for renaming a document.
 * Uses the renameDocument mutation.
 */

import React, { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Pencil, X, Loader2 } from 'lucide-react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useNotificationStore } from '../../stores/notificationStore';

// ============================================================================
// GraphQL
// ============================================================================

const RENAME_DOCUMENT = gql`
  mutation RenameDocument($documentId: UUID!, $newFileName: String!) {
    renameDocument(documentId: $documentId, newFileName: $newFileName) {
      id
      fileName
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface RenameDocumentDialogProps {
  documentId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newName: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function RenameDocumentDialog({
  documentId,
  currentName,
  open,
  onOpenChange,
  onSuccess,
}: RenameDocumentDialogProps) {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [newName, setNewName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  const [renameDocument, { loading }] = useMutation(RENAME_DOCUMENT, {
    refetchQueries: ['CaseDocumentsGrid', 'CaseFolderTree', 'FolderContents'],
  });

  // Reset and focus when dialog opens
  useEffect(() => {
    if (open) {
      setNewName(currentName);
      // Select filename without extension
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const dotIndex = currentName.lastIndexOf('.');
          if (dotIndex > 0) {
            inputRef.current.setSelectionRange(0, dotIndex);
          } else {
            inputRef.current.select();
          }
        }
      }, 0);
    }
  }, [open, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = newName.trim();
    if (!trimmedName) {
      addNotification({
        type: 'error',
        title: 'Nume invalid',
        message: 'Numele fișierului nu poate fi gol.',
      });
      return;
    }

    if (trimmedName === currentName) {
      onOpenChange(false);
      return;
    }

    try {
      await renameDocument({
        variables: { documentId, newFileName: trimmedName },
      });
      addNotification({
        type: 'success',
        title: 'Document redenumit',
        message: `Documentul a fost redenumit în „${trimmedName}".`,
      });
      onSuccess?.(trimmedName);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to rename document:', error);
      addNotification({
        type: 'error',
        title: 'Eroare la redenumire',
        message: 'Nu s-a putut redenumi documentul.',
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md focus:outline-none z-50">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-500" />
              Redenumește Document
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

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="documentName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Nume fișier
              </label>
              <input
                ref={inputRef}
                id="documentName"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Introduceți noul nume"
                disabled={loading}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={loading}
                >
                  Anulează
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={loading || !newName.trim()}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvează
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

RenameDocumentDialog.displayName = 'RenameDocumentDialog';
