/**
 * AttachmentPreviewPanel Component
 * OPS-122: Inline Attachment Preview Panel
 *
 * Side panel for previewing email attachments without blocking the email view.
 * Aggregates all attachments from a thread and allows quick navigation.
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  AlertCircle,
  ExternalLink,
  GripVertical,
} from 'lucide-react';
import { format } from 'date-fns';
import type { ThreadAttachment } from '../../hooks/useThreadAttachments';

// ============================================================================
// Types
// ============================================================================

export interface AttachmentPreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAttachment: ThreadAttachment | null;
  threadAttachments: ThreadAttachment[];
  onSelectAttachment: (attachmentId: string, messageId: string) => void;
  onRequestPreviewUrl: (attachmentId: string) => Promise<string | null>;
  onDownload?: (attachment: ThreadAttachment) => void;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_PANEL_WIDTH = 350;
const MAX_PANEL_WIDTH = 700;
const DEFAULT_PANEL_WIDTH = 450;

/** File types that can be previewed with Office Online */
const OFFICE_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
];

/** File types that can be previewed natively */
const PREVIEWABLE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  ...OFFICE_TYPES,
];

// ============================================================================
// Helpers
// ============================================================================

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) {
    return <FileImage className="h-4 w-4" />;
  }
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) {
    return <FileSpreadsheet className="h-4 w-4" />;
  }
  if (contentType.includes('word') || contentType.includes('document')) {
    return <FileText className="h-4 w-4" />;
  }
  if (contentType === 'application/pdf') {
    return <FileText className="h-4 w-4" />;
  }
  return <File className="h-4 w-4" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canPreview(contentType: string): boolean {
  return PREVIEWABLE_TYPES.some(
    (type) => contentType === type || contentType.startsWith(type.split('/')[0] + '/')
  );
}

// ============================================================================
// Component
// ============================================================================

export function AttachmentPreviewPanel({
  isOpen,
  onClose,
  selectedAttachment,
  threadAttachments,
  onSelectAttachment,
  onRequestPreviewUrl,
  onDownload,
}: AttachmentPreviewPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevAttachmentIdRef = useRef<string | null>(null);

  // Load preview when attachment changes
  useEffect(() => {
    if (!isOpen || !selectedAttachment) {
      prevAttachmentIdRef.current = null;
      return;
    }

    // Only reload if attachment changed
    if (prevAttachmentIdRef.current === selectedAttachment.id) {
      return;
    }
    prevAttachmentIdRef.current = selectedAttachment.id;

    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      setPreviewUrl(null);

      // Check if file type is previewable
      if (!canPreview(selectedAttachment.contentType)) {
        setError('Acest tip de fișier nu poate fi previzualizat');
        setLoading(false);
        return;
      }

      try {
        const url = await onRequestPreviewUrl(selectedAttachment.id);
        if (url) {
          setPreviewUrl(url);
        } else {
          setError('Nu s-a putut genera link-ul de previzualizare');
        }
      } catch {
        setError('Eroare la încărcarea previzualizării');
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [isOpen, selectedAttachment, onRequestPreviewUrl]);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Navigation helpers
  const currentIndex = threadAttachments.findIndex((a) => a.id === selectedAttachment?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < threadAttachments.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      const prev = threadAttachments[currentIndex - 1];
      onSelectAttachment(prev.id, prev.messageId);
    }
  }, [hasPrev, currentIndex, threadAttachments, onSelectAttachment]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      const next = threadAttachments[currentIndex + 1];
      onSelectAttachment(next.id, next.messageId);
    }
  }, [hasNext, currentIndex, threadAttachments, onSelectAttachment]);

  // Handle download
  const handleDownload = useCallback(() => {
    if (!selectedAttachment) return;

    if (onDownload) {
      onDownload(selectedAttachment);
    } else if (selectedAttachment.downloadUrl) {
      window.open(selectedAttachment.downloadUrl, '_blank');
    }
  }, [selectedAttachment, onDownload]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && hasNext) {
        handleNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrev, hasNext, handlePrev, handleNext, onClose]);

  if (!isOpen) return null;

  const isImage = selectedAttachment?.contentType.startsWith('image/');
  const isPdf = selectedAttachment?.contentType === 'application/pdf';
  const isOffice = OFFICE_TYPES.includes(selectedAttachment?.contentType || '');
  const isBlobUrl = previewUrl?.startsWith('blob:');

  return (
    <div
      ref={panelRef}
      className="h-full border-l bg-white flex flex-col shadow-lg"
      style={{ width: panelWidth }}
    >
      {/* Resize Handle */}
      <div
        className={clsx(
          'absolute left-0 top-0 bottom-0 w-1 cursor-col-resize group hover:bg-blue-500/50 transition-colors z-10',
          isResizing && 'bg-blue-500'
        )}
        onMouseDown={handleResizeStart}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-6 w-6 text-gray-400" />
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <div className="min-w-0 flex-1 mr-3">
          <h3 className="font-semibold text-gray-900 truncate text-sm">
            {selectedAttachment?.name || 'Atașament'}
          </h3>
          {selectedAttachment && (
            <p className="text-xs text-gray-500 mt-0.5">
              De la {selectedAttachment.messageSender} •{' '}
              {format(selectedAttachment.messageDate, 'dd.MM.yyyy')}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
          aria-label="Închide panoul"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 relative overflow-hidden bg-gray-100">
        {/* Loading State */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">Se încarcă...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="flex flex-col items-center gap-4 text-center max-w-xs">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-amber-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Previzualizare indisponibilă</h4>
                <p className="text-sm text-gray-600">{error}</p>
              </div>
              {selectedAttachment && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Descarcă fișierul
                </button>
              )}
            </div>
          </div>
        )}

        {/* Preview Content */}
        {previewUrl && !error && !loading && (
          <>
            {/* Images - display directly */}
            {isImage && (
              <div className="absolute inset-0 flex items-center justify-center p-4 overflow-auto">
                <img
                  src={previewUrl}
                  alt={selectedAttachment?.name || 'Preview'}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}

            {/* PDF - use object tag for blob, iframe for external URL */}
            {isPdf &&
              (isBlobUrl ? (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  className="w-full h-full"
                  title={`Previzualizare: ${selectedAttachment?.name}`}
                >
                  <p className="text-center text-gray-500 p-8">
                    Browserul nu poate afișa acest PDF.
                  </p>
                </object>
              ) : (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title={`Previzualizare: ${selectedAttachment?.name}`}
                  sandbox="allow-same-origin allow-scripts"
                />
              ))}

            {/* Office docs with blob URL - can't preview, show download prompt */}
            {isOffice && isBlobUrl && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-4 text-center max-w-xs">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                    {getFileIcon(selectedAttachment?.contentType || '')}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Fișier Office</h4>
                    <p className="text-sm text-gray-600">
                      Descărcați sau deschideți în Microsoft 365 pentru vizualizare.
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Descarcă
                  </button>
                </div>
              </div>
            )}

            {/* Office docs with external URL - use iframe */}
            {isOffice && !isBlobUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={`Previzualizare: ${selectedAttachment?.name}`}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
            )}

            {/* Text/other files - use iframe */}
            {!isImage && !isPdf && !isOffice && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={`Previzualizare: ${selectedAttachment?.name}`}
                sandbox="allow-same-origin"
              />
            )}
          </>
        )}
      </div>

      {/* Navigation Actions */}
      <div className="flex items-center justify-between p-3 border-t bg-white flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            disabled={!hasPrev}
            onClick={handlePrev}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Anterior (←)"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>
          <span className="text-xs text-gray-500 px-2">
            {currentIndex + 1} / {threadAttachments.length}
          </span>
          <button
            disabled={!hasNext}
            onClick={handleNext}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Următor (→)"
          >
            <span className="hidden sm:inline">Următor</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {previewUrl && !isBlobUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Deschide în fereastră nouă"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            title="Descarcă"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Descarcă</span>
          </button>
        </div>
      </div>

      {/* All Attachments List */}
      <div className="border-t bg-gray-50 flex-shrink-0 max-h-48 overflow-y-auto">
        <div className="p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">
            Atașamente în conversație ({threadAttachments.length})
          </p>
          <div className="space-y-1">
            {threadAttachments.map((att) => (
              <button
                key={att.id}
                onClick={() => onSelectAttachment(att.id, att.messageId)}
                className={clsx(
                  'w-full text-left px-2.5 py-2 rounded text-sm flex items-center gap-2 transition-colors',
                  att.id === selectedAttachment?.id
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'hover:bg-gray-100 text-gray-700'
                )}
              >
                <span className="text-gray-400 flex-shrink-0">{getFileIcon(att.contentType)}</span>
                <span className="truncate flex-1">{att.name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatFileSize(att.size)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

AttachmentPreviewPanel.displayName = 'AttachmentPreviewPanel';
