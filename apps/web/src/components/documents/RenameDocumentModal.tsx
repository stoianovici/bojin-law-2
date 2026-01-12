'use client';

/**
 * RenameDocumentModal Component
 * Modal for renaming a document.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { useMutation } from '@apollo/client/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
} from '@/components/ui';
import { RENAME_DOCUMENT } from '@/graphql/mutations';

// ============================================================================
// Types
// ============================================================================

export interface RenameDocumentModalProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Document ID */
  documentId: string;
  /** Current document name */
  currentName: string;
  /** Callback when rename is successful - should refetch documents */
  onSuccess?: (newName: string) => void;
}

interface RenameDocumentMutationResult {
  renameDocument: {
    id: string;
    fileName: string;
  };
}

// Helper to split filename and extension
function splitFileName(fileName: string): { name: string; extension: string } {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return {
      name: fileName.slice(0, lastDotIndex),
      extension: fileName.slice(lastDotIndex), // includes the dot
    };
  }
  return { name: fileName, extension: '' };
}

// ============================================================================
// Component
// ============================================================================

export function RenameDocumentModal({
  open,
  onOpenChange,
  documentId,
  currentName,
  onSuccess,
}: RenameDocumentModalProps) {
  // Split filename from extension
  const { name: currentNameWithoutExt, extension } = splitFileName(currentName);

  const [newName, setNewName] = useState(currentNameWithoutExt);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [renameDocument, { loading }] = useMutation<RenameDocumentMutationResult>(RENAME_DOCUMENT);

  // Reset and focus when dialog opens
  useEffect(() => {
    if (open) {
      setNewName(currentNameWithoutExt);
      setError(null);
      // Focus and select all text
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    }
  }, [open, currentNameWithoutExt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setError('Numele fișierului nu poate fi gol.');
      return;
    }

    // If the name hasn't changed, just close the modal
    if (trimmedName === currentNameWithoutExt) {
      onOpenChange(false);
      return;
    }

    // Add extension back to form the full filename
    const fullNewName = trimmedName + extension;

    try {
      await renameDocument({
        variables: { documentId, newFileName: fullNewName },
      });
      onSuccess?.(fullNewName);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to rename document:', err);
      setError('Nu s-a putut redenumi documentul.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-linear-accent" />
            Redenumește Document
          </DialogTitle>
          <DialogDescription>
            Introduceți noul nume pentru document.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="p-6 pt-2">
            <label
              htmlFor="documentName"
              className="block text-sm font-medium text-linear-text-secondary mb-2"
            >
              Nume fișier
            </label>
            <div className="flex items-center gap-0">
              <Input
                ref={inputRef}
                id="documentName"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Introduceți noul nume"
                disabled={loading}
                className="rounded-r-none border-r-0"
              />
              {extension && (
                <div className="h-8 px-3 flex items-center bg-linear-bg-tertiary border border-l-0 border-linear-border-subtle rounded-r-md text-sm text-linear-text-secondary">
                  {extension}
                </div>
              )}
            </div>
            {error && (
              <p className="mt-2 text-sm text-linear-error">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Anulează
            </Button>
            <Button type="submit" disabled={loading || !newName.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvează
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

RenameDocumentModal.displayName = 'RenameDocumentModal';
