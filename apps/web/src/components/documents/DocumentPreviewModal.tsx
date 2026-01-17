/**
 * DocumentPreviewModal Component
 * Full-screen modal for previewing documents
 * Supports PDFs (react-pdf), images (native), Office docs (Office Online), text files
 */

'use client';

import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, Download, ExternalLink, Loader2, FileText, AlertCircle, FileEdit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Document, FileType } from '@/types/document';
import { formatFileSize, fileTypeColors } from '@/types/document';
import { getPreviewMethod, type PreviewMethod } from '@/hooks/useDocumentPreview';
import { useUserPreferences } from '@/hooks/useSettings';

// Lazy load PDFViewer to avoid loading react-pdf bundle until needed
const PDFViewer = lazy(() => import('./PDFViewer'));

// ============================================================================
// Types
// ============================================================================

/** Minimal document info needed for preview */
export interface PreviewDocument {
  id: string;
  fileName: string;
  fileType: FileType;
  fileSize?: number;
  thumbnailUrl?: string;
  downloadUrl?: string;
}

export interface DocumentPreviewModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Document to preview (can be full Document or minimal PreviewDocument) */
  document: PreviewDocument | Document | null;
  /** Callback to fetch preview URL (for Office docs) */
  onRequestPreviewUrl?: (documentId: string) => Promise<string | null>;
  /** Callback to fetch download URL (for PDFs) */
  onRequestDownloadUrl?: (documentId: string) => Promise<string | null>;
  /** Callback to fetch text content (for text files) */
  onRequestTextContent?: (documentId: string) => Promise<string | null>;
  /** Callback when download is clicked */
  onDownload?: (document: PreviewDocument | Document) => void;
  /** Callback to open document in Word desktop app */
  onOpenInWord?: (
    documentId: string
  ) => Promise<{ wordUrl: string; webUrl?: string | null } | null>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get human-readable file type label
 */
function getFileTypeLabel(fileType: FileType): string {
  const labels: Record<FileType, string> = {
    pdf: 'PDF',
    docx: 'Word',
    xlsx: 'Excel',
    pptx: 'PowerPoint',
    image: 'Image',
    other: 'File',
  };
  return labels[fileType] || 'File';
}

/**
 * Get preview method from file type
 */
function getPreviewMethodFromFileType(fileType: FileType): PreviewMethod {
  return getPreviewMethod(fileType);
}

// ============================================================================
// FileTypeIcon Component
// ============================================================================

function FileTypeIcon({ fileType, className }: { fileType: FileType; className?: string }) {
  const color = fileTypeColors[fileType];
  return (
    <svg className={className} style={{ color }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

/** Word document file types that support "Edit in Word" */
const WORD_FILE_TYPES: FileType[] = ['docx'];

function isWordDocument(fileType: FileType): boolean {
  return WORD_FILE_TYPES.includes(fileType);
}

export function DocumentPreviewModal({
  isOpen,
  onClose,
  document,
  onRequestPreviewUrl,
  onRequestDownloadUrl,
  onRequestTextContent,
  onDownload,
  onOpenInWord,
}: DocumentPreviewModalProps) {
  const t = useTranslations('documents');
  const tCommon = useTranslations('common');
  const { data: userPreferences } = useUserPreferences();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [openingInWord, setOpeningInWord] = useState(false);
  const prevDocIdRef = useRef<string | null>(null);

  // Determine preview method based on file type
  const previewMethod = document ? getPreviewMethodFromFileType(document.fileType) : 'unsupported';

  // Fetch preview URL when document changes
  useEffect(() => {
    if (!isOpen || !document) {
      prevDocIdRef.current = null;
      return;
    }

    const docChanged = prevDocIdRef.current !== document.id;
    prevDocIdRef.current = document.id;

    const loadPreview = async () => {
      const method = getPreviewMethodFromFileType(document.fileType);

      // For text files, fetch content
      if (method === 'text' && onRequestTextContent) {
        try {
          const content = await onRequestTextContent(document.id);
          if (content !== null) {
            setTextContent(content);
          } else {
            setError('Nu s-a putut încărca conținutul text');
          }
        } catch {
          setError('Eroare la încărcarea conținutului text');
        } finally {
          setLoading(false);
        }
        return;
      }

      // For PDFs, fetch download URL for react-pdf
      if (method === 'pdf' && onRequestDownloadUrl) {
        try {
          const url = await onRequestDownloadUrl(document.id);
          if (url) {
            setPdfDownloadUrl(url);
          } else {
            setError('Nu s-a putut obține URL-ul PDF');
          }
        } catch {
          setError('Eroare la încărcarea PDF');
        } finally {
          setLoading(false);
        }
        return;
      }

      // For images, use thumbnail/download URL directly
      if (method === 'image') {
        if (document.thumbnailUrl || document.downloadUrl) {
          setPreviewUrl(document.thumbnailUrl || document.downloadUrl || null);
          setLoading(false);
        } else if (onRequestDownloadUrl) {
          try {
            const url = await onRequestDownloadUrl(document.id);
            if (url) {
              setPreviewUrl(url);
            } else {
              setError('Nu s-a putut încărca imaginea');
            }
          } catch {
            setError('Eroare la încărcarea imaginii');
          } finally {
            setLoading(false);
          }
        } else {
          setError('URL imagine indisponibil');
          setLoading(false);
        }
        return;
      }

      // For Office docs, fetch preview URL
      if (method === 'office' && onRequestPreviewUrl) {
        try {
          const url = await onRequestPreviewUrl(document.id);
          if (url) {
            setPreviewUrl(url);
          } else {
            setError('Nu s-a putut obține URL-ul de previzualizare');
          }
        } catch {
          setError('Eroare la încărcarea previzualizării');
        } finally {
          setLoading(false);
        }
        return;
      }

      // Unsupported file type
      if (method === 'unsupported') {
        setError('Acest tip de fișier nu poate fi previzualizat');
        setLoading(false);
        return;
      }

      // No handler available
      setError('Previzualizare indisponibilă');
      setLoading(false);
    };

    // Only reset and reload if document changed
    if (docChanged) {
      setLoading(true);
      setError(null);
      setPreviewUrl(null);
      setPdfDownloadUrl(null);
      setTextContent(null);
      loadPreview();
    }
  }, [isOpen, document, onRequestPreviewUrl, onRequestDownloadUrl, onRequestTextContent]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setLoading(false);
  }, []);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    setLoading(false);
    setError('Nu s-a putut încărca previzualizarea');
  }, []);

  // Handle download click
  const handleDownload = useCallback(() => {
    if (!document) return;

    if (onDownload) {
      onDownload(document);
    } else if (document.downloadUrl) {
      window.open(document.downloadUrl, '_blank');
    }
  }, [document, onDownload]);

  // Handle open in new tab
  const handleOpenInNewTab = useCallback(() => {
    const url = pdfDownloadUrl || previewUrl || document?.downloadUrl;
    if (url) {
      window.open(url, '_blank');
    }
  }, [pdfDownloadUrl, previewUrl, document?.downloadUrl]);

  // Handle open in Word - respects user preference for Desktop vs Online
  const handleOpenInWord = useCallback(async () => {
    if (!document || !onOpenInWord) return;

    setOpeningInWord(true);
    try {
      const result = await onOpenInWord(document.id);
      if (!result) return;

      const preferDesktop = userPreferences?.documentOpenMethod === 'DESKTOP';

      if (preferDesktop) {
        // Prefer Word Desktop, fall back to Word Online
        if (result.wordUrl) {
          window.location.href = result.wordUrl;
        } else if (result.webUrl) {
          window.open(result.webUrl, '_blank');
        }
      } else {
        // Prefer Word Online, fall back to Word Desktop
        if (result.webUrl) {
          window.open(result.webUrl, '_blank');
        } else if (result.wordUrl) {
          window.location.href = result.wordUrl;
        }
      }
    } catch (err) {
      console.error('Failed to open in Word:', err);
    } finally {
      setOpeningInWord(false);
    }
  }, [document, onOpenInWord, userPreferences?.documentOpenMethod]);

  if (!document) return null;

  const fileTypeLabel = getFileTypeLabel(document.fileType);
  const fileSize = document.fileSize ? formatFileSize(document.fileSize) : null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
        <DialogPrimitive.Content
          className="fixed inset-4 md:inset-8 bg-linear-bg-elevated rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden"
          onEscapeKeyDown={onClose}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-linear-border-subtle bg-linear-bg-secondary">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-linear-bg-tertiary flex items-center justify-center">
                <FileTypeIcon fileType={document.fileType} className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <DialogPrimitive.Title className="font-semibold text-linear-text-primary truncate">
                  {document.fileName}
                </DialogPrimitive.Title>
                <div className="text-sm text-linear-text-tertiary flex items-center gap-2">
                  <span>{fileTypeLabel}</span>
                  {fileSize && (
                    <>
                      <span>•</span>
                      <span>{fileSize}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Edit in Word button - for Word documents only */}
              {isWordDocument(document.fileType) && onOpenInWord && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenInWord}
                  disabled={openingInWord}
                >
                  {openingInWord ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileEdit className="h-4 w-4 mr-2" />
                  )}
                  <span className="hidden sm:inline">Editează în Word</span>
                  <span className="sm:hidden">Word</span>
                </Button>
              )}

              {/* Open in new tab */}
              {(pdfDownloadUrl || previewUrl || document.downloadUrl) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenInNewTab}
                  className="text-linear-text-secondary"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Deschide</span>
                </Button>
              )}

              {/* Download button */}
              {(document.downloadUrl || pdfDownloadUrl) && (
                <Button variant="secondary" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Descarcă</span>
                </Button>
              )}

              {/* Close button */}
              <DialogPrimitive.Close asChild>
                <button
                  className="p-2 text-linear-text-tertiary hover:text-linear-text-primary hover:bg-linear-bg-hover rounded-lg transition-colors"
                  aria-label={tCommon('close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Preview Content */}
          <div className="flex-1 relative bg-linear-bg-tertiary overflow-hidden">
            {/* Loading State */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-linear-bg-primary/80 z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-linear-accent" />
                  <span className="text-sm text-linear-text-secondary">{tCommon('loading')}</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center p-8 max-w-md">
                  <div className="w-16 h-16 rounded-full bg-linear-error/10 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-linear-error" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-linear-text-primary mb-1">
                      {t('noPreview')}
                    </h3>
                    <p className="text-sm text-linear-text-secondary">{error}</p>
                  </div>
                  {(document.downloadUrl || pdfDownloadUrl) && (
                    <Button onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      {tCommon('download')}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* PDF Preview */}
            {!error && previewMethod === 'pdf' && pdfDownloadUrl && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-linear-accent" />
                  </div>
                }
              >
                <PDFViewer
                  url={pdfDownloadUrl}
                  initialScale={1.5}
                  onLoadSuccess={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setError('Nu s-a putut încărca documentul PDF');
                  }}
                  className="h-full"
                />
              </Suspense>
            )}

            {/* Image Preview */}
            {!error && previewMethod === 'image' && previewUrl && (
              <div className="absolute inset-0 flex items-center justify-center p-8 overflow-auto">
                <img
                  src={previewUrl}
                  alt={document.fileName}
                  className={cn(
                    'max-w-full max-h-full object-contain shadow-lg rounded',
                    loading && 'invisible'
                  )}
                  onLoad={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setError('Nu s-a putut încărca imaginea');
                  }}
                />
              </div>
            )}

            {/* Office Preview (iframe) */}
            {!error && previewMethod === 'office' && previewUrl && (
              <iframe
                src={previewUrl}
                className={cn('w-full h-full border-0', loading && 'invisible')}
                title={`Preview: ${document.fileName}`}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
            )}

            {/* Text Content Preview */}
            {!error && previewMethod === 'text' && textContent !== null && (
              <div className="absolute inset-0 overflow-auto bg-linear-bg-primary p-6">
                <pre className="font-mono text-sm text-linear-text-primary whitespace-pre-wrap break-words leading-relaxed">
                  {textContent}
                </pre>
              </div>
            )}

            {/* Unsupported File Type */}
            {!error && !loading && previewMethod === 'unsupported' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center p-8 max-w-md">
                  <div className="w-16 h-16 rounded-full bg-linear-bg-secondary flex items-center justify-center">
                    <FileText className="h-8 w-8 text-linear-text-tertiary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-linear-text-primary mb-1">
                      {t('noPreview')}
                    </h3>
                    <p className="text-sm text-linear-text-secondary">
                      Acest tip de fișier ({fileTypeLabel}) nu poate fi previzualizat în browser.
                    </p>
                  </div>
                  {document.downloadUrl && (
                    <Button onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      {tCommon('download')}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

DocumentPreviewModal.displayName = 'DocumentPreviewModal';

export default DocumentPreviewModal;
