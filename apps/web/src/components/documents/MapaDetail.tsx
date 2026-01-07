'use client';

import { useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Printer,
  MoreVertical,
  Plus,
  CheckCircle,
  Sparkles,
  Download,
} from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  ScrollArea,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Mapa, MapaSlot } from '@/types/mapa';
import { mapaCategories } from '@/types/mapa';
import { MapaCompletionRing } from './MapaCompletionRing';
import { MapaSlotItem } from './MapaSlotItem';
import { EditMapaModal } from './EditMapaModal';
import { DeleteMapaDialog } from './DeleteMapaDialog';
import { SuggestedDocuments } from './SuggestedDocuments';
import type { DocumentSuggestion } from './SuggestedDocuments';
import { printMapa, downloadMapaHtml } from '@/lib/print/mapaPrint';

interface MapaDetailProps {
  mapa: Mapa;
  caseName: string;
  firmName?: string;
  onBack?: () => void;
  onPrint?: () => void;
  onAddSlot?: () => void;
  onFinalize?: () => void;
  onAssignDocument?: (slotId: string) => void;
  onRemoveDocument?: (slotId: string) => void;
  onViewDocument?: (documentId: string) => void;
  onRequestDocument?: (slotId: string) => void;
  onCancelRequest?: (slotId: string) => void;
  onMapaUpdated?: (mapa: Mapa) => void;
  onMapaDeleted?: () => void;
  // Suggestions support
  slotSuggestions?: Record<string, DocumentSuggestion[]>;
  onAssignSuggestion?: (slotId: string, documentId: string) => void;
  onIgnoreSuggestion?: (slotId: string, documentId: string) => void;
  onAutoMatch?: () => void;
}

// Group slots by category
function groupSlotsByCategory(slots: MapaSlot[]) {
  const groups: Record<string, MapaSlot[]> = {};

  slots.forEach((slot) => {
    if (!groups[slot.category]) {
      groups[slot.category] = [];
    }
    groups[slot.category].push(slot);
  });

  // Sort by order within each group
  Object.keys(groups).forEach((cat) => {
    groups[cat].sort((a, b) => a.order - b.order);
  });

  return groups;
}

export function MapaDetail({
  mapa,
  caseName,
  firmName = 'Cabinet de Avocatură',
  onBack,
  onPrint,
  onAddSlot,
  onFinalize,
  onAssignDocument,
  onRemoveDocument,
  onViewDocument,
  onRequestDocument,
  onCancelRequest,
  onMapaUpdated,
  onMapaDeleted,
  slotSuggestions = {},
  onAssignSuggestion,
  onIgnoreSuggestion,
  onAutoMatch,
}: MapaDetailProps) {
  // Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { completionStatus } = mapa;
  const groupedSlots = groupSlotsByCategory(mapa.slots);

  // Count total suggestions
  const totalSuggestions = Object.values(slotSuggestions).reduce(
    (sum, suggestions) => sum + suggestions.length,
    0
  );

  // Handle print action
  const handlePrint = useCallback(() => {
    if (onPrint) {
      onPrint();
    } else {
      // Use default print function
      printMapa(mapa, caseName, firmName);
    }
  }, [mapa, caseName, firmName, onPrint]);

  // Handle download HTML for PDF conversion
  const handleDownloadHtml = useCallback(() => {
    downloadMapaHtml(mapa, caseName, firmName);
  }, [mapa, caseName, firmName]);

  // Get category display name
  const getCategoryName = (categoryId: string) => {
    const cat = mapaCategories.find((c) => c.id === categoryId);
    return cat ? cat.name : categoryId;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-linear-bg-primary">
      {/* Header */}
      <header className="px-6 py-4 border-b border-linear-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Back Button */}
          <Button variant="ghost" size="sm" onClick={onBack} className="h-9 w-9 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm">
            <span className="text-linear-text-tertiary">{caseName}</span>
            <ChevronRight className="w-4 h-4 text-linear-text-muted" />
            <span className="text-linear-text-primary">{mapa.name}</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {/* Print Button */}
          <Button variant="secondary" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Tipărește
          </Button>
          {/* More Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditModalOpen(true)}>
                Editează mapa
              </DropdownMenuItem>
              <DropdownMenuItem>Duplică</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadHtml}>
                <Download className="w-4 h-4 mr-2" />
                Exportă HTML
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-linear-error"
                onClick={() => setDeleteDialogOpen(true)}
              >
                Șterge mapa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Info Bar */}
      <div className="px-6 py-4 border-b border-linear-border-subtle bg-linear-bg-secondary flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Completion Ring */}
          <MapaCompletionRing completion={completionStatus} size="lg" />

          <div>
            <h1 className="text-lg font-semibold text-linear-text-primary">{mapa.name}</h1>
            {mapa.description && (
              <p className="text-sm mt-1 text-linear-text-tertiary">{mapa.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-linear-success" />
                <span className="text-xs text-linear-text-secondary">
                  {completionStatus.filledSlots} completate
                </span>
              </div>
              {completionStatus.missingRequired.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-linear-error" />
                  <span className="text-xs text-linear-text-secondary">
                    {completionStatus.missingRequired.length} obligatorii lipsă
                  </span>
                </div>
              )}
              {completionStatus.totalSlots -
                completionStatus.filledSlots -
                (completionStatus.requiredSlots - completionStatus.filledRequiredSlots) >
                0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-linear-text-muted" />
                  <span className="text-xs text-linear-text-secondary">
                    {completionStatus.totalSlots - completionStatus.filledSlots} goale
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-match button - shown when there are suggestions */}
          {totalSuggestions > 0 && onAutoMatch && (
            <Button variant="secondary" size="sm" onClick={onAutoMatch}>
              <Sparkles className="w-4 h-4 mr-2" />
              Auto-potrivire ({totalSuggestions})
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onAddSlot}>
            <Plus className="w-4 h-4 mr-2" />
            Adaugă slot
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onFinalize}
            disabled={!completionStatus.isComplete}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Finalizează mapa
          </Button>
        </div>
      </div>

      {/* Slots List */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {Object.entries(groupedSlots).map(([categoryId, slots]) => (
              <div key={categoryId}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-medium text-linear-text-secondary">
                    {getCategoryName(categoryId)}
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded bg-linear-bg-tertiary text-linear-text-muted">
                    {slots.length} sloturi
                  </span>
                </div>
                <div className="space-y-2">
                  {slots.map((slot) => {
                    const suggestions = slotSuggestions[slot.id] || [];
                    const showSuggestions = !slot.document && suggestions.length > 0;

                    return (
                      <div key={slot.id} className="space-y-2">
                        <MapaSlotItem
                          slot={slot}
                          onAssignDocument={() => onAssignDocument?.(slot.id)}
                          onRemoveDocument={() => onRemoveDocument?.(slot.id)}
                          onViewDocument={() => slot.document && onViewDocument?.(slot.document.id)}
                          onRequestDocument={
                            onRequestDocument ? () => onRequestDocument(slot.id) : undefined
                          }
                          onCancelRequest={
                            onCancelRequest ? () => onCancelRequest(slot.id) : undefined
                          }
                        />
                        {/* Suggestions for empty slots */}
                        {showSuggestions && (
                          <SuggestedDocuments
                            suggestions={suggestions}
                            slotName={slot.name}
                            onAssign={(docId) => onAssignSuggestion?.(slot.id, docId)}
                            onIgnore={(docId) => onIgnoreSuggestion?.(slot.id, docId)}
                            compact
                            className="ml-8"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Add New Slot Button */}
            <button
              className="w-full py-3 rounded-lg border border-dashed border-linear-border-subtle flex items-center justify-center gap-2 text-linear-text-muted hover:border-linear-accent hover:text-linear-accent transition-colors"
              onClick={onAddSlot}
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Adaugă slot nou</span>
            </button>
          </div>
        </div>
      </ScrollArea>

      {/* Edit Mapa Modal */}
      <EditMapaModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        mapa={mapa}
        onSuccess={onMapaUpdated}
      />

      {/* Delete Mapa Dialog */}
      <DeleteMapaDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        mapa={mapa}
        onSuccess={onMapaDeleted}
      />
    </div>
  );
}
