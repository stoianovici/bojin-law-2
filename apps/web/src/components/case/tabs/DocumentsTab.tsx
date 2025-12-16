/**
 * DocumentsTab - Main documents tab with three-column layout
 * Combines folder tree, document list, and preview pane
 */

'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import type { Document, DocumentVersion, DocumentNode } from '@legal-platform/types';
import { DocumentFolderTree } from '../DocumentFolderTree';
import { DocumentList } from '../DocumentList';
import { DocumentPreview } from '../DocumentPreview';

export interface DocumentsTabProps {
  folderTree: DocumentNode[];
  documents: Document[];
  documentVersions?: Record<string, DocumentVersion[]>; // Keyed by document ID
  onSelectFolder?: (folder: DocumentNode) => void;
  onSelectDocument?: (document: Document) => void;
  onNewDocument?: () => void;
  onOpenDocument?: (document: Document) => void;
  onDownloadDocument?: (document: Document) => void;
  onViewHistory?: (document: Document) => void;
  className?: string;
}

/**
 * DocumentsTab Component
 *
 * Three-column layout with folder tree, document list, and preview pane
 *
 * Memoized for performance optimization to prevent unnecessary re-renders
 * when parent component updates but props remain unchanged.
 */
function DocumentsTabComponent({
  folderTree,
  documents,
  documentVersions = {},
  onSelectFolder,
  onSelectDocument,
  onNewDocument,
  onOpenDocument,
  onDownloadDocument,
  onViewHistory,
  className,
}: DocumentsTabProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  const handleSelectFolder = (folder: DocumentNode) => {
    setSelectedFolderId(folder.id);
    onSelectFolder?.(folder);
  };

  const handleSelectDocument = (document: Document) => {
    setSelectedDocument(document);
    onSelectDocument?.(document);
  };

  const selectedDocumentVersions = selectedDocument
    ? documentVersions[selectedDocument.id] || []
    : [];

  return (
    <div className={clsx('flex h-full bg-gray-50', className)}>
      {/* Left Column: Folder Tree (25%) */}
      <div className="w-1/4 min-w-[200px] bg-white border-r border-gray-200 hidden lg:block">
        <DocumentFolderTree
          tree={folderTree}
          selectedNodeId={selectedFolderId}
          onSelectNode={handleSelectFolder}
        />
      </div>

      {/* Middle Column: Document List (40%) */}
      <div className="flex-1 lg:w-[40%] min-w-0">
        <DocumentList
          documents={documents}
          selectedDocumentId={selectedDocument?.id}
          onSelectDocument={handleSelectDocument}
          onNewDocument={onNewDocument}
        />
      </div>

      {/* Right Column: Document Preview (35%) */}
      <div className="w-[35%] min-w-[300px] hidden md:block">
        <DocumentPreview
          document={selectedDocument}
          versions={selectedDocumentVersions}
          onOpen={onOpenDocument}
          onDownload={onDownloadDocument}
          onViewHistory={onViewHistory}
        />
      </div>

      {/* Mobile: Show overlay for preview when document selected */}
      <div
        className={clsx(
          'fixed inset-0 z-50 bg-white md:hidden transition-transform',
          selectedDocument ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Previzualizare</h3>
          <button
            onClick={() => setSelectedDocument(null)}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Închide previzualizarea"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="h-[calc(100%-64px)]">
          <DocumentPreview
            document={selectedDocument}
            versions={selectedDocumentVersions}
            onOpen={onOpenDocument}
            onDownload={onDownloadDocument}
            onViewHistory={onViewHistory}
          />
        </div>
      </div>
    </div>
  );
}

// Memoized export for performance optimization
export const DocumentsTab = React.memo(DocumentsTabComponent);
DocumentsTab.displayName = 'DocumentsTab';
