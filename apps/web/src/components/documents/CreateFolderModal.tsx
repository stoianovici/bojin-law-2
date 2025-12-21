'use client';

/**
 * CreateFolderModal Component
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 *
 * Modal for creating a new folder within a case's folder hierarchy.
 */

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';
import { Folder, FolderPlus } from 'lucide-react';
import { useFolderActions } from '../../hooks/useFolderActions';
import { useCaseFolders } from '../../hooks/useDocumentFolders';
import type { FolderInfo } from '../../hooks/useDocumentFolders';

// ============================================================================
// Types
// ============================================================================

export interface CreateFolderModalProps {
  caseId: string;
  caseName: string;
  parentFolderId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (folder: { id: string; name: string }) => void;
}

// ============================================================================
// Component
// ============================================================================

export function CreateFolderModal({
  caseId,
  caseName,
  parentFolderId,
  open,
  onOpenChange,
  onSuccess,
}: CreateFolderModalProps) {
  const { createFolder, creating } = useFolderActions();
  const { folders, loading: foldersLoading } = useCaseFolders(caseId);

  // Initialize state from prop - parent ID updates when modal opens with different parent
  const [name, setName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(parentFolderId ?? null);
  const [error, setError] = useState<string | null>(null);

  // Sync parent folder when modal opens with new parent (controlled via key prop by parent)
  // Note: Parent should pass key={parentFolderId} to reset state on parent change

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Numele dosarului este obligatoriu');
      return;
    }

    try {
      const result = await createFolder({
        name: trimmedName,
        caseId,
        parentId: selectedParentId ?? undefined,
      });

      if (result) {
        onSuccess?.(result);
        handleClose();
      }
    } catch {
      setError('Nu s-a putut crea dosarul. Încercați din nou.');
    }
  };

  const handleClose = () => {
    setName('');
    setSelectedParentId(parentFolderId ?? null);
    setError(null);
    onOpenChange(false);
  };

  // Build flat list with indentation for parent selection
  const buildFolderOptions = (
    folderList: FolderInfo[],
    depth = 0
  ): { id: string; name: string; depth: number }[] => {
    const options: { id: string; name: string; depth: number }[] = [];
    for (const folder of folderList) {
      options.push({ id: folder.id, name: folder.name, depth });
      if (folder.children && folder.children.length > 0) {
        options.push(...buildFolderOptions(folder.children, depth + 1));
      }
    }
    return options;
  };

  const folderOptions = buildFolderOptions(folders);

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto focus:outline-none z-50">
          <Dialog.Title className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-amber-500" />
            Dosar Nou
          </Dialog.Title>

          <Dialog.Description className="text-sm text-gray-600 mb-6">
            Creați un nou dosar în {caseName}
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
                disabled={creating}
              />
            </div>

            {/* Parent Folder Selection */}
            <div>
              <label
                htmlFor="parentFolder"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Dosar părinte
              </label>
              <select
                id="parentFolder"
                value={selectedParentId ?? ''}
                onChange={(e) => setSelectedParentId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={creating || foldersLoading}
              >
                <option value="">Rădăcină (fără părinte)</option>
                {folderOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {'  '.repeat(folder.depth)}
                    {folder.depth > 0 ? '└ ' : ''}
                    {folder.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Lăsați gol pentru a crea dosarul la nivelul principal
              </p>
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
                  disabled={creating}
                >
                  Anulează
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={creating || !name.trim()}
              >
                {creating && (
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
                <Folder className="h-4 w-4" />
                Crează Dosar
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

CreateFolderModal.displayName = 'CreateFolderModal';
