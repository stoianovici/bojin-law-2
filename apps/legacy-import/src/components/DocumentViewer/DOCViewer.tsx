'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';

interface DOCViewerProps {
  url: string;
  fileName: string;
  onLoadSuccess?: () => void;
  onLoadError?: (error: Error) => void;
}

export function DOCViewer({ url, fileName, onLoadSuccess, onLoadError }: DOCViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use Google Docs viewer for .doc files
  const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;

  const handleLoad = () => {
    setIsLoading(false);
    setError(null);
    onLoadSuccess?.();
  };

  const handleError = () => {
    setError('Nu s-a putut încărca documentul');
    setIsLoading(false);
    onLoadError?.(new Error('Failed to load document in viewer'));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200">
        <div className="flex items-center gap-2 text-amber-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Fișier .doc (format legacy) - vizualizare via Google Docs</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Deschide în tab nou
          </a>
          <a href={url} download={fileName} className="text-sm text-blue-600 hover:underline">
            Descarcă
          </a>
        </div>
      </div>

      {/* Viewer */}
      <div className="flex-1 relative bg-gray-100">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Se încarcă documentul...</p>
            <p className="text-gray-400 text-sm mt-2">Poate dura câteva secunde</p>
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8">
            <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
            <p className="text-gray-700 font-medium">{error}</p>
            <p className="text-gray-500 text-sm mt-2 text-center max-w-md">
              Vizualizarea online nu este disponibilă. Puteți descărca documentul pentru a-l
              vizualiza local.
            </p>
            <a
              href={url}
              download={fileName}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Descarcă documentul
            </a>
          </div>
        ) : (
          <iframe
            src={viewerUrl}
            className="w-full h-full border-0"
            onLoad={handleLoad}
            onError={handleError}
            title={`Document viewer: ${fileName}`}
          />
        )}
      </div>
    </div>
  );
}
