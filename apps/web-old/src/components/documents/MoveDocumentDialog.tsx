'use client';

/**
 * MoveDocumentDialog Component
 * OPS-162: Document Preview - Implement Secondary Action Buttons
 *
 * Dialog for moving a document to a different folder.
 * Uses the moveDocumentToFolder mutation via useFolderActions hook.
 */

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { FolderInput, X, Loader2, Folder, FolderOpen, Home, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useNotificationStore } from '../../stores/notificationStore';
import { useFolderActions } from '../../hooks/useFolderActions';
import type { FolderTree, FolderInfo } from '../../hooks/useDocumentFolders';

// ============================================================================
// Types
// ============================================================================

export interface MoveDocumentDialogProps {
  /** CaseDocument join table ID (not the document ID) */
  caseDocumentId: string;
  documentName: string;
  currentFolderId: string | null;
  folderTree: FolderTree | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ============================================================================
// Helper Components
// ============================================================================

interface FolderItemProps {
  folder: FolderInfo;
  depth: number;
  selectedId: string | null;
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  expandedFolders: Set<string>;
  toggleExpanded: (folderId: string) => void;
}

function FolderItem({
  folder,
  depth,
  selectedId,
  currentFolderId,
  onSelect,
  expandedFolders,
  toggleExpanded,
}: FolderItemProps) {
  const hasChildren = folder.children && folder.children.length > 0;
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedId === folder.id;
  const isCurrent = currentFolderId === folder.id;

  return (
    <div>
      <div
        onClick={() => !isCurrent && onSelect(folder.id)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
          isSelected && !isCurrent && 'bg-blue-50 border border-blue-200',
          isCurrent && 'bg-gray-100 text-gray-400 cursor-not-allowed',
          !isSelected && !isCurrent && 'hover:bg-gray-50'
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(folder.id);
            }}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            <ChevronRight
              className={clsx(
                'h-4 w-4 text-gray-400 transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          </button>
        )}
        {!hasChildren && <span className="w-5" />}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500" />
        )}
        <span className={clsx('text-sm truncate', isCurrent && 'text-gray-400')}>
          {folder.name}
          {isCurrent && ' (curent)'}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {folder.children!.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedId={selectedId}
              currentFolderId={currentFolderId}
              onSelect={onSelect}
              expandedFolders={expandedFolders}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function MoveDocumentDialog({
  caseDocumentId,
  documentName,
  currentFolderId,
  folderTree,
  open,
  onOpenChange,
  onSuccess,
}: MoveDocumentDialogProps) {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { moveDocumentToFolder, loading } = useFolderActions();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Reset selection when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedFolderId(null);
      // Expand all folders by default for easier navigation
      if (folderTree) {
        const allFolderIds = new Set<string>();
        const collectIds = (folders: FolderInfo[]) => {
          folders.forEach((f) => {
            if (f.children && f.children.length > 0) {
              allFolderIds.add(f.id);
              collectIds(f.children);
            }
          });
        };
        collectIds(folderTree.folders);
        setExpandedFolders(allFolderIds);
      }
    }
  }, [open, folderTree]);

  const toggleExpanded = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const isRootSelected = selectedFolderId === null && currentFolderId !== null;
  const hasFolders = folderTree && folderTree.folders.length > 0;

  const handleMove = async () => {
    // If selecting root when already at root, or selecting same folder, do nothing
    if (selectedFolderId === currentFolderId) {
      onOpenChange(false);
      return;
    }

    try {
      await moveDocumentToFolder(caseDocumentId, selectedFolderId);
      const destination = selectedFolderId
        ? (folderTree?.folders.find((f) => f.id === selectedFolderId)?.name ?? 'folder')
        : 'rădăcină';
      addNotification({
        type: 'success',
        title: 'Document mutat',
        message: `„${documentName}" a fost mutat în ${destination}.`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to move document:', error);
      addNotification({
        type: 'error',
        title: 'Eroare la mutare',
        message: 'Nu s-a putut muta documentul.',
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
              <FolderInput className="h-5 w-5 text-blue-500" />
              Mută Document
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
            Selectați destinația pentru <strong>&ldquo;{documentName}&rdquo;</strong>:
          </p>

          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto mb-6">
            {/* Root option */}
            <div
              onClick={() => currentFolderId !== null && setSelectedFolderId(null)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-b border-gray-100',
                isRootSelected && 'bg-blue-50 border-l-2 border-l-blue-500',
                currentFolderId === null && 'bg-gray-100 text-gray-400 cursor-not-allowed',
                !isRootSelected && currentFolderId !== null && 'hover:bg-gray-50'
              )}
            >
              <Home className="h-4 w-4 text-gray-500" />
              <span className="text-sm">
                Rădăcină dosar
                {currentFolderId === null && ' (curent)'}
              </span>
            </div>

            {/* Folder tree */}
            {hasFolders ? (
              <div className="py-1">
                {folderTree!.folders.map((folder) => (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    depth={0}
                    selectedId={selectedFolderId}
                    currentFolderId={currentFolderId}
                    onSelect={setSelectedFolderId}
                    expandedFolders={expandedFolders}
                    toggleExpanded={toggleExpanded}
                  />
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
                Nu există dosare. Documentul poate fi mutat doar la rădăcină.
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
              onClick={handleMove}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={
                loading || (selectedFolderId === currentFolderId && selectedFolderId !== null)
              }
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Mută
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

MoveDocumentDialog.displayName = 'MoveDocumentDialog';
