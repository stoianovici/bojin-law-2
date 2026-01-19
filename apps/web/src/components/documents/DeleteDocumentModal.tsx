'use client';

/**
 * DeleteDocumentModal Component
 * Confirmation dialog for permanently deleting a document.
 * Uses the permanentlyDeleteDocument mutation (Partners only).
 */

import React from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/components/ui';
import { useDeleteDocument } from '@/hooks/cache';

// ============================================================================
// Types
// ============================================================================

export interface DeleteDocumentModalProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Document ID */
  documentId: string;
  /** Document name for display */
  documentName: string;
  /** Callback when delete is successful - should refetch documents */
  onSuccess?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function DeleteDocumentModal({
  open,
  onOpenChange,
  documentId,
  documentName,
  onSuccess,
}: DeleteDocumentModalProps) {
  const { deleteMutation, loading, error } = useDeleteDocument({
    onSuccess: () => {
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err) => {
      console.error('Failed to delete document:', err);
    },
  });

  const handleConfirm = async () => {
    await deleteMutation(documentId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-linear-error" />
            Șterge Document
          </DialogTitle>
          <DialogDescription>
            Sunteți sigur că doriți să ștergeți documentul{' '}
            <strong className="text-linear-text-primary">&ldquo;{documentName}&rdquo;</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          <div className="p-3 bg-linear-error/10 border border-linear-error/20 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-linear-error flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-linear-error text-sm">
                Această acțiune este ireversibilă.
              </p>
              <p className="text-linear-text-secondary text-sm mt-1">
                Documentul va fi șters permanent din toate dosarele și din spațiul de stocare.
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-linear-error">
              Nu s-a putut șterge documentul. Verificați dacă aveți permisiunile necesare.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Anulează
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Trash2 className="h-4 w-4 mr-2" />
            Șterge permanent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

DeleteDocumentModal.displayName = 'DeleteDocumentModal';
