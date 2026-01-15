'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { type FetchResult } from '@apollo/client';
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
import { DELETE_CLIENT } from '@/graphql/mutations';

interface DeleteClientDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The client to delete */
  clientData: {
    id: string;
    name: string;
    caseCount: number;
  };
  /** Callback when deletion succeeds */
  onSuccess?: () => void;
}

export function DeleteClientDialog({
  open,
  onOpenChange,
  clientData,
  onSuccess,
}: DeleteClientDialogProps) {
  const [deleteClient, { loading, error }] = useMutation(DELETE_CLIENT);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLocalError(null);

    try {
      const result = (await deleteClient({
        variables: { id: clientData.id },
      })) as FetchResult<{ deleteClient: { id: string; name: string } | null }>;

      // Check if mutation succeeded - Apollo doesn't throw on GraphQL errors by default
      if (result.errors && result.errors.length > 0) {
        console.error('[DeleteClientDialog] GraphQL errors:', result.errors);
        setLocalError(result.errors[0].message);
        return;
      }

      // Also check if the mutation returned null (deletion failed)
      if (!result.data?.deleteClient) {
        setLocalError('Nu s-a putut șterge clientul. Încercați din nou.');
        return;
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('[DeleteClientDialog] Failed to delete client:', err);
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Nu s-a putut șterge clientul. Încercați din nou.');
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
            <DialogTitle>Șterge clientul</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Clientul și toate datele asociate vor fi șterse permanent. Această acțiune nu poate fi
            anulată.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          {/* Client info display */}
          <div className="p-3 rounded-md bg-linear-bg-tertiary border border-linear-border-subtle">
            <p className="text-sm text-linear-text-secondary mb-1">Urmează să ștergeți:</p>
            <p className="font-medium text-linear-text-primary">{clientData.name}</p>
            {clientData.caseCount > 0 && (
              <p className="text-sm text-linear-text-tertiary mt-1">
                {clientData.caseCount}{' '}
                {clientData.caseCount === 1 ? 'dosar asociat' : 'dosare asociate'}
              </p>
            )}
          </div>

          {/* Deletion consequences */}
          <div className="mt-4 p-3 rounded-md bg-linear-error/5 border border-linear-error/20">
            <p className="text-sm font-medium text-linear-text-primary mb-2">Ce se va întâmpla:</p>
            <ul className="text-sm text-linear-text-secondary space-y-1.5">
              <li>• Toate dosarele clientului vor fi șterse</li>
              <li>• Emailurile vor fi detașate (rămân în sistem)</li>
              <li>• Sarcinile din inbox vor fi șterse</li>
              <li>• Documentele încărcate în aplicație vor fi șterse</li>
              <li>• Documentele externe (OneDrive, SharePoint) rămân în cloud</li>
            </ul>
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

DeleteClientDialog.displayName = 'DeleteClientDialog';

export default DeleteClientDialog;
