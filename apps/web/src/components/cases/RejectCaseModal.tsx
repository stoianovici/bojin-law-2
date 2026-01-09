'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/components/ui';
import { cn } from '@/lib/utils';

interface RejectCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseTitle: string;
  onReject: (reason: string) => Promise<boolean>;
  loading?: boolean;
}

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 2000;

export function RejectCaseModal({
  open,
  onOpenChange,
  caseTitle,
  onReject,
  loading = false,
}: RejectCaseModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isValid = reason.trim().length >= MIN_REASON_LENGTH;
  const remainingChars = MIN_REASON_LENGTH - reason.trim().length;

  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      setError(`Motivul trebuie sa aiba minim ${MIN_REASON_LENGTH} caractere`);
      return;
    }

    const success = await onReject(reason.trim());
    if (success) {
      setReason('');
      setError(null);
      onOpenChange(false);
    }
  }, [reason, isValid, onReject, onOpenChange]);

  const handleClose = useCallback(() => {
    setReason('');
    setError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Respinge cazul</DialogTitle>
          <DialogDescription>
            Respingi cazul &quot;{caseTitle}&quot;. Furnizeaza un motiv pentru respingere.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 px-6 space-y-4">
          <div>
            <label className="block text-sm text-linear-text-secondary mb-2">
              Motivul respingerii *
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value.slice(0, MAX_REASON_LENGTH));
                setError(null);
              }}
              placeholder="Explica de ce acest caz nu poate fi aprobat..."
              rows={4}
              disabled={loading}
              className={cn(
                'w-full px-3 py-2 rounded-md text-sm',
                'bg-linear-bg-primary border border-linear-border-subtle',
                'text-linear-text-primary placeholder:text-linear-text-muted',
                'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'resize-none'
              )}
            />
            <div className="flex justify-between mt-1.5 text-xs">
              <span
                className={cn(
                  remainingChars > 0 ? 'text-linear-text-tertiary' : 'text-linear-text-secondary'
                )}
              >
                {remainingChars > 0
                  ? `Inca ${remainingChars} caractere necesare`
                  : `${reason.length}/${MAX_REASON_LENGTH}`}
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-linear-error/10 border border-linear-error/30">
              <AlertCircle className="w-4 h-4 text-linear-error flex-shrink-0 mt-0.5" />
              <p className="text-sm text-linear-error">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            Anuleaza
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleSubmit}
            disabled={loading || !isValid}
            loading={loading}
          >
            Respinge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RejectCaseModal;
