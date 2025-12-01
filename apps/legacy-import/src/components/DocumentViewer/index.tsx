'use client';

import { useMemo } from 'react';
import { FileText, AlertCircle } from 'lucide-react';
import { PDFViewer } from './PDFViewer';
import { DOCXViewer } from './DOCXViewer';
import { DOCViewer } from './DOCViewer';

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
  extractedText: _extractedText,
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

  // Legacy DOC viewer - use Google Docs viewer
  if (normalizedExtension === 'doc') {
    return (
      <DOCViewer
        url={url}
        fileName={fileName}
        onLoadSuccess={onLoadSuccess}
        onLoadError={onLoadError}
      />
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
export { DOCViewer } from './DOCViewer';
