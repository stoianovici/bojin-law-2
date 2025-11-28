'use client';

import { useMemo } from 'react';
import { FileText, AlertCircle } from 'lucide-react';
import { PDFViewer } from './PDFViewer';
import { DOCXViewer } from './DOCXViewer';

interface DocumentViewerProps {
  url: string | null;
  fileName: string;
  fileExtension: string;
  extractedText?: string | null;
  onLoadSuccess?: () => void;
  onLoadError?: (error: Error) => void;
}

export function DocumentViewer({
  url,
  fileName,
  fileExtension,
  extractedText,
  onLoadSuccess,
  onLoadError,
}: DocumentViewerProps) {
  const normalizedExtension = useMemo(
    () => fileExtension.toLowerCase().replace('.', ''),
    [fileExtension]
  );

  // No URL provided - show placeholder
  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 rounded-lg p-8">
        <FileText className="h-16 w-16 text-gray-300 mb-4" />
        <p className="text-gray-500 text-center">Select a document to preview</p>
      </div>
    );
  }

  // PDF viewer
  if (normalizedExtension === 'pdf') {
    return (
      <PDFViewer url={url} onLoadSuccess={() => onLoadSuccess?.()} onLoadError={onLoadError} />
    );
  }

  // DOCX viewer (modern format - mammoth can handle)
  if (normalizedExtension === 'docx') {
    return <DOCXViewer url={url} onLoadSuccess={onLoadSuccess} onLoadError={onLoadError} />;
  }

  // Legacy DOC viewer - show extracted text or warning
  if (normalizedExtension === 'doc') {
    // If we have extracted text, show it
    if (extractedText && extractedText.length > 50) {
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Fișier .doc (format legacy) - afișare text extras</span>
            </div>
            {url && (
              <a href={url} download={fileName} className="text-sm text-blue-600 hover:underline">
                Descarcă original
              </a>
            )}
          </div>
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            <div className="bg-white shadow-lg mx-auto p-8 max-w-4xl min-h-full">
              <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
                {extractedText}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    // No extracted text - show warning with download
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 rounded-lg p-8">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <p className="text-gray-700 font-medium">Format .doc nesuportat pentru previzualizare</p>
        <p className="text-gray-500 text-sm mt-2 text-center max-w-md">
          Fișierele .doc (Microsoft Word 97-2003) nu pot fi afișate în browser. Descărcați
          documentul pentru a-l vizualiza.
        </p>
        {url && (
          <a
            href={url}
            download={fileName}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Descarcă documentul
          </a>
        )}
      </div>
    );
  }

  // Unsupported file type
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 rounded-lg p-8">
      <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
      <p className="text-gray-700 font-medium">Unsupported file type</p>
      <p className="text-gray-500 text-sm mt-2">Cannot preview .{normalizedExtension} files</p>
      <p className="text-gray-400 text-xs mt-4">Supported formats: PDF, DOCX, DOC</p>
    </div>
  );
}

// Re-export individual viewers for direct use
export { PDFViewer } from './PDFViewer';
export { DOCXViewer } from './DOCXViewer';
