'use client';

/**
 * DraftModeToolbar Component
 * OPS-209: Floating save/cancel toolbar for draft mode
 *
 * Sticky bottom toolbar with validation state, save button (disabled if invalid),
 * and cancel button. Shows required field hints and approval notice for Associates.
 */

import React, { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Button } from '@legal-platform/ui';
import { AlertTriangle, X } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface DraftModeToolbarProps {
  /** Handler for save action */
  onSave: () => Promise<void>;
  /** Handler for cancel action */
  onCancel: () => void;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether the form is valid for submission */
  isValid: boolean;
  /** Whether a save is in progress */
  isSaving: boolean;
  /** List of validation errors to display */
  validationErrors?: string[];
  /** Show approval notice banner for Associates */
  showApprovalNotice?: boolean;
  /** Text for the save button (default: "Creează Dosar") */
  saveButtonText?: string;
}

// ============================================================================
// Cancel Confirmation Dialog
// ============================================================================

interface CancelConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function CancelConfirmDialog({ open, onOpenChange, onConfirm }: CancelConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn z-50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-linear-bg-secondary rounded-lg shadow-xl p-6 w-full max-w-md focus:outline-none z-50">
          <AlertDialog.Title className="text-xl font-semibold text-linear-text-primary mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-linear-warning" />
            Anulare modificări
          </AlertDialog.Title>

          <AlertDialog.Description className="text-sm text-linear-text-secondary mb-6">
            Aveți modificări nesalvate. Sunteți sigur că doriți să anulați? Toate modificările vor
            fi pierdute.
          </AlertDialog.Description>

          <div className="flex gap-3 justify-end">
            <AlertDialog.Cancel asChild>
              <button className="px-4 py-2 text-sm font-medium text-linear-text-secondary bg-linear-bg-tertiary rounded-lg hover:bg-linear-bg-hover transition-colors">
                Continuă editarea
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-linear-error rounded-lg hover:bg-linear-error/80 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Anulează modificările
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

// ============================================================================
// Component
// ============================================================================

export function DraftModeToolbar({
  onSave,
  onCancel,
  isDirty,
  isValid,
  isSaving,
  validationErrors = [],
  showApprovalNotice = false,
  saveButtonText = 'Creează Dosar',
}: DraftModeToolbarProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      onCancel();
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    onCancel();
  };

  const handleSave = async () => {
    try {
      await onSave();
    } catch {
      // Error handling is expected to be done by the parent
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-linear-border-subtle bg-linear-bg-secondary shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          {/* Approval Notice for Associates */}
          {showApprovalNotice && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-linear-warning/15 px-3 py-2 text-sm text-linear-warning">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Dosarul va fi trimis spre aprobare</span>
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mb-3 rounded-lg bg-linear-error/15 px-3 py-2 text-sm text-linear-error">
              {validationErrors.join(', ')}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
              Anulează
            </Button>
            <Button onClick={handleSave} disabled={!isValid || isSaving} loading={isSaving}>
              {saveButtonText}
            </Button>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <CancelConfirmDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        onConfirm={handleConfirmCancel}
      />
    </>
  );
}

DraftModeToolbar.displayName = 'DraftModeToolbar';
