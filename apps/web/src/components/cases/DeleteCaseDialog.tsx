'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2, Archive, TrashIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteCase } from '@/hooks/cache';

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
    referenceNumbers?: string[];
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
  const [archiveDocuments, setArchiveDocuments] = useState<boolean>(true);

  const { deleteMutation, loading, error, resetError } = useDeleteCase({
    onSuccess: () => {
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => {
      console.error('[DeleteCaseDialog] Failed to delete case:', err);
    },
  });

  const handleDelete = async () => {
    await deleteMutation(caseData.id, { archiveDocuments });
  };

  const handleCancel = () => {
    resetError();
    setArchiveDocuments(true); // Reset to default
    onOpenChange(false);
  };

  const displayError = error?.message;

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
            Cazul va fi șters permanent. Această acțiune nu poate fi anulată.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          {/* Case info display */}
          <div className="p-3 rounded-md bg-linear-bg-tertiary border border-linear-border-subtle">
            <p className="text-sm text-linear-text-secondary mb-1">Urmează să ștergeți:</p>
            <p className="font-medium text-linear-text-primary">{caseData.title}</p>
            {caseData.referenceNumbers?.[0] && (
              <p className="text-sm text-linear-text-tertiary mt-1">
                Nr. {caseData.referenceNumbers[0]}
              </p>
            )}
          </div>

          {/* Deletion consequences */}
          <div className="mt-4 p-3 rounded-md bg-linear-warning/5 border border-linear-warning/20">
            <p className="text-sm font-medium text-linear-text-primary mb-2">Ce se va întâmpla:</p>
            <ul className="text-sm text-linear-text-secondary space-y-1.5">
              <li>• Sarcinile vor fi mutate în inbox-ul clientului</li>
              <li>• Emailurile vor fi mutate în inbox-ul clientului</li>
            </ul>
          </div>

          {/* Document handling options */}
          <div className="mt-4">
            <p className="text-sm font-medium text-linear-text-primary mb-3">
              Ce faceți cu documentele?
            </p>
            <div className="space-y-3">
              <label
                className={`flex items-start space-x-3 p-3 rounded-md border transition-colors cursor-pointer ${
                  archiveDocuments
                    ? 'border-linear-accent bg-linear-accent/5'
                    : 'border-linear-border-subtle hover:border-linear-border-default'
                }`}
              >
                <input
                  type="radio"
                  name="document-handling"
                  value="archive"
                  checked={archiveDocuments}
                  onChange={() => setArchiveDocuments(true)}
                  className="mt-1 h-4 w-4 text-linear-accent focus:ring-linear-accent border-linear-border-default"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Archive className="h-4 w-4 text-linear-text-secondary" />
                    <span className="font-medium text-linear-text-primary">
                      Arhivează în inbox-ul clientului
                    </span>
                  </div>
                  <p className="text-sm text-linear-text-secondary">
                    Toate documentele vor fi mutate în folderul clientului
                  </p>
                </div>
              </label>
              <label
                className={`flex items-start space-x-3 p-3 rounded-md border transition-colors cursor-pointer ${
                  !archiveDocuments
                    ? 'border-linear-accent bg-linear-accent/5'
                    : 'border-linear-border-subtle hover:border-linear-border-default'
                }`}
              >
                <input
                  type="radio"
                  name="document-handling"
                  value="delete"
                  checked={!archiveDocuments}
                  onChange={() => setArchiveDocuments(false)}
                  className="mt-1 h-4 w-4 text-linear-accent focus:ring-linear-accent border-linear-border-default"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <TrashIcon className="h-4 w-4 text-linear-error" />
                    <span className="font-medium text-linear-text-primary">Șterge permanent</span>
                  </div>
                  <p className="text-sm text-linear-text-secondary">
                    Documentele încărcate vor fi șterse. Cele din OneDrive/SharePoint rămân în
                    cloud.
                  </p>
                </div>
              </label>
            </div>
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
            Șterge permanent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

DeleteCaseDialog.displayName = 'DeleteCaseDialog';

export default DeleteCaseDialog;
