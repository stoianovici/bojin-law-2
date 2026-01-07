/**
 * PDFViewer Component
 * Custom PDF viewer using react-pdf with 150% zoom default
 * Replaces OneDrive preview for PDFs to give us full control over zoom
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import react-pdf styles
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker - using CDN to avoid webpack bundling issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface PDFViewerProps {
  /** URL to the PDF file */
  url: string;
  /** Initial scale (1 = 100%, 1.5 = 150%, etc.) */
  initialScale?: number;
  /** Callback when PDF fails to load */
  onError?: (error: Error) => void;
  /** Callback when PDF loads successfully */
  onLoadSuccess?: (numPages: number) => void;
  /** Custom class name for the container */
  className?: string;
}

export function PDFViewer({
  url,
  initialScale = 1.5,
  onError,
  onLoadSuccess,
  className,
}: PDFViewerProps) {
  const t = useTranslations('documents.pdf');
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(initialScale);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle document load success
  const handleLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setLoading(false);
      onLoadSuccess?.(numPages);
    },
    [onLoadSuccess]
  );

  // Handle document load error
  const handleLoadError = useCallback(
    (err: Error) => {
      setError(t('error'));
      setLoading(false);
      onError?.(err);
    },
    [onError, t]
  );

  // Navigation functions
  const goToPrevPage = useCallback(() => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber((prev) => Math.min(numPages || prev, prev + 1));
  }, [numPages]);

  // Zoom functions
  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(3, prev + 0.25));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.5, prev - 0.25));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1.5);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevPage, goToNextPage, zoomIn, zoomOut, resetZoom]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-linear-error">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-linear-bg-secondary border-b border-linear-border-subtle">
        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="p-1.5 rounded hover:bg-linear-bg-hover disabled:opacity-50 disabled:cursor-not-allowed text-linear-text-secondary"
            aria-label={t('previousPage')}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm text-linear-text-secondary min-w-[100px] text-center">
            {loading ? '...' : `${pageNumber} / ${numPages || '?'}`}
          </span>
          <button
            onClick={goToNextPage}
            disabled={!numPages || pageNumber >= numPages}
            className="p-1.5 rounded hover:bg-linear-bg-hover disabled:opacity-50 disabled:cursor-not-allowed text-linear-text-secondary"
            aria-label={t('nextPage')}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-1.5 rounded hover:bg-linear-bg-hover disabled:opacity-50 disabled:cursor-not-allowed text-linear-text-secondary"
            aria-label={t('zoomOut')}
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            onClick={resetZoom}
            className="px-2 py-1 text-sm text-linear-text-secondary hover:bg-linear-bg-hover rounded min-w-[60px]"
            aria-label={t('zoom')}
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={scale >= 3}
            className="p-1.5 rounded hover:bg-linear-bg-hover disabled:opacity-50 disabled:cursor-not-allowed text-linear-text-secondary"
            aria-label={t('zoomIn')}
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-linear-bg-tertiary flex justify-center"
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-linear-accent" />
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          loading={null}
          className="py-4"
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            className="shadow-lg"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}

PDFViewer.displayName = 'PDFViewer';

export default PDFViewer;
