'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useDeleteMapa } from '@/hooks/useMapa';
import type { Mapa } from '@/types/mapa';

interface DeleteMapaDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The mapa to delete */
  mapa: Mapa;
  /** Callback when deletion succeeds */
  onSuccess?: () => void;
}

export function DeleteMapaDialog({ open, onOpenChange, mapa, onSuccess }: DeleteMapaDialogProps) {
  const { deleteMapa, loading, error } = useDeleteMapa();
  const [localError, setLocalError] = useState<string | null>(null);

  const slotCount = mapa.slots?.length ?? mapa.completionStatus?.totalSlots ?? 0;

  const handleDelete = async () => {
    setLocalError(null);

    const success = await deleteMapa(mapa.id);

    if (success) {
      onOpenChange(false);
      onSuccess?.();
    } else if (error) {
      setLocalError(error.message);
    } else {
      setLocalError('Failed to delete mapa. Please try again.');
    }
  };

  const handleCancel = () => {
    setLocalError(null);
    onOpenChange(false);
  };

  const displayError = localError || error?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-linear-error/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-linear-error" />
            </div>
            <DialogTitle>Delete Mapa</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            This action cannot be undone. This will permanently delete the mapa and all associated
            data.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          {/* Mapa name display */}
          <div className="p-3 rounded-md bg-linear-bg-tertiary border border-linear-border-subtle">
            <p className="text-sm text-linear-text-secondary mb-1">You are about to delete:</p>
            <p className="font-medium text-linear-text-primary">{mapa.name}</p>
            {slotCount > 0 && (
              <p className="text-sm text-linear-text-tertiary mt-2">
                This will also delete{' '}
                <span className="font-medium text-linear-error">
                  {slotCount} slot{slotCount !== 1 ? 's' : ''}
                </span>{' '}
                and their document assignments.
              </p>
            )}
          </div>

          {/* Error message */}
          {displayError && (
            <div className="mt-4 p-3 rounded-md bg-linear-error/10 border border-linear-error/20">
              <p className="text-sm text-linear-error">{displayError}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={loading}
            leftIcon={<Trash2 className="h-4 w-4" />}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

DeleteMapaDialog.displayName = 'DeleteMapaDialog';

export default DeleteMapaDialog;
