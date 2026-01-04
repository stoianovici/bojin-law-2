'use client';

/**
 * RenameFolderModal Component
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 *
 * Modal for renaming an existing folder.
 */

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';
import { Pencil } from 'lucide-react';
import { useFolderActions } from '../../hooks/useFolderActions';

// ============================================================================
// Types
// ============================================================================

export interface RenameFolderModalProps {
  folderId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (folder: { id: string; name: string }) => void;
}

// ============================================================================
// Component
// ============================================================================

export function RenameFolderModal({
  folderId,
  currentName,
  open,
  onOpenChange,
  onSuccess,
}: RenameFolderModalProps) {
  const { renameFolder, updating } = useFolderActions();

  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  // Sync name when currentName prop changes
  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Numele dosarului este obligatoriu');
      return;
    }

    if (trimmedName === currentName) {
      // No change, just close
      handleClose();
      return;
    }

    try {
      const result = await renameFolder(folderId, trimmedName);

      if (result) {
        onSuccess?.({ id: folderId, name: trimmedName });
        handleClose();
      }
    } catch {
      setError('Nu s-a putut redenumi dosarul. Încercați din nou.');
    }
  };

  const handleClose = () => {
    setName(currentName);
    setError(null);
    onOpenChange(false);
  };

  const hasChanges = name.trim() !== currentName;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto focus:outline-none z-50">
          <Dialog.Title className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Pencil className="h-5 w-5 text-blue-500" />
            Redenumește Dosar
          </Dialog.Title>

          <Dialog.Description className="text-sm text-gray-600 mb-6">
            Introduceți noul nume pentru dosarul &ldquo;{currentName}&rdquo;
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Folder Name */}
            <div>
              <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 mb-1">
                Nume dosar <span className="text-red-500">*</span>
              </label>
              <input
                id="folderName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Documente client"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                disabled={updating}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={updating}
                >
                  Anulează
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={updating || !name.trim() || !hasChanges}
              >
                {updating && (
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
                Salvează
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Închide"
            >
              <Cross2Icon className="h-5 w-5" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

RenameFolderModal.displayName = 'RenameFolderModal';
