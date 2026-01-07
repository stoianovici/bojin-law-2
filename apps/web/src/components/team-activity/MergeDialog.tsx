'use client';

/**
 * MergeDialog Component
 * Modal for configuring merged timesheet entries
 *
 * Features:
 * - Combined description input (pre-filled with first entry)
 * - Preview of summed hours and cost
 * - Date display (earliest from selection)
 * - List of entries being merged
 * - Confirm/Cancel buttons
 */

import { useState } from 'react';
import { Clock, Calendar, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { MergePreview } from '../../hooks/useTimesheetMerge';

// ============================================================================
// Types
// ============================================================================

export interface MergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: MergePreview | null;
  onConfirm: (description: string) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatHours(hours: number): string {
  return hours.toFixed(2);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ============================================================================
// Component
// ============================================================================

export function MergeDialog({ open, onOpenChange, preview, onConfirm }: MergeDialogProps) {
  const [description, setDescription] = useState('');

  // Reset description when dialog opens with new preview
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && preview) {
      setDescription(preview.suggestedDescription);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    if (description.trim()) {
      onConfirm(description.trim());
      onOpenChange(false);
    }
  };

  if (!preview) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Îmbină intrările</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Combined description input */}
          <div className="space-y-2">
            <label
              htmlFor="merge-description"
              className="text-sm font-medium text-linear-text-secondary"
            >
              Descriere combinată
            </label>
            <Input
              id="merge-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrierea pentru intrarea combinată..."
              className="w-full"
            />
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-linear-bg-tertiary rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-linear-text-muted" />
              <div>
                <div className="text-xs text-linear-text-muted">Total ore</div>
                <div className="text-sm font-medium text-linear-text-primary">
                  {formatHours(preview.totalHours)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-linear-text-muted" />
              <div>
                <div className="text-xs text-linear-text-muted">Total cost</div>
                <div className="text-sm font-medium text-linear-text-primary">
                  {formatCurrency(preview.totalAmount)} RON
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-linear-text-muted" />
              <div>
                <div className="text-xs text-linear-text-muted">Data</div>
                <div className="text-sm font-medium text-linear-text-primary">
                  {formatDate(preview.earliestDate)}
                </div>
              </div>
            </div>
          </div>

          {/* List of entries being merged */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-linear-text-secondary">
              Intrări de îmbinat ({preview.entries.length})
            </span>
            <div className="max-h-40 overflow-y-auto border border-linear-border-subtle rounded-lg divide-y divide-linear-border-subtle">
              {preview.entries.map((entry) => (
                <div key={entry.id} className="px-3 py-2 text-sm">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-linear-text-primary">
                        {entry.task
                          ? `${entry.task.title}: ${entry.description}`
                          : entry.description}
                      </div>
                      <div className="text-xs text-linear-text-muted">{formatDate(entry.date)}</div>
                    </div>
                    <div className="ml-2 text-right flex-shrink-0">
                      <div className="font-medium tabular-nums text-linear-text-primary">
                        {formatHours(entry.hours)} h
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!description.trim()}
            className="bg-linear-accent hover:bg-linear-accent/90 text-white"
          >
            Îmbină
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

MergeDialog.displayName = 'MergeDialog';

export default MergeDialog;
