'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DELETE_CASE } from '@/graphql/mutations';

interface DeleteCaseDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The case to delete */
  caseData: {
    id: string;
    title: string;
    caseNumber: string;
  };
  /** Callback when deletion succeeds */
  onSuccess?: () => void;
}

export function DeleteCaseDialog({
  open,
  onOpenChange,
  caseData,
  onSuccess,
}: DeleteCaseDialogProps) {
  const [deleteCase, { loading, error }] = useMutation(DELETE_CASE);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLocalError(null);

    try {
      await deleteCase({ variables: { id: caseData.id } });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('[DeleteCaseDialog] Failed to delete case:', err);
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Nu s-a putut șterge cazul. Încercați din nou.');
      }
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
            <DialogTitle>Șterge cazul</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Cazul va fi marcat ca șters și nu va mai apărea în listele de cazuri. Datele asociate
            (emailuri, documente, sarcini) vor fi păstrate.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          {/* Case info display */}
          <div className="p-3 rounded-md bg-linear-bg-tertiary border border-linear-border-subtle">
            <p className="text-sm text-linear-text-secondary mb-1">Urmează să ștergeți:</p>
            <p className="font-medium text-linear-text-primary">{caseData.title}</p>
            <p className="text-sm text-linear-text-tertiary mt-1">Nr. {caseData.caseNumber}</p>
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
            Anulează
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={loading}
            leftIcon={<Trash2 className="h-4 w-4" />}
          >
            Șterge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

DeleteCaseDialog.displayName = 'DeleteCaseDialog';

export default DeleteCaseDialog;
