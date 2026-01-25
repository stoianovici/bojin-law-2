'use client';

import { useEffect } from 'react';
import { AlertCircle, Download, FileWarning } from 'lucide-react';

interface DOCViewerProps {
  url: string;
  fileName: string;
  onLoadSuccess?: () => void;
  onLoadError?: (error: Error) => void;
}

/**
 * DOCViewer - Fallback viewer for legacy .doc files
 *
 * New extractions automatically convert .doc to PDF for reliable preview.
 * This component shows a helpful message for any unconverted legacy files.
 */
export function DOCViewer({ url, fileName, onLoadError }: DOCViewerProps) {
  useEffect(() => {
    // Notify that this is a legacy format that couldn't be previewed
    onLoadError?.(new Error('Legacy .doc format - download required'));
  }, [onLoadError]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200">
        <div className="flex items-center gap-2 text-amber-700">
          <FileWarning className="h-4 w-4" />
          <span className="text-sm">Fișier .doc (format legacy)</span>
        </div>
        <a
          href={url}
          download={fileName}
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          <Download className="h-3.5 w-3.5" />
          Descarcă
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
        <AlertCircle className="h-16 w-16 text-amber-400 mb-6" />

        <h3 className="text-lg font-medium text-gray-800 mb-2">
          Format legacy nesuportat pentru previzualizare
        </h3>

        <p className="text-gray-600 text-center max-w-md mb-6">
          Acest document folosește formatul .doc (Microsoft Word 97-2003) care nu poate fi
          previzualizat direct în browser. Documentele noi sunt convertite automat la PDF.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={url}
            download={fileName}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Download className="h-5 w-5" />
            Descarcă documentul
          </a>
        </div>

        <p className="text-gray-400 text-sm mt-6 text-center">
          Tip: Pentru a activa previzualizarea, re-importați sesiunea cu LibreOffice instalat.
        </p>
      </div>
    </div>
  );
}
