'use client';

import { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import { Loader2, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react';

interface DOCXViewerProps {
  url: string;
  onLoadSuccess?: () => void;
  onLoadError?: (error: Error) => void;
}

export function DOCXViewer({ url, onLoadSuccess, onLoadError }: DOCXViewerProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);

  useEffect(() => {
    let isMounted = true;

    async function loadDocument() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch the document file
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // Convert DOCX to HTML using mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer });

        if (isMounted) {
          setHtmlContent(result.value);
          setIsLoading(false);
          onLoadSuccess?.();

          // Log any warnings from conversion
          if (result.messages.length > 0) {
            console.warn('Mammoth conversion warnings:', result.messages);
          }
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load document';
          setError(errorMessage);
          setIsLoading(false);
          onLoadError?.(err instanceof Error ? err : new Error(errorMessage));
        }
      }
    }

    loadDocument();

    return () => {
      isMounted = false;
    };
  }, [url, onLoadSuccess, onLoadError]);

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 2.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 rounded-lg p-8">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-gray-700 font-medium">Failed to load document</p>
        <p className="text-gray-500 text-sm mt-2">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">Loading document...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-end px-4 py-2 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="text-sm text-gray-600 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 2.0}
            className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-auto bg-gray-200 p-4">
        <div
          className="bg-white shadow-lg mx-auto p-8 max-w-4xl"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            minHeight: '297mm', // A4 height
          }}
        >
          {htmlContent && (
            <div
              className="docx-content prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </div>
      </div>

      {/* Custom styles for rendered DOCX content - using dangerouslySetInnerHTML to avoid jsx/global prop issues */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .docx-content {
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #000;
        }
        .docx-content p {
          margin-bottom: 0.5em;
        }
        .docx-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        .docx-content table td,
        .docx-content table th {
          border: 1px solid #ddd;
          padding: 8px;
        }
        .docx-content img {
          max-width: 100%;
          height: auto;
        }
        .docx-content h1,
        .docx-content h2,
        .docx-content h3 {
          font-weight: bold;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        .docx-content h1 {
          font-size: 18pt;
        }
        .docx-content h2 {
          font-size: 14pt;
        }
        .docx-content h3 {
          font-size: 12pt;
        }
        .docx-content ul,
        .docx-content ol {
          margin-left: 1.5em;
          margin-bottom: 0.5em;
        }
      `,
        }}
      />
    </div>
  );
}
