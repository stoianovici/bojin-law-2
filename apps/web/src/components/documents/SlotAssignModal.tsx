'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Search, File, Check, AlertTriangle, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
  Input,
  ScrollArea,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAssignDocument } from '@/hooks/useMapa';
import type { MapaSlot } from '@/types/mapa';
import type { Document } from '@/types/document';
import {
  formatFileSize,
  fileTypeColors,
  statusLabels,
  statusBadgeVariants,
} from '@/types/document';

// ============================================================================
// Types
// ============================================================================

export interface SlotAssignModalProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The slot to assign a document to */
  slot: MapaSlot;
  /** Available documents to choose from */
  documents: Document[];
  /** Callback when assignment is successful */
  onSuccess?: (slot: MapaSlot) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a document is already assigned to another slot
 */
function isDocumentAssignedElsewhere(document: Document, currentSlotId: string): boolean {
  return !!document.assignedToSlotId && document.assignedToSlotId !== currentSlotId;
}

// ============================================================================
// FileTypeIcon Component
// ============================================================================

function FileTypeIcon({
  fileType,
  className,
}: {
  fileType: Document['fileType'];
  className?: string;
}) {
  const color = fileTypeColors[fileType];
  return (
    <svg className={className} style={{ color }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>
  );
}

// ============================================================================
// DocumentListItem Component (simplified for selection)
// ============================================================================

interface DocumentSelectItemProps {
  document: Document;
  isSelected: boolean;
  isAssignedElsewhere: boolean;
  onClick: () => void;
}

function DocumentSelectItem({
  document,
  isSelected,
  isAssignedElsewhere,
  onClick,
}: DocumentSelectItemProps) {
  const formattedDate = new Date(document.uploadedAt).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <button
      type="button"
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-all duration-150',
        'hover:border-linear-border-default hover:bg-linear-bg-hover',
        isSelected
          ? 'border-linear-accent bg-linear-accent/5 ring-1 ring-linear-accent'
          : 'border-linear-border-subtle bg-linear-bg-secondary'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* File Icon */}
        <div className="w-10 h-10 rounded-lg bg-linear-bg-tertiary flex items-center justify-center flex-shrink-0">
          <FileTypeIcon fileType={document.fileType} className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-linear-text-primary truncate">
              {document.fileName}
            </h3>
            <Badge variant={statusBadgeVariants[document.status]} size="sm">
              {statusLabels[document.status]}
            </Badge>
          </div>

          {/* Warning if assigned elsewhere */}
          {isAssignedElsewhere && (
            <div className="flex items-center gap-1.5 mt-1">
              <AlertTriangle className="w-3.5 h-3.5 text-linear-warning" />
              <span className="text-xs text-linear-warning">Deja asignat unui alt slot</span>
            </div>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-linear-text-tertiary">
              {formatFileSize(document.fileSize)}
            </span>
            <span className="text-xs text-linear-text-muted">{formattedDate}</span>
            <span className="text-xs text-linear-text-muted">
              {document.uploadedBy.firstName} {document.uploadedBy.lastName}
            </span>
          </div>
        </div>

        {/* Selection indicator */}
        <div className="flex-shrink-0 self-center">
          {isSelected ? (
            <div className="w-5 h-5 rounded-full bg-linear-accent flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-linear-border-default" />
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// DocumentPreviewPanel Component
// ============================================================================

interface DocumentPreviewPanelProps {
  document: Document | null;
  isAssignedElsewhere: boolean;
}

function DocumentPreviewPanel({ document, isAssignedElsewhere }: DocumentPreviewPanelProps) {
  if (!document) {
    return (
      <div className="h-full flex items-center justify-center text-center p-4 bg-linear-bg-tertiary rounded-lg">
        <div>
          <File className="w-16 h-16 mx-auto mb-4 text-linear-text-muted opacity-30" />
          <p className="text-sm text-linear-text-muted">
            Selectați un document pentru a previzualiza
          </p>
          <p className="text-xs text-linear-text-tertiary mt-1">
            Faceți clic pe un document din listă
          </p>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(document.uploadedAt).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Determine preview type based on file type
  const canPreview = ['pdf', 'image'].includes(document.fileType);
  const isImage = document.fileType === 'image';
  const isPdf = document.fileType === 'pdf';

  return (
    <div className="h-full flex flex-col">
      {/* Document Preview Area */}
      <div className="flex-1 min-h-[250px] bg-linear-bg-tertiary rounded-lg overflow-hidden">
        {canPreview && document.downloadUrl ? (
          isImage ? (
            <img
              src={document.downloadUrl}
              alt={`Preview of ${document.fileName}`}
              className="w-full h-full object-contain"
            />
          ) : isPdf ? (
            <iframe
              src={`${document.downloadUrl}#toolbar=0&navpanes=0`}
              title={`Preview of ${document.fileName}`}
              className="w-full h-full border-0"
            />
          ) : null
        ) : document.thumbnailUrl ? (
          <img
            src={document.thumbnailUrl}
            alt={`Preview of ${document.fileName}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <FileTypeIcon
                fileType={document.fileType}
                className="w-16 h-16 mx-auto mb-3 opacity-50"
              />
              <p className="text-sm text-linear-text-muted">Previzualizare indisponibilă</p>
              <p className="text-xs text-linear-text-tertiary mt-1">{document.fileName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Document Info Panel */}
      <div className="flex-shrink-0 p-4 space-y-3 border-t border-linear-border-subtle mt-3">
        {/* Warning if assigned elsewhere */}
        {isAssignedElsewhere && (
          <div className="p-2.5 rounded-lg bg-linear-warning/10 border border-linear-warning/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-linear-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-linear-warning">
                  Deja asignat unui alt slot
                </p>
              </div>
            </div>
          </div>
        )}

        {/* File Info */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-linear-bg-tertiary flex items-center justify-center flex-shrink-0">
            <FileTypeIcon fileType={document.fileType} className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-linear-text-primary break-words line-clamp-2">
              {document.fileName}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusBadgeVariants[document.status]} size="sm">
                {statusLabels[document.status]}
              </Badge>
              <span className="text-xs text-linear-text-tertiary">
                {formatFileSize(document.fileSize)}
              </span>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-linear-text-secondary">
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium"
              style={{
                backgroundColor: 'rgba(94, 106, 210, 0.15)',
                color: '#5E6AD2',
              }}
            >
              {document.uploadedBy.initials}
            </div>
            <span>
              {document.uploadedBy.firstName} {document.uploadedBy.lastName}
            </span>
          </div>
          <span className="text-linear-text-muted">•</span>
          <span>{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SlotAssignModal Component
// ============================================================================

export function SlotAssignModal({
  open,
  onOpenChange,
  slot,
  documents,
  onSuccess,
}: SlotAssignModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use the assign document hook
  const { assignDocument, loading: assigning, error: assignError } = useAssignDocument();

  // Filter documents based on search query and optionally slot category
  const filteredDocuments = useMemo(() => {
    let result = documents;

    // Filter by slot category if specified
    // Note: This assumes documents have a category field or we match all
    // For now, we show all documents and let the user choose

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (doc) =>
          doc.fileName.toLowerCase().includes(query) ||
          doc.uploadedBy.firstName.toLowerCase().includes(query) ||
          doc.uploadedBy.lastName.toLowerCase().includes(query)
      );
    }

    return result;
  }, [documents, searchQuery]);

  // Check if selected document is assigned elsewhere
  const isSelectedAssignedElsewhere = selectedDocument
    ? isDocumentAssignedElsewhere(selectedDocument, slot.id)
    : false;

  // Handle document selection
  const handleDocumentClick = useCallback((document: Document) => {
    setSelectedDocument((prev) => (prev?.id === document.id ? null : document));
    setErrorMessage(null);
  }, []);

  // Handle confirm assignment
  const handleConfirm = useCallback(async () => {
    if (!selectedDocument) return;

    setErrorMessage(null);

    try {
      const result = await assignDocument(slot.id, selectedDocument.id);

      if (result) {
        onSuccess?.(result);
        onOpenChange(false);
        // Reset state
        setSelectedDocument(null);
        setSearchQuery('');
      } else {
        setErrorMessage('Asignarea documentului a eșuat. Încercați din nou.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'A apărut o eroare neașteptată');
    }
  }, [selectedDocument, slot.id, assignDocument, onSuccess, onOpenChange]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    onOpenChange(false);
    // Reset state
    setSelectedDocument(null);
    setSearchQuery('');
    setErrorMessage(null);
  }, [onOpenChange]);

  // Display error from hook or local state
  const displayError = errorMessage || assignError?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full" className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Asignează document la slot</DialogTitle>
          <DialogDescription>
            Selectați un document pentru a asigna la &quot;{slot.name}&quot;
            {slot.category && (
              <span className="text-linear-text-muted"> (Categorie: {slot.category})</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="px-6 pb-4">
          <Input
            placeholder="Căutați documente după nume sau încărcător..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftAddon={<Search className="w-4 h-4" />}
            rightAddon={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-linear-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : undefined
            }
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0 px-6">
          <div className="flex gap-4 h-full">
            {/* Document List */}
            <div className="flex-1 min-w-0">
              {filteredDocuments.length === 0 ? (
                <div className="flex items-center justify-center h-[500px]">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-linear-bg-tertiary flex items-center justify-center">
                      <File className="w-6 h-6 text-linear-text-muted" />
                    </div>
                    <div>
                      <h4 className="font-medium text-linear-text-primary">
                        Niciun document găsit
                      </h4>
                      <p className="text-sm text-linear-text-secondary mt-1">
                        {searchQuery
                          ? 'Încercați să ajustați căutarea'
                          : 'Niciun document disponibil pentru acest dosar'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2 pr-2">
                    {filteredDocuments.map((document) => (
                      <DocumentSelectItem
                        key={document.id}
                        document={document}
                        isSelected={selectedDocument?.id === document.id}
                        isAssignedElsewhere={isDocumentAssignedElsewhere(document, slot.id)}
                        onClick={() => handleDocumentClick(document)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Preview Panel */}
            <div className="w-[400px] flex-shrink-0 border-l border-linear-border-subtle pl-4">
              <div className="mb-3">
                <h3 className="text-sm font-medium text-linear-text-primary">
                  Previzualizare document
                </h3>
              </div>
              <div className="h-[470px]">
                <DocumentPreviewPanel
                  document={selectedDocument}
                  isAssignedElsewhere={isSelectedAssignedElsewhere}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {displayError && (
          <div className="px-6 pb-2">
            <div className="p-3 rounded-lg bg-linear-error/10 border border-linear-error/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-linear-error flex-shrink-0" />
                <p className="text-sm text-linear-error">{displayError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          <Button variant="secondary" onClick={handleCancel} disabled={assigning}>
            Anulează
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedDocument || assigning}
            loading={assigning}
          >
            {isSelectedAssignedElsewhere ? 'Reasignează document' : 'Asignează document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

SlotAssignModal.displayName = 'SlotAssignModal';

export default SlotAssignModal;
