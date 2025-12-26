/**
 * Run Now Confirmation Dialog
 * OPS-243: Feature Toggles Page
 *
 * Confirmation dialog before manually triggering a batch job.
 */

'use client';

import React from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ============================================================================
// Types
// ============================================================================

interface RunNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  onConfirm: () => void;
  isRunning: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function RunNowDialog({
  open,
  onOpenChange,
  featureName,
  onConfirm,
  isRunning,
}: RunNowDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    // Don't close immediately - let the parent handle it after the job completes
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Rulare manuală
          </DialogTitle>
          <DialogDescription>
            Sunteți sigur că doriți să rulați acum procesorul{' '}
            <span className="font-medium text-gray-900">{featureName}</span>?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              Această acțiune va consuma resurse AI și poate dura câteva minute. Procesorul rulează
              în mod normal automat conform programării.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRunning}>
            Anulare
          </Button>
          <Button onClick={handleConfirm} disabled={isRunning} className="flex items-center gap-2">
            {isRunning ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Se procesează...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Rulează acum
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
