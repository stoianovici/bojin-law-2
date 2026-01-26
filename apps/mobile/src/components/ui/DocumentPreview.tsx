'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Download, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

interface DocumentPreviewProps {
  open: boolean;
  onClose: () => void;
  fileName: string | null;
  fileType: string | null;
  previewUrl: string | null;
  previewSource: 'pdf' | 'office365' | 'image' | null;
  thumbnailUrl: string | null;
  loading: boolean;
  error?: Error | null;
}

// ============================================
// Helpers
// ============================================

function getFileIcon(fileType: string | null): string {
  if (!fileType) return 'file';
  if (fileType.includes('pdf')) return 'pdf';
  if (fileType.includes('word') || fileType.includes('document')) return 'doc';
  if (fileType.includes('excel') || fileType.includes('sheet')) return 'xls';
  if (fileType.includes('image')) return 'img';
  return 'file';
}

function getFileExtension(fileName: string | null): string {
  if (!fileName) return '';
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toUpperCase() || '' : '';
}

// ============================================
// Component
// ============================================

export function DocumentPreview({
  open,
  onClose,
  fileName,
  fileType,
  previewUrl,
  previewSource,
  thumbnailUrl,
  loading,
  error,
}: DocumentPreviewProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reset iframe loaded state when preview URL changes
  useEffect(() => {
    setIframeLoaded(false);
  }, [previewUrl]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Only render on client
  if (typeof window === 'undefined') return null;

  const extension = getFileExtension(fileName);
  const canPreview = previewUrl && !error;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/80"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Preview Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            className={clsx(
              'fixed inset-x-0 bottom-0 z-50',
              'bg-bg-primary rounded-t-2xl',
              'flex flex-col',
              'h-[95vh]'
            )}
            style={{
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                    'bg-bg-elevated'
                  )}
                >
                  {extension ? (
                    <span className="text-xs font-bold text-text-secondary">{extension}</span>
                  ) : (
                    <FileText className="w-5 h-5 text-text-tertiary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 id="preview-title" className="text-sm font-medium text-text-primary truncate">
                    {fileName || 'Document'}
                  </h2>
                  {previewSource && (
                    <p className="text-xs text-text-tertiary">
                      {previewSource === 'office365' && 'Office Online'}
                      {previewSource === 'pdf' && 'PDF Preview'}
                      {previewSource === 'image' && 'Image'}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-bg-elevated"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 relative overflow-hidden bg-bg-elevated">
              {/* Loading State */}
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  <p className="text-sm text-text-secondary">Se încarcă previzualizarea...</p>
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
                  <AlertCircle className="w-12 h-12 text-error" />
                  <p className="text-sm text-text-secondary text-center">
                    Nu s-a putut încărca previzualizarea
                  </p>
                  <p className="text-xs text-text-tertiary text-center">{error.message}</p>
                </div>
              )}

              {/* Iframe Loading Indicator */}
              {canPreview && !iframeLoaded && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Thumbnail"
                      className="w-32 h-32 object-contain rounded-lg opacity-50"
                    />
                  ) : (
                    <FileText className="w-16 h-16 text-text-tertiary" />
                  )}
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                  <p className="text-sm text-text-secondary">Se deschide documentul...</p>
                </div>
              )}

              {/* Preview Iframe */}
              {canPreview && (
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  className={clsx('w-full h-full border-0', !iframeLoaded && 'opacity-0')}
                  onLoad={() => setIframeLoaded(true)}
                  title={fileName || 'Document Preview'}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              )}

              {/* No Preview Available */}
              {!canPreview && !loading && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Thumbnail"
                      className="w-40 h-40 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-bg-card flex items-center justify-center">
                      <FileText className="w-12 h-12 text-text-tertiary" />
                    </div>
                  )}
                  <p className="text-sm text-text-secondary text-center">
                    Previzualizarea nu este disponibilă pentru acest tip de fișier
                  </p>
                  <p className="text-xs text-text-tertiary text-center">
                    Descarcă documentul pentru a-l vizualiza
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
