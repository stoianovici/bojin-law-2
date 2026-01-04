'use client';

import { useState } from 'react';
import { Unlink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/components/ui';

interface UnlinkThreadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadSubject: string;
  caseName: string;
  onConfirm: () => Promise<void>;
}

export function UnlinkThreadModal({
  open,
  onOpenChange,
  threadSubject,
  caseName,
  onConfirm,
}: UnlinkThreadModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Stergi legatura cu acest dosar?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 pt-2 text-sm text-linear-text-secondary">
              <p>
                Conversatia{' '}
                <span className="font-medium text-linear-text-primary">
                  &quot;{threadSubject}&quot;
                </span>{' '}
                nu va mai fi asociata cu dosarul{' '}
                <span className="font-medium text-linear-text-primary">{caseName}</span>.
              </p>
              <p className="text-linear-text-tertiary">
                Conversatia va ramane vizibila in comunicarile cu clientul.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Anuleaza
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={loading}
            leftIcon={<Unlink className="h-4 w-4" />}
          >
            Sterge legatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
