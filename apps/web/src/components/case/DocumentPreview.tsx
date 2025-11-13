/**
 * DocumentPreview - Document preview pane with metadata and version history
 * Shows document details, preview placeholder, and action buttons
 */

'use client';

import React from 'react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { clsx } from 'clsx';
import type { Document, DocumentVersion } from '@legal-platform/types';

export interface DocumentPreviewProps {
  document: Document | null;
  versions?: DocumentVersion[];
  onOpen?: (document: Document) => void;
  onDownload?: (document: Document) => void;
  onViewHistory?: (document: Document) => void;
  className?: string;
}

/**
 * EmptyState Component - Shown when no document is selected
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
      <svg
        className="w-16 h-16 mb-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
      <p className="text-sm font-medium">Selectați un document</p>
      <p className="text-xs mt-1 text-center">
        Faceți clic pe un document din listă pentru a vizualiza detaliile
      </p>
    </div>
  );
}

/**
 * VersionHistoryItem Component
 */
interface VersionHistoryItemProps {
  version: DocumentVersion;
}

function VersionHistoryItem({ version }: VersionHistoryItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-md hover:bg-gray-50 transition-colors">
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
        v{version.versionNumber}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {version.changesSummary}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {format(version.createdAt, "dd MMM yyyy 'la' HH:mm", { locale: ro })}
        </p>
      </div>
    </div>
  );
}

/**
 * DocumentPreview Component
 *
 * Shows document preview, metadata, action buttons, and version history
 */
export function DocumentPreview({
  document,
  versions = [],
  onOpen,
  onDownload,
  onViewHistory,
  className,
}: DocumentPreviewProps) {
  if (!document) {
    return (
      <div className={clsx('flex flex-col h-full bg-white border-l border-gray-200', className)}>
        <EmptyState />
      </div>
    );
  }

  const displayVersions = versions.slice(0, 5);
  const hasMoreVersions = versions.length > 5;

  return (
    <div className={clsx('flex flex-col h-full bg-white border-l border-gray-200', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Previzualizare Document</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Document Metadata */}
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">{document.title}</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              <span>Versiune curentă: v{document.currentVersion}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>
                Modificat: {format(document.updatedAt, 'dd MMMM yyyy', { locale: ro })}
              </span>
            </div>
            {document.aiGenerated && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span className="text-purple-700 font-medium">Generat cu AI</span>
              </div>
            )}
          </div>
        </div>

        {/* Preview Area */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <p className="text-sm text-gray-600 font-medium">
              Previzualizarea documentului va fi afișată aici
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Funcționalitate disponibilă în versiunile viitoare
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => onOpen?.(document)}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              Deschide
            </button>
            <button
              onClick={() => onDownload?.(document)}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Descarcă
            </button>
          </div>
        </div>

        {/* Version History */}
        {displayVersions.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-semibold text-gray-900">Istoric Versiuni</h5>
              {hasMoreVersions && (
                <button
                  onClick={() => onViewHistory?.(document)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Vezi toate
                </button>
              )}
            </div>
            <div className="space-y-1">
              {displayVersions.map((version) => (
                <VersionHistoryItem key={version.id} version={version} />
              ))}
              {hasMoreVersions && (
                <p className="text-xs text-gray-600 text-center py-2">
                  +{versions.length - 5} versiuni mai vechi
                </p>
              )}
            </div>
          </div>
        )}

        {/* No Version History */}
        {displayVersions.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">Niciun istoric de versiuni disponibil</p>
          </div>
        )}
      </div>
    </div>
  );
}

DocumentPreview.displayName = 'DocumentPreview';
