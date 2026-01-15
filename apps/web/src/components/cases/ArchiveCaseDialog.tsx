'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Archive } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ARCHIVE_CASE } from '@/graphql/mutations';

interface ArchiveCaseDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The case to archive */
  caseData: {
    id: string;
    title: string;
    caseNumber: string;
    referenceNumbers?: string[];
  };
  /** Callback when archiving succeeds */
  onSuccess?: () => void;
}

export function ArchiveCaseDialog({
  open,
  onOpenChange,
  caseData,
  onSuccess,
}: ArchiveCaseDialogProps) {
  const [archiveCase, { loading, error }] = useMutation(ARCHIVE_CASE);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleArchive = async () => {
    setLocalError(null);

    try {
      await archiveCase({ variables: { id: caseData.id } });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('[ArchiveCaseDialog] Failed to archive case:', err);
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Nu s-a putut arhiva cazul. Încercați din nou.');
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
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-linear-accent/10 flex items-center justify-center">
              <Archive className="h-5 w-5 text-linear-accent" />
            </div>
            <DialogTitle>Arhivează cazul</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Cazul va fi mutat în arhivă. Veți putea în continuare să îl vizualizați, dar nu va mai
            apărea în listele active.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          {/* Case info display */}
          <div className="p-3 rounded-md bg-linear-bg-tertiary border border-linear-border-subtle">
            <p className="text-sm text-linear-text-secondary mb-1">Urmează să arhivați:</p>
            <p className="font-medium text-linear-text-primary">{caseData.title}</p>
            {caseData.referenceNumbers?.[0] && (
              <p className="text-sm text-linear-text-tertiary mt-1">Nr. {caseData.referenceNumbers[0]}</p>
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
            Anulează
          </Button>
          <Button
            variant="primary"
            onClick={handleArchive}
            loading={loading}
            leftIcon={<Archive className="h-4 w-4" />}
          >
            Arhivează
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

ArchiveCaseDialog.displayName = 'ArchiveCaseDialog';

export default ArchiveCaseDialog;
