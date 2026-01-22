'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Checkbox,
  ScrollArea,
} from '@/components/ui';
import {
  Printer,
  FileText,
  Image as ImageIcon,
  File,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Mapa, MapaSlot } from '@/types/mapa';
import { printMapa, type DocumentUrls } from '@/lib/print/mapaPrint';
import { apolloClient } from '@/lib/apollo-client';
import { GET_DOCUMENT_DOWNLOAD_URL } from '@/graphql/mutations';

// ============================================================================
// Types
// ============================================================================

interface MapaPrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapa: Mapa;
  caseName: string;
  firmName?: string;
}

interface DocumentItem {
  id: string;
  slotId: string;
  slotName: string;
  fileName: string;
  fileType: string;
  thumbnailUrl: string | null;
  selected: boolean;
  status: 'pending' | 'loading' | 'success' | 'error';
  downloadUrl: string | null;
  error?: string;
}

type PrintPhase = 'selection' | 'preparing' | 'ready' | 'preview';

// ============================================================================
// Helpers
// ============================================================================

const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
const PDF_TYPES = ['pdf'];

function getFileIcon(fileType: string) {
  const type = fileType?.toLowerCase() || '';
  if (IMAGE_TYPES.includes(type)) return ImageIcon;
  if (PDF_TYPES.includes(type)) return FileText;
  return File;
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Extract the actual document from a slot, handling both structures:
 * - GET_MAPA: slot.document is the Document directly
 * - GET_MAPAS: slot.document.document is the nested Document (CaseDocument wrapper)
 */
function getDocumentFromSlot(slot: MapaSlot): {
  id: string;
  fileName: string;
  fileType: string;
  thumbnailUrl: string | null;
} | null {
  if (!slot.document) return null;

  // Check if it's the nested structure (CaseDocument wrapper)
  const doc = slot.document as any;
  if (doc.document && doc.document.id) {
    return {
      id: doc.document.id,
      fileName: doc.document.fileName || '',
      fileType: doc.document.fileType || '',
      thumbnailUrl: doc.document.thumbnailUrl || null,
    };
  }

  // Direct document structure
  if (doc.id && doc.fileName) {
    return {
      id: doc.id,
      fileName: doc.fileName || '',
      fileType: doc.fileType || '',
      thumbnailUrl: doc.thumbnailUrl || null,
    };
  }

  return null;
}

// ============================================================================
// Component
// ============================================================================

export function MapaPrintModal({
  open,
  onOpenChange,
  mapa,
  caseName,
  firmName = 'Cabinet de Avocatură',
}: MapaPrintModalProps) {
  // Build initial document list from mapa slots
  const initialDocuments = useMemo(() => {
    const docs: DocumentItem[] = [];

    mapa.slots.forEach((slot) => {
      const doc = getDocumentFromSlot(slot);
      if (doc) {
        docs.push({
          id: doc.id,
          slotId: slot.id,
          slotName: slot.name,
          fileName: doc.fileName,
          fileType: doc.fileType,
          thumbnailUrl: doc.thumbnailUrl,
          selected: true,
          status: 'pending' as const,
          downloadUrl: null,
          error: undefined,
        });
      }
    });

    return docs;
  }, [mapa.slots]);

  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [phase, setPhase] = useState<PrintPhase>('selection');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [includeEmptySlots, setIncludeEmptySlots] = useState(false);

  // Reset state when modal opens
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        setDocuments(initialDocuments);
        setPhase('selection');
        setCurrentIndex(0);
      }
      onOpenChange(newOpen);
    },
    [initialDocuments, onOpenChange]
  );

  // Toggle document selection
  const toggleDocument = useCallback((docId: string) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === docId ? { ...doc, selected: !doc.selected } : doc))
    );
  }, []);

  // Select/deselect all
  const toggleAll = useCallback((selected: boolean) => {
    setDocuments((prev) => prev.map((doc) => ({ ...doc, selected })));
  }, []);

  // Count selected documents
  const selectedCount = documents.filter((d) => d.selected).length;
  const totalCount = documents.length;

  // Fetch a single document URL
  const fetchDocumentUrl = useCallback(async (docId: string): Promise<string | null> => {
    try {
      const result = await apolloClient.mutate<{
        getDocumentDownloadUrl: { url: string; expirationDateTime: string };
      }>({
        mutation: GET_DOCUMENT_DOWNLOAD_URL,
        variables: { documentId: docId },
      });
      return result.data?.getDocumentDownloadUrl?.url || null;
    } catch (err) {
      console.error(`[MapaPrintModal] Failed to fetch URL for ${docId}:`, err);
      throw err;
    }
  }, []);

  // Prepare documents (fetch URLs sequentially)
  const prepareDocuments = useCallback(async () => {
    setPhase('preparing');
    setCurrentIndex(0);

    const selectedDocs = documents.filter((d) => d.selected);

    for (let i = 0; i < selectedDocs.length; i++) {
      const doc = selectedDocs[i];
      setCurrentIndex(i);

      // Mark as loading
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: 'loading' } : d)));

      try {
        const downloadUrl = await fetchDocumentUrl(doc.id);
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === doc.id ? { ...d, status: 'success', downloadUrl, error: undefined } : d
          )
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare la încărcare';
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, status: 'error', error: errorMessage } : d))
        );
      }

      // Small delay between requests to avoid overwhelming the server
      if (i < selectedDocs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    setPhase('ready');
  }, [documents, fetchDocumentUrl]);

  // Build DocumentUrls for printing
  const buildDocumentUrls = useCallback((): DocumentUrls => {
    const urls: DocumentUrls = {};
    documents
      .filter((d) => d.selected && d.status === 'success')
      .forEach((doc) => {
        urls[doc.id] = {
          downloadUrl: doc.downloadUrl,
          thumbnailUrl: doc.thumbnailUrl,
          fileType: doc.fileType,
          fileName: doc.fileName,
        };
      });
    return urls;
  }, [documents]);

  // Execute print
  const handlePrint = useCallback(() => {
    const documentUrls = buildDocumentUrls();
    const hasSelectedDocs = Object.keys(documentUrls).length > 0;

    printMapa(
      mapa,
      caseName,
      firmName,
      {
        includeCoverPage,
        includeEmptySlots,
        includeDocuments: hasSelectedDocs,
      },
      documentUrls
    );

    handleOpenChange(false);
  }, [
    mapa,
    caseName,
    firmName,
    includeCoverPage,
    includeEmptySlots,
    buildDocumentUrls,
    handleOpenChange,
  ]);

  // Print cover page only (no slots list, no documents)
  const handlePrintSummaryOnly = useCallback(() => {
    printMapa(mapa, caseName, firmName, {
      includeCoverPage: true,
      coverPageOnly: true,
      includeDocuments: false,
    });
    handleOpenChange(false);
  }, [mapa, caseName, firmName, handleOpenChange]);

  // Retry failed documents
  const retryFailed = useCallback(async () => {
    const failedDocs = documents.filter((d) => d.selected && d.status === 'error');
    if (failedDocs.length === 0) return;

    setPhase('preparing');

    for (let i = 0; i < failedDocs.length; i++) {
      const doc = failedDocs[i];
      setCurrentIndex(i);

      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: 'loading' } : d)));

      try {
        const downloadUrl = await fetchDocumentUrl(doc.id);
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === doc.id ? { ...d, status: 'success', downloadUrl, error: undefined } : d
          )
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare la încărcare';
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, status: 'error', error: errorMessage } : d))
        );
      }
    }

    setPhase('ready');
  }, [documents, fetchDocumentUrl]);

  // Get status counts
  const successCount = documents.filter((d) => d.selected && d.status === 'success').length;
  const errorCount = documents.filter((d) => d.selected && d.status === 'error').length;
  const pendingCount = documents.filter(
    (d) => d.selected && (d.status === 'pending' || d.status === 'loading')
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Tipărește Mapa
          </DialogTitle>
        </DialogHeader>

        {/* Selection Phase */}
        {phase === 'selection' && (
          <>
            <div className="space-y-4">
              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={includeCoverPage}
                    onCheckedChange={(checked) => setIncludeCoverPage(checked === true)}
                  />
                  Include pagina de copertă
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={includeEmptySlots}
                    onCheckedChange={(checked) => setIncludeEmptySlots(checked === true)}
                  />
                  Include sloturile goale
                </label>
              </div>

              {/* Document Selection */}
              {totalCount > 0 && (
                <div className="border border-linear-border-subtle rounded-lg">
                  <div className="px-3 py-2 border-b border-linear-border-subtle bg-linear-bg-secondary flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Documente ({selectedCount} din {totalCount} selectate)
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="text-xs text-linear-accent hover:underline"
                        onClick={() => toggleAll(true)}
                      >
                        Selectează tot
                      </button>
                      <span className="text-linear-text-muted">|</span>
                      <button
                        className="text-xs text-linear-accent hover:underline"
                        onClick={() => toggleAll(false)}
                      >
                        Deselectează
                      </button>
                    </div>
                  </div>
                  <ScrollArea className="max-h-64">
                    <div className="divide-y divide-linear-border-subtle">
                      {documents.map((doc) => {
                        const FileIcon = getFileIcon(doc.fileType);
                        return (
                          <label
                            key={doc.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-linear-bg-secondary cursor-pointer"
                          >
                            <Checkbox
                              checked={doc.selected}
                              onCheckedChange={() => toggleDocument(doc.id)}
                            />
                            <FileIcon className="w-4 h-4 text-linear-text-tertiary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm truncate">{doc.fileName}</div>
                              <div className="text-xs text-linear-text-tertiary truncate">
                                {doc.slotName}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {totalCount === 0 && (
                <div className="text-center py-8 text-linear-text-tertiary">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nu există documente în această mapă.</p>
                  <p className="text-sm">Poți tipări doar sumarul.</p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Anulează
              </Button>
              <Button variant="secondary" onClick={handlePrintSummaryOnly}>
                <FileText className="w-4 h-4 mr-2" />
                Doar copertă
              </Button>
              {selectedCount > 0 && (
                <Button onClick={prepareDocuments}>
                  <Printer className="w-4 h-4 mr-2" />
                  Pregătește ({selectedCount})
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {/* Preparing Phase */}
        {phase === 'preparing' && (
          <>
            <div className="space-y-4">
              <div className="text-center py-4">
                <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-linear-accent" />
                <p className="text-sm text-linear-text-secondary">
                  Se pregătesc documentele pentru tipărire...
                </p>
                <p className="text-lg font-medium mt-1">
                  {currentIndex + 1} din {selectedCount}
                </p>
              </div>

              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {documents
                    .filter((d) => d.selected)
                    .map((doc) => {
                      const FileIcon = getFileIcon(doc.fileType);
                      return (
                        <div
                          key={doc.id}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded text-sm',
                            doc.status === 'loading' && 'bg-linear-bg-secondary',
                            doc.status === 'success' && 'text-linear-text-tertiary',
                            doc.status === 'error' && 'text-linear-error bg-red-50'
                          )}
                        >
                          {doc.status === 'pending' && (
                            <div className="w-4 h-4 rounded-full border-2 border-linear-border-subtle" />
                          )}
                          {doc.status === 'loading' && (
                            <Loader2 className="w-4 h-4 animate-spin text-linear-accent" />
                          )}
                          {doc.status === 'success' && (
                            <CheckCircle className="w-4 h-4 text-linear-success" />
                          )}
                          {doc.status === 'error' && <XCircle className="w-4 h-4" />}
                          <FileIcon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate flex-1">{doc.fileName}</span>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Anulează
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Ready Phase */}
        {phase === 'ready' && (
          <>
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center justify-center gap-6 py-4">
                {successCount > 0 && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-linear-success">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-2xl font-bold">{successCount}</span>
                    </div>
                    <p className="text-xs text-linear-text-tertiary">pregătite</p>
                  </div>
                )}
                {errorCount > 0 && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-linear-error">
                      <XCircle className="w-5 h-5" />
                      <span className="text-2xl font-bold">{errorCount}</span>
                    </div>
                    <p className="text-xs text-linear-text-tertiary">eșuate</p>
                  </div>
                )}
              </div>

              {/* Error list */}
              {errorCount > 0 && (
                <div className="border border-linear-error/30 rounded-lg bg-red-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-linear-error mb-2">
                    <AlertCircle className="w-4 h-4" />
                    Documente care nu au putut fi încărcate:
                  </div>
                  <div className="space-y-1">
                    {documents
                      .filter((d) => d.selected && d.status === 'error')
                      .map((doc) => (
                        <div key={doc.id} className="text-sm text-linear-text-secondary">
                          • {doc.fileName}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Success message */}
              {errorCount === 0 && successCount > 0 && (
                <div className="text-center text-linear-success">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                  <p>Toate documentele sunt pregătite!</p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Anulează
              </Button>
              {errorCount > 0 && (
                <Button variant="secondary" onClick={retryFailed}>
                  Reîncearcă eșuatele
                </Button>
              )}
              <Button onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Tipărește{successCount > 0 ? ` (${successCount} doc.)` : ''}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
