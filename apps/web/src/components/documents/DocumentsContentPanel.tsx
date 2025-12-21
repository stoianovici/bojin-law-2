'use client';

/**
 * DocumentsContentPanel Component
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 *
 * Right panel showing documents in selected case/folder with grid/list view.
 * Integrates with OPS-087 preview modal for document preview.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  FileText,
  Grid,
  List,
  Upload,
  FolderPlus,
  ChevronRight,
  Home,
  Download,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
} from 'lucide-react';
import type { CaseWithRelations } from '../../hooks/useCases';
import type { FolderTree, FolderInfo, CaseDocumentContext } from '../../hooks/useDocumentFolders';
import { useFolderContents } from '../../hooks/useDocumentFolders';
import { useDocumentFoldersStore } from '../../stores/document-folders.store';
import { useDocumentPreview } from '../../hooks/useDocumentPreview';
import { DocumentPreviewModal, type PreviewableDocument } from '../preview';
import { CreateFolderModal } from './CreateFolderModal';

// ============================================================================
// Types
// ============================================================================

interface DocumentsContentPanelProps {
  caseId: string | null;
  folderId: string | null;
  folderTree: FolderTree | undefined;
  cases: CaseWithRelations[];
  loading: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getFileIcon(fileType: string) {
  const type = fileType.toLowerCase();
  if (type.includes('pdf')) return FileText;
  if (
    type.includes('image') ||
    type.includes('png') ||
    type.includes('jpg') ||
    type.includes('jpeg')
  )
    return FileImage;
  if (type.includes('sheet') || type.includes('xlsx') || type.includes('xls'))
    return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ============================================================================
// Helper Components
// ============================================================================

function Breadcrumb({
  caseTitle,
  folderPath,
  onNavigate,
}: {
  caseTitle: string;
  folderPath: { id: string | null; name: string }[];
  onNavigate: (folderId: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-sm text-gray-600 overflow-x-auto">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 hover:text-gray-900 transition-colors whitespace-nowrap"
      >
        <Home className="h-4 w-4" />
        <span>{caseTitle}</span>
      </button>
      {folderPath.map((item, index) => (
        <div key={item.id ?? 'root'} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <button
            onClick={() => onNavigate(item.id)}
            className={clsx(
              'hover:text-gray-900 transition-colors whitespace-nowrap',
              index === folderPath.length - 1 && 'font-medium text-gray-900'
            )}
          >
            {item.name}
          </button>
        </div>
      ))}
    </div>
  );
}

function DocumentCard({
  doc,
  viewMode,
  isSelected,
  onSelect,
  onPreview,
}: {
  doc: CaseDocumentContext;
  viewMode: 'grid' | 'list';
  isSelected: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  // Get file type for icon selection
  const fileType = doc.document.fileType;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-case-document-id', doc.id);
    e.dataTransfer.setData('text/plain', doc.document.fileName);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  if (viewMode === 'list') {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={onSelect}
        className={clsx(
          'flex items-center gap-4 px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors',
          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50',
          isDragging && 'opacity-50 bg-blue-100'
        )}
      >
        {React.createElement(getFileIcon(fileType), {
          className: 'h-8 w-8 text-gray-400 flex-shrink-0',
        })}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{doc.document.fileName}</div>
          <div className="text-xs text-gray-500">
            {formatFileSize(doc.document.fileSize)} • {formatDate(doc.linkedAt)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
            title="Previzualizare"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
            title="Descarcă"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onSelect}
      className={clsx(
        'flex flex-col p-4 rounded-lg border cursor-pointer transition-all',
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm',
        isDragging && 'opacity-50 ring-2 ring-blue-300'
      )}
    >
      {/* Thumbnail or Icon */}
      <div className="aspect-[4/3] bg-gray-100 rounded-md flex items-center justify-center mb-3">
        {doc.document.thumbnailUrl ? (
          <img
            src={doc.document.thumbnailUrl}
            alt={doc.document.fileName}
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          React.createElement(getFileIcon(fileType), { className: 'h-12 w-12 text-gray-400' })
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate" title={doc.document.fileName}>
          {doc.document.fileName}
        </div>
        <div className="text-xs text-gray-500 mt-1">{formatFileSize(doc.document.fileSize)}</div>
        <div className="text-xs text-gray-400 mt-0.5">{formatDate(doc.linkedAt)}</div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          Previzualizare
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  hasFolders,
  onCreateFolder,
}: {
  hasFolders: boolean;
  onCreateFolder: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <FileText className="h-16 w-16 text-gray-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Niciun document</h3>
      <p className="text-sm text-gray-500 text-center mb-6 max-w-sm">
        {hasFolders
          ? 'Acest dosar nu conține documente. Încărcați documente sau selectați alt dosar.'
          : 'Nu există documente în acest dosar. Începeți prin a încărca un document.'}
      </p>
      <div className="flex gap-3">
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Upload className="h-4 w-4" />
          Încarcă document
        </button>
        <button
          onClick={onCreateFolder}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <FolderPlus className="h-4 w-4" />
          Dosar nou
        </button>
      </div>
    </div>
  );
}

export function DocumentsContentPanel({
  caseId,
  folderId,
  folderTree,
  cases,
  loading,
}: DocumentsContentPanelProps) {
  const { viewMode, setViewMode, selectedDocumentId, setSelectedDocument } =
    useDocumentFoldersStore();
  const [createFolderOpen, setCreateFolderOpen] = useState(false);

  // Get folder contents if a folder is selected
  const { folder: selectedFolder, loading: folderLoading } = useFolderContents(folderId);

  // Document preview hook (OPS-087)
  const {
    selectedDocument: previewDocument,
    isPreviewOpen,
    openPreview,
    closePreview,
    fetchPreviewUrl,
  } = useDocumentPreview({ type: 'document' });

  // Find current case
  const currentCase = useMemo(() => cases.find((c) => c.id === caseId), [cases, caseId]);

  // Get documents to display
  const documents = useMemo(() => {
    if (folderId && selectedFolder) {
      return selectedFolder.documents ?? [];
    }
    if (folderTree) {
      return folderTree.rootDocuments;
    }
    return [];
  }, [folderId, selectedFolder, folderTree]);

  // Build breadcrumb path
  const breadcrumbPath = useMemo(() => {
    if (!folderId || !folderTree) return [];

    const findPath = (folders: FolderInfo[], targetId: string): FolderInfo[] | null => {
      for (const folder of folders) {
        if (folder.id === targetId) {
          return [folder];
        }
        if (folder.children) {
          const childPath = findPath(folder.children, targetId);
          if (childPath) {
            return [folder, ...childPath];
          }
        }
      }
      return null;
    };

    const path = findPath(folderTree.folders, folderId);
    return path?.map((f) => ({ id: f.id, name: f.name })) ?? [];
  }, [folderId, folderTree]);

  const handleNavigate = (targetFolderId: string | null) => {
    useDocumentFoldersStore.getState().setSelectedFolder(targetFolderId);
  };

  /**
   * Open document preview modal
   * Converts CaseDocumentContext to PreviewableDocument format
   */
  const handlePreview = useCallback(
    (doc: CaseDocumentContext) => {
      const previewable: PreviewableDocument = {
        id: doc.document.id,
        name: doc.document.fileName,
        contentType: doc.document.fileType,
        size: doc.document.fileSize,
        previewUrl: null, // Will be fetched on demand
        downloadUrl: doc.document.downloadUrl ?? null,
      };
      openPreview(previewable);
    },
    [openPreview]
  );

  // No case selected
  if (!caseId || !currentCase) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <FileText className="h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Selectați un dosar</h3>
        <p className="text-sm text-gray-500 text-center">
          Alegeți un dosar din panoul din stânga pentru a vedea documentele.
        </p>
      </div>
    );
  }

  const isLoading = loading || folderLoading;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          {/* Breadcrumb */}
          <Breadcrumb
            caseTitle={currentCase.title}
            folderPath={breadcrumbPath}
            onNavigate={handleNavigate}
          />

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={clsx(
                  'p-2 transition-colors',
                  viewMode === 'grid'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
                title="Vizualizare grilă"
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  'p-2 transition-colors',
                  viewMode === 'list'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
                title="Vizualizare listă"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Upload Button */}
            <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
              <Upload className="h-4 w-4" />
              Încarcă
            </button>
          </div>
        </div>

        {/* Current folder info */}
        <div className="text-sm text-gray-500">
          {folderId && selectedFolder
            ? `${selectedFolder.documentCount} documente în "${selectedFolder.name}"`
            : `${folderTree?.totalDocuments ?? 0} documente`}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-gray-500">Se încarcă...</div>
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          hasFolders={(folderTree?.folders.length ?? 0) > 0}
          onCreateFolder={() => setCreateFolderOpen(true)}
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.document.id}
                  doc={doc}
                  viewMode="grid"
                  isSelected={selectedDocumentId === doc.document.id}
                  onSelect={() => setSelectedDocument(doc.document.id)}
                  onPreview={() => handlePreview(doc)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.document.id}
                  doc={doc}
                  viewMode="list"
                  isSelected={selectedDocumentId === doc.document.id}
                  onSelect={() => setSelectedDocument(doc.document.id)}
                  onPreview={() => handlePreview(doc)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Folder Modal */}
      {caseId && currentCase && (
        <CreateFolderModal
          caseId={caseId}
          caseName={currentCase.title}
          parentFolderId={folderId}
          open={createFolderOpen}
          onOpenChange={setCreateFolderOpen}
        />
      )}

      {/* Document Preview Modal (OPS-087) */}
      <DocumentPreviewModal
        isOpen={isPreviewOpen}
        onClose={closePreview}
        document={previewDocument}
        onRequestPreviewUrl={fetchPreviewUrl}
      />
    </div>
  );
}

DocumentsContentPanel.displayName = 'DocumentsContentPanel';
