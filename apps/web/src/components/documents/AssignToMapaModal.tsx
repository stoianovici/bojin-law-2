'use client';

/**
 * AssignToMapaModal Component
 * Modal for assigning a document to a mapa slot.
 * Supports both case-level and client-level (multi-case) assignment.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { FolderInput, Loader2, ChevronRight, Check, FileText, Briefcase, Plus } from 'lucide-react';
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
  Input,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { GET_MAPAS, ASSIGN_DOCUMENT_TO_SLOT, ADD_SLOT_TO_MAPA } from '@/graphql/mapa';
import { GET_CASE_DOCUMENTS } from '@/graphql/queries';
import type { Mapa, MapaSlot, CaseWithMape } from '@/types/mapa';

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
  /** Case ID - for single case context */
  caseId?: string;
  /** Cases with mapas - for client inbox context (multi-case) */
  cases?: CaseWithMape[];
  /** Callback when assignment is successful */
  onSuccess?: () => void;
}

interface MapaQueryResult {
  caseMape: Mapa[];
}

interface AddSlotResult {
  addMapaSlot: {
    id: string;
    name: string;
  };
}

// Mapa with case context for display
interface MapaWithCase extends Mapa {
  caseName?: string;
  caseNumber?: string;
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
  cases,
  onSuccess,
}: AssignToMapaModalProps) {
  const [selectedMapaId, setSelectedMapaId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isCreatingNewSlot, setIsCreatingNewSlot] = useState(false);
  const [newSlotName, setNewSlotName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Determine if we're in multi-case mode (client inbox)
  const isMultiCaseMode = !caseId && cases && cases.length > 0;

  // Fetch mapas for single case mode
  const { data, loading: loadingMapas } = useQuery<MapaQueryResult>(GET_MAPAS, {
    variables: { caseId },
    skip: !open || !caseId || isMultiCaseMode,
  });

  // Build refetch queries based on which cases have mapas
  const refetchQueries = useMemo(() => {
    if (caseId) {
      return [
        { query: GET_CASE_DOCUMENTS, variables: { caseId } },
        { query: GET_MAPAS, variables: { caseId } },
      ];
    }
    // For multi-case mode, refetch all affected cases
    if (cases) {
      const queries: Array<{
        query: typeof GET_CASE_DOCUMENTS | typeof GET_MAPAS;
        variables: { caseId: string };
      }> = [];
      cases.forEach((c) => {
        if (c.mape.length > 0) {
          queries.push({ query: GET_CASE_DOCUMENTS, variables: { caseId: c.id } });
          queries.push({ query: GET_MAPAS, variables: { caseId: c.id } });
        }
      });
      return queries;
    }
    return [];
  }, [caseId, cases]);

  // Add slot to mapa mutation
  const [addSlot, { loading: addingSlot }] = useMutation<AddSlotResult>(ADD_SLOT_TO_MAPA);

  // Assign document to slot mutation
  const [assignToSlot, { loading: assigningToSlot }] = useMutation(ASSIGN_DOCUMENT_TO_SLOT, {
    refetchQueries,
  });

  const assigning = addingSlot || assigningToSlot;

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedMapaId(null);
      setSelectedSlotId(null);
      setIsCreatingNewSlot(false);
      setNewSlotName('');
      setError(null);
    }
  }, [open]);

  // Collect all mapas with case context
  const allMapas: MapaWithCase[] = useMemo(() => {
    if (isMultiCaseMode && cases) {
      // Multi-case mode: flatten all mapas from all cases
      const mapasWithContext: MapaWithCase[] = [];
      cases.forEach((c) => {
        c.mape.forEach((mapa) => {
          mapasWithContext.push({
            ...mapa,
            caseName: c.name,
            caseNumber: c.caseNumber,
          });
        });
      });
      return mapasWithContext;
    } else if (data?.caseMape) {
      // Single case mode
      return data.caseMape;
    }
    return [];
  }, [isMultiCaseMode, cases, data?.caseMape]);

  // Get selected mapa
  const selectedMapa = useMemo(() => {
    if (!selectedMapaId) return null;
    return allMapas.find((m) => m.id === selectedMapaId) || null;
  }, [selectedMapaId, allMapas]);

  // Get available slots (empty ones)
  const availableSlots = useMemo(() => {
    if (!selectedMapa) return [];
    return selectedMapa.slots.filter((s) => !s.document);
  }, [selectedMapa]);

  const handleAssign = async () => {
    if (!selectedMapaId) return;
    if (!isCreatingNewSlot && !selectedSlotId) return;
    if (isCreatingNewSlot && !newSlotName.trim()) return;
    setError(null);

    try {
      let slotId = selectedSlotId;

      // If creating a new slot, first create it then assign
      if (isCreatingNewSlot && selectedMapa) {
        // Calculate next order position (append to end)
        const nextOrder = selectedMapa.slots.length;
        const result = await addSlot({
          variables: {
            mapaId: selectedMapaId,
            input: {
              name: newSlotName.trim(),
              required: false,
              order: nextOrder,
            },
          },
          refetchQueries,
        });
        const newSlotId = result.data?.addMapaSlot?.id;
        if (!newSlotId) {
          throw new Error('Failed to create slot');
        }
        slotId = newSlotId;
      }

      console.log('[AssignToMapaModal] Assigning document:', {
        slotId,
        caseDocumentId: documentId,
        documentName,
      });
      await assignToSlot({
        variables: { slotId, caseDocumentId: documentId },
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to assign document to slot:', err);
      setError(
        isCreatingNewSlot ? 'Nu s-a putut crea slotul.' : 'Nu s-a putut atribui documentul.'
      );
    }
  };

  const isLoading = loadingMapas && !isMultiCaseMode;

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
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-linear-text-tertiary" />
            </div>
          ) : allMapas.length === 0 ? (
            <div className="text-center py-8 text-linear-text-tertiary">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>
                {isMultiCaseMode
                  ? 'Nu există mape pentru dosarele acestui client.'
                  : 'Nu există mape pentru acest dosar.'}
              </p>
              <p className="text-sm mt-1">Creați o mapă din meniul lateral.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Step 1: Select Mapa */}
              <div>
                <label className="block text-sm font-medium text-linear-text-secondary mb-2">
                  1. Selectați mapa
                </label>
                <ScrollArea className="h-[180px] rounded-lg border border-linear-border-subtle">
                  <div className="p-2 space-y-1">
                    {allMapas.map((mapa) => (
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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 flex-shrink-0" />
                            <span className="text-sm font-medium truncate">{mapa.name}</span>
                          </div>
                          {/* Show case context in multi-case mode */}
                          {isMultiCaseMode && mapa.caseName && (
                            <div className="flex items-center gap-1.5 mt-0.5 ml-6">
                              <Briefcase className="h-3 w-3 text-linear-text-muted" />
                              <span className="text-xs text-linear-text-tertiary truncate">
                                {mapa.caseName}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
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
                  <ScrollArea className="h-[150px] rounded-lg border border-linear-border-subtle">
                    <div className="p-2 space-y-1">
                      {/* Existing empty slots */}
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => {
                            setSelectedSlotId(slot.id);
                            setIsCreatingNewSlot(false);
                            setNewSlotName('');
                          }}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors',
                            selectedSlotId === slot.id && !isCreatingNewSlot
                              ? 'bg-linear-accent/10 text-linear-accent'
                              : 'hover:bg-linear-bg-hover text-linear-text-primary'
                          )}
                        >
                          <div>
                            <span className="text-sm font-medium">{slot.name}</span>
                            {slot.required && (
                              <span className="ml-2 text-xs text-linear-warning">Obligatoriu</span>
                            )}
                            {slot.description && (
                              <p className="text-xs text-linear-text-tertiary mt-0.5">
                                {slot.description}
                              </p>
                            )}
                          </div>
                          {selectedSlotId === slot.id && !isCreatingNewSlot && (
                            <Check className="h-4 w-4 text-linear-accent flex-shrink-0" />
                          )}
                        </button>
                      ))}

                      {/* Add new slot option - always shown as last option */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewSlot(true);
                          setSelectedSlotId(null);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors',
                          isCreatingNewSlot
                            ? 'bg-linear-accent/10 text-linear-accent'
                            : 'hover:bg-linear-bg-hover text-linear-text-tertiary'
                        )}
                      >
                        <Plus className="h-4 w-4" />
                        <span className="text-sm font-medium">Adaugă slot nou</span>
                        {isCreatingNewSlot && (
                          <Check className="h-4 w-4 text-linear-accent ml-auto" />
                        )}
                      </button>
                    </div>
                  </ScrollArea>

                  {/* New slot name input */}
                  {isCreatingNewSlot && (
                    <div className="mt-3">
                      <Input
                        placeholder="Numele slotului..."
                        value={newSlotName}
                        onChange={(e) => setNewSlotName(e.target.value)}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-linear-error">{error}</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={assigning}>
            Anulează
          </Button>
          <Button
            onClick={handleAssign}
            disabled={
              assigning ||
              isLoading ||
              !selectedMapaId ||
              (!selectedSlotId && !isCreatingNewSlot) ||
              (isCreatingNewSlot && !newSlotName.trim())
            }
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
