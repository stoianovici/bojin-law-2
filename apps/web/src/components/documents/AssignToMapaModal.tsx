'use client';

/**
 * AssignToMapaModal Component
 * Modal for assigning a document to a mapa slot.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { FolderInput, Loader2, ChevronRight, Check, FileText } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  ScrollArea,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { GET_MAPAS, ASSIGN_DOCUMENT_TO_SLOT } from '@/graphql/mapa';
import { GET_CASE_DOCUMENTS } from '@/graphql/queries';
import type { Mapa, MapaSlot } from '@/types/mapa';

// ============================================================================
// Types
// ============================================================================

export interface AssignToMapaModalProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Document ID to assign */
  documentId: string;
  /** Document name for display */
  documentName: string;
  /** Case ID */
  caseId: string;
  /** Callback when assignment is successful */
  onSuccess?: () => void;
}

interface MapaQueryResult {
  caseMape: Mapa[];
}

// ============================================================================
// Component
// ============================================================================

export function AssignToMapaModal({
  open,
  onOpenChange,
  documentId,
  documentName,
  caseId,
  onSuccess,
}: AssignToMapaModalProps) {
  const [selectedMapaId, setSelectedMapaId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch mapas for the case
  const { data, loading: loadingMapas } = useQuery<MapaQueryResult>(GET_MAPAS, {
    variables: { caseId },
    skip: !open || !caseId,
  });

  // Assign document to slot mutation
  const [assignToSlot, { loading: assigning }] = useMutation(
    ASSIGN_DOCUMENT_TO_SLOT,
    {
      refetchQueries: [
        { query: GET_CASE_DOCUMENTS, variables: { caseId } },
        { query: GET_MAPAS, variables: { caseId } },
      ],
    }
  );

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedMapaId(null);
      setSelectedSlotId(null);
      setError(null);
    }
  }, [open]);

  // Get selected mapa
  const selectedMapa = useMemo(() => {
    if (!selectedMapaId || !data?.caseMape) return null;
    return data.caseMape.find((m) => m.id === selectedMapaId) || null;
  }, [selectedMapaId, data?.caseMape]);

  // Get available slots (empty ones)
  const availableSlots = useMemo(() => {
    if (!selectedMapa) return [];
    return selectedMapa.slots.filter((s) => !s.document);
  }, [selectedMapa]);

  const handleAssign = async () => {
    if (!selectedSlotId) return;
    setError(null);

    try {
      await assignToSlot({
        variables: { slotId: selectedSlotId, documentId },
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to assign document to slot:', err);
      setError('Nu s-a putut atribui documentul.');
    }
  };

  const mapas = data?.caseMape ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5 text-linear-accent" />
            Atribuie unei Mape
          </DialogTitle>
          <DialogDescription>
            Selectați o mapă și un slot pentru{' '}
            <strong className="text-linear-text-primary">&ldquo;{documentName}&rdquo;</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          {loadingMapas ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-linear-text-tertiary" />
            </div>
          ) : mapas.length === 0 ? (
            <div className="text-center py-8 text-linear-text-tertiary">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Nu există mape pentru acest dosar.</p>
              <p className="text-sm mt-1">Creați o mapă din meniul lateral.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Step 1: Select Mapa */}
              <div>
                <label className="block text-sm font-medium text-linear-text-secondary mb-2">
                  1. Selectați mapa
                </label>
                <ScrollArea className="h-[150px] rounded-lg border border-linear-border-subtle">
                  <div className="p-2 space-y-1">
                    {mapas.map((mapa) => (
                      <button
                        key={mapa.id}
                        type="button"
                        onClick={() => {
                          setSelectedMapaId(mapa.id);
                          setSelectedSlotId(null);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors',
                          selectedMapaId === mapa.id
                            ? 'bg-linear-accent/10 text-linear-accent'
                            : 'hover:bg-linear-bg-hover text-linear-text-primary'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm font-medium">{mapa.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-linear-text-tertiary">
                            {mapa.completionStatus.filledSlots}/{mapa.completionStatus.totalSlots}
                          </span>
                          {selectedMapaId === mapa.id && (
                            <Check className="h-4 w-4 text-linear-accent" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Step 2: Select Slot */}
              {selectedMapa && (
                <div>
                  <label className="block text-sm font-medium text-linear-text-secondary mb-2">
                    2. Selectați slotul
                  </label>
                  {availableSlots.length === 0 ? (
                    <div className="text-center py-4 text-linear-text-tertiary border border-linear-border-subtle rounded-lg">
                      <p className="text-sm">Toate sloturile sunt ocupate.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[150px] rounded-lg border border-linear-border-subtle">
                      <div className="p-2 space-y-1">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors',
                              selectedSlotId === slot.id
                                ? 'bg-linear-accent/10 text-linear-accent'
                                : 'hover:bg-linear-bg-hover text-linear-text-primary'
                            )}
                          >
                            <div>
                              <span className="text-sm font-medium">{slot.name}</span>
                              {slot.required && (
                                <span className="ml-2 text-xs text-linear-warning">
                                  Obligatoriu
                                </span>
                              )}
                              {slot.description && (
                                <p className="text-xs text-linear-text-tertiary mt-0.5">
                                  {slot.description}
                                </p>
                              )}
                            </div>
                            {selectedSlotId === slot.id && (
                              <Check className="h-4 w-4 text-linear-accent flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm text-linear-error">{error}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={assigning}
          >
            Anulează
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedSlotId || assigning || loadingMapas}
          >
            {assigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <ChevronRight className="h-4 w-4 mr-1" />
            Atribuie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

AssignToMapaModal.displayName = 'AssignToMapaModal';
