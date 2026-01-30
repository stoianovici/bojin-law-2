'use client';

import * as React from 'react';
import { useState } from 'react';
import { Trash2, ToggleLeft, ToggleRight, History, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserCorrection } from '@/graphql/unified-context';

interface CorrectionHistoryProps {
  corrections: UserCorrection[];
  onToggleActive: (correctionId: string, isActive: boolean) => Promise<void>;
  onDelete: (correctionId: string) => Promise<void>;
  className?: string;
}

// Format date to Romanian locale
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CORRECTION_TYPE_LABELS: Record<string, { label: string; colorClass: string }> = {
  override: { label: 'Inlocuire', colorClass: 'bg-blue-500/10 text-blue-400' },
  append: { label: 'Adaugare', colorClass: 'bg-green-500/10 text-green-400' },
  remove: { label: 'Stergere', colorClass: 'bg-red-500/10 text-red-400' },
  note: { label: 'Nota', colorClass: 'bg-yellow-500/10 text-yellow-400' },
};

export function CorrectionHistory({
  corrections,
  onToggleActive,
  onDelete,
  className,
}: CorrectionHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Sort corrections by date (newest first)
  const sortedCorrections = [...corrections].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const activeCount = corrections.filter((c) => c.isActive).length;

  const handleToggle = async (correctionId: string, currentState: boolean) => {
    setProcessingId(correctionId);
    try {
      await onToggleActive(correctionId, !currentState);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (correctionId: string) => {
    if (!confirm('Sigur doresti sa stergi aceasta corectie?')) return;

    setProcessingId(correctionId);
    try {
      await onDelete(correctionId);
    } finally {
      setProcessingId(null);
    }
  };

  if (corrections.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-linear-border-subtle bg-linear-bg-secondary',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-linear-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-linear-text-tertiary" />
          <span className="text-sm font-medium text-linear-text-primary">Istoric corectii</span>
          <span className="px-2 py-0.5 rounded-full bg-linear-accent/10 text-linear-accent text-[10px] font-medium">
            {activeCount} active din {corrections.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-linear-text-tertiary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-linear-text-tertiary" />
        )}
      </button>

      {/* Corrections list */}
      {isExpanded && (
        <div className="border-t border-linear-border-subtle">
          {sortedCorrections.map((correction) => {
            const typeInfo = CORRECTION_TYPE_LABELS[correction.correctionType];
            const isProcessing = processingId === correction.id;

            return (
              <div
                key={correction.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 border-b border-linear-border-subtle last:border-b-0',
                  !correction.isActive && 'opacity-50'
                )}
              >
                {/* Toggle button */}
                <button
                  onClick={() => handleToggle(correction.id, correction.isActive)}
                  disabled={isProcessing}
                  className="mt-0.5 p-1 rounded hover:bg-linear-bg-hover transition-colors disabled:opacity-50"
                  title={correction.isActive ? 'Dezactiveaza' : 'Activeaza'}
                >
                  {correction.isActive ? (
                    <ToggleRight className="w-5 h-5 text-linear-accent" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-linear-text-tertiary" />
                  )}
                </button>

                {/* Correction details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        typeInfo.colorClass
                      )}
                    >
                      {typeInfo.label}
                    </span>
                    <span className="text-[10px] text-linear-text-tertiary">
                      Sectiune: {correction.sectionId}
                    </span>
                  </div>

                  <p className="text-sm text-linear-text-secondary line-clamp-2">
                    {correction.correctedValue}
                  </p>

                  {correction.reason && (
                    <p className="mt-1 text-xs text-linear-text-tertiary italic">
                      Motiv: {correction.reason}
                    </p>
                  )}

                  <p className="mt-1.5 text-[10px] text-linear-text-tertiary">
                    {formatDate(correction.createdAt)}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(correction.id)}
                  disabled={isProcessing}
                  className="mt-0.5 p-1.5 rounded hover:bg-red-500/10 text-linear-text-tertiary hover:text-red-400 transition-colors disabled:opacity-50"
                  title="Sterge corectia"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CorrectionHistory;
