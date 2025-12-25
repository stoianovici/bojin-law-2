'use client';

/**
 * DocumentsContentPanel Component
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 * OPS-133: Documents - Add Pagination / Load More UI
 * OPS-173: Documents Tab Separation UI ("Documente de lucru" | "Corespondență")
 * OPS-174: Supervisor Review Queue Tab ("De revizuit")
 *
 * Right panel showing documents in selected case/folder with grid/list view.
 * Integrates with OPS-087 preview modal for document preview.
 *
 * Uses paginated caseDocumentsGrid query for root-level documents (20 per page).
 * Folder-level documents use folder query (no pagination - folders typically smaller).
 */

import React, { useMemo, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  FileText,
  FileEdit,
  Mail,
  Grid,
  List,
  Upload,
  FolderPlus,
  ChevronRight,
  Home,
  File,
  FileImage,
  FileSpreadsheet,
  FolderInput,
  Loader2,
  ExternalLink,
  Clock,
  ClipboardCheck,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CaseWithRelations } from '../../hooks/useCases';
import type { FolderTree, FolderInfo, CaseDocumentContext } from '../../hooks/useDocumentFolders';
import { useFolderContents } from '../../hooks/useDocumentFolders';
import { useDocumentFoldersStore, type DocumentTab } from '../../stores/document-folders.store';
import { useDocumentPreview } from '../../hooks/useDocumentPreview';
import { DocumentPreviewModal, type PreviewableDocument } from '../preview';
import { CreateFolderModal } from './CreateFolderModal';
import { AssignToMapaModal, type DocumentInfo } from '../mapa/AssignToMapaModal';
import { DeleteDocumentDialog } from './DeleteDocumentDialog';
import { RenameDocumentDialog } from './RenameDocumentDialog';
import { MoveDocumentDialog } from './MoveDocumentDialog';
import { LinkToCaseDialog } from './LinkToCaseDialog';
import { DocumentVersionDrawer } from './DocumentVersionDrawer';
import { SubmitForReviewModal } from './SubmitForReviewModal';
import { ReviewActionsModal, type ReviewDocument } from './ReviewActionsModal';
import { useAuth } from '../../contexts/AuthContext';
import {
  useDocumentGrid,
  type DocumentGridItem,
  type DocumentSourceType,
} from '../../hooks/useDocumentGrid';
import { usePreviewActions } from '../../hooks/usePreviewActions';
import {
  useDocumentsForReviewCount,
  type DocumentForReview,
} from '../../hooks/useDocumentsForReview';
import { ReviewQueueList } from './ReviewQueueList';

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

/**
 * OPS-163: Helper to check if file is a Word document
 */
function isWordDocument(fileType: string): boolean {
  const type = fileType.toLowerCase();
  return (
    type.includes('doc') ||
    type.includes('word') ||
    type.includes('application/vnd.openxmlformats-officedocument.wordprocessingml')
  );
}

function DocumentCard({
  doc,
  viewMode,
  onPreview,
  onAddToMapa,
  onOpenInWord,
  onViewVersions,
}: {
  doc: CaseDocumentContext;
  viewMode: 'grid' | 'list';
  onPreview: () => void;
  onAddToMapa: () => void;
  onOpenInWord?: () => void;
  // OPS-176: Handler for viewing version history
  onViewVersions?: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  // Get file type for icon selection and conditional actions
  const fileType = doc.document.fileType;
  const isWord = isWordDocument(fileType);
  const hasMultipleVersions = (doc.document.versionCount ?? 0) > 1;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-case-document-id', doc.id);
    e.dataTransfer.setData('text/plain', doc.document.fileName);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // OPS-163: Click anywhere on card/row opens preview
  if (viewMode === 'list') {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={onPreview}
        className={clsx(
          'flex items-center gap-4 px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors',
          'hover:bg-gray-50',
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
        {/* OPS-163/OPS-176: File-type specific actions and version badge */}
        <div className="flex items-center gap-2">
          {/* OPS-176: Version badge */}
          {hasMultipleVersions && onViewVersions && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewVersions();
              }}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="Vezi istoricul versiunilor"
            >
              <Clock className="h-3.5 w-3.5" />v{doc.document.versionCount}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToMapa();
            }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-purple-600"
            title="Adaugă în mapă"
          >
            <FolderInput className="h-4 w-4" />
          </button>
          {isWord && onOpenInWord && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenInWord();
              }}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-blue-600"
              title="Deschide în Word"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Grid view - OPS-163: Click anywhere opens preview
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onPreview}
      className={clsx(
        'flex flex-col p-4 rounded-lg border cursor-pointer transition-all',
        'border-gray-200 hover:border-gray-300 hover:shadow-sm',
        isDragging && 'opacity-50 ring-2 ring-blue-300'
      )}
    >
      {/* Thumbnail or Icon - compact height when no thumbnail */}
      <div
        className={clsx(
          'bg-gray-100 rounded-md flex items-center justify-center mb-3 relative',
          doc.document.thumbnailUrl ? 'aspect-[4/3]' : 'h-16'
        )}
      >
        {doc.document.thumbnailUrl ? (
          <img
            src={doc.document.thumbnailUrl}
            alt={doc.document.fileName}
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          React.createElement(getFileIcon(fileType), { className: 'h-8 w-8 text-gray-400' })
        )}
        {/* OPS-176: Version badge overlay */}
        {hasMultipleVersions && onViewVersions && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewVersions();
            }}
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-white/90 text-gray-600 shadow-sm hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Vezi istoricul versiunilor"
          >
            <Clock className="h-3 w-3" />v{doc.document.versionCount}
          </button>
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

      {/* OPS-163: File-type specific actions */}
      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToMapa();
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
          title="Adaugă în mapă"
        >
          <FolderInput className="h-3.5 w-3.5" />
          Mapă
        </button>
        {isWord && onOpenInWord && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenInWord();
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Deschide în Word"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Word
          </button>
        )}
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

// OPS-162: Type for document being acted upon
interface ActionDocument {
  id: string; // Document ID
  caseDocumentId: string; // CaseDocument join table ID (for move)
  name: string;
  folderId: string | null;
}

// OPS-173: Source types for each tab
const WORKING_DOC_SOURCE_TYPES: DocumentSourceType[] = ['UPLOAD', 'AI_GENERATED', 'TEMPLATE'];
const CORRESPONDENCE_SOURCE_TYPES: DocumentSourceType[] = ['EMAIL_ATTACHMENT'];

export function DocumentsContentPanel({
  caseId,
  folderId,
  folderTree,
  cases,
  loading,
}: DocumentsContentPanelProps) {
  const { viewMode, setViewMode, activeTab, setActiveTab } = useDocumentFoldersStore();
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [mapaAssignDoc, setMapaAssignDoc] = useState<DocumentInfo | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // OPS-162: Dialog states for secondary actions
  const [deleteDoc, setDeleteDoc] = useState<ActionDocument | null>(null);
  const [renameDoc, setRenameDoc] = useState<ActionDocument | null>(null);
  const [moveDoc, setMoveDoc] = useState<ActionDocument | null>(null);
  const [linkDoc, setLinkDoc] = useState<ActionDocument | null>(null);

  // OPS-176: Version drawer state
  const [versionDrawerDoc, setVersionDrawerDoc] = useState<{ id: string; name: string } | null>(
    null
  );

  // OPS-177: Review workflow modal states
  const [submitForReviewDoc, setSubmitForReviewDoc] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [reviewDoc, setReviewDoc] = useState<ReviewDocument | null>(null);

  // Get folder contents if a folder is selected
  const { folder: selectedFolder, loading: folderLoading } = useFolderContents(folderId);

  // OPS-173: Compute source types filter based on active tab
  const sourceTypesFilter = useMemo(() => {
    return activeTab === 'working' ? WORKING_DOC_SOURCE_TYPES : CORRESPONDENCE_SOURCE_TYPES;
  }, [activeTab]);

  // OPS-173: For working tab, include promoted attachments
  const includePromotedAttachments = activeTab === 'working';

  // OPS-133: Use paginated document grid for root-level documents
  // OPS-173: Pass sourceTypes filter for tab separation
  // Only fetch when no folder is selected (root level)
  const {
    documents: gridDocuments,
    loading: gridLoading,
    totalCount: gridTotalCount,
    hasMore: gridHasMore,
    loadMore: gridLoadMore,
    refetch: refetchGrid, // OPS-183: Refetch for version sync
  } = useDocumentGrid(caseId && !folderId ? caseId : '', {
    first: 20,
    sourceTypes: sourceTypesFilter,
    includePromotedAttachments,
  });

  // OPS-183: Callback to refresh document grid when a new version is synced from SharePoint
  const handleVersionSynced = useCallback(() => {
    refetchGrid();
  }, [refetchGrid]);

  // Document preview hook (OPS-087, OPS-183)
  const {
    selectedDocument: previewDocument,
    isPreviewOpen,
    openPreview,
    closePreview,
    fetchPreviewUrl,
    fetchDownloadUrl,
    fetchTextContent,
    openInWord: openInWordMutation,
  } = useDocumentPreview({
    type: 'document',
    onVersionSynced: handleVersionSynced, // OPS-183: Refresh grid on sync
  });

  // OPS-109: Auth context for Microsoft account status
  // OPS-174: Also get user for role-based tab visibility
  const { hasMsalAccount, reconnectMicrosoft, user } = useAuth();

  // OPS-174: Check if user is a supervisor (can see review queue)
  const isSupervisor = user?.role === 'Partner' || user?.role === 'Associate';

  // OPS-174: Get count of documents pending review (for badge)
  const { count: reviewCount } = useDocumentsForReviewCount();

  // OPS-139: Get filtered preview actions for case-documents context
  const { actions: previewActions, userRole } = usePreviewActions({
    context: 'case-documents',
  });

  // Find current case
  const currentCase = useMemo(() => cases.find((c) => c.id === caseId), [cases, caseId]);

  // OPS-133: Get documents to display - use paginated grid for root, folder query for folders
  const documents = useMemo((): CaseDocumentContext[] => {
    if (folderId && selectedFolder) {
      // Folder selected: use folder query (not paginated)
      return selectedFolder.documents ?? [];
    }
    if (caseId && !folderId && gridDocuments.length > 0) {
      // Root level: use paginated grid documents, convert to CaseDocumentContext format
      return gridDocuments.map(
        (item: DocumentGridItem): CaseDocumentContext => ({
          id: item.id,
          document: {
            id: item.document.id,
            fileName: item.document.fileName,
            fileType: item.document.fileType,
            fileSize: item.document.fileSize,
            storagePath: item.document.storagePath,
            uploadedAt: item.document.uploadedAt,
            status: item.document.status,
            thumbnailUrl:
              item.document.thumbnailMedium ?? item.document.thumbnailSmall ?? undefined,
            downloadUrl: item.document.downloadUrl ?? undefined,
          },
          linkedBy: {
            id: item.linkedBy.id,
            firstName: item.linkedBy.firstName,
            lastName: item.linkedBy.lastName,
          },
          linkedAt: item.linkedAt,
          isOriginal: item.isOriginal,
        })
      );
    }
    return [];
  }, [folderId, selectedFolder, caseId, gridDocuments]);

  // OPS-133: Pagination state - only for root level
  const hasMore = !folderId && gridHasMore;
  const totalCount = !folderId ? gridTotalCount : (selectedFolder?.documentCount ?? 0);
  const remainingCount = totalCount - documents.length;

  // OPS-133: Load more handler with loading state
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      await gridLoadMore();
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, gridLoadMore]);

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
        // OPS-177: Include status for action toolbar filtering
        status: doc.document.status,
      };
      openPreview(previewable);
    },
    [openPreview]
  );

  /**
   * Open assign to mapa modal
   */
  const handleAddToMapa = useCallback((doc: CaseDocumentContext) => {
    setMapaAssignDoc({
      id: doc.id, // CaseDocument ID (join table), not Document ID
      fileName: doc.document.fileName,
      fileType: doc.document.fileType,
      fileSize: doc.document.fileSize,
    });
  }, []);

  /**
   * OPS-163/OPS-164: Open document in Word Online
   * Opens the SharePoint document directly in Word Online (browser-based).
   * This is more reliable than ms-word: protocol which requires Word desktop.
   */
  const handleOpenInWord = useCallback(
    async (doc: CaseDocumentContext) => {
      try {
        const result = await openInWordMutation(doc.document.id);
        if (!result) {
          alert('Nu s-a putut deschide documentul în Word. Verificați consola pentru detalii.');
          return;
        }

        const { webUrl } = result;

        // Open Word Online directly (works in any browser)
        if (webUrl) {
          window.open(webUrl, '_blank');
          return;
        }

        // URL not available
        alert(
          'Nu s-a putut obține URL-ul documentului. Documentul poate necesita re-sincronizare cu OneDrive.'
        );
      } catch (error) {
        console.error('Failed to open document in Word:', error);
        alert('Eroare la deschiderea documentului în Word. Verificați consola pentru detalii.');
      }
    },
    [openInWordMutation]
  );

  /**
   * OPS-139: Handle preview action toolbar clicks
   * OPS-162: Implement secondary action dialogs
   * Maps action IDs to specific handlers
   */
  const handlePreviewAction = useCallback(
    async (actionId: string, doc: PreviewableDocument) => {
      // Find the original CaseDocumentContext for this preview document
      const caseDoc = documents.find((d) => d.document.id === doc.id);

      // Helper to create action document from preview doc and case doc
      const createActionDoc = (): ActionDocument | null => {
        if (!caseDoc) return null;
        return {
          id: doc.id,
          caseDocumentId: caseDoc.id, // The CaseDocument join table ID
          name: doc.name,
          folderId: folderId, // Current folder context
        };
      };

      switch (actionId) {
        case 'add-to-mapa':
          if (caseDoc) {
            // Close preview first to avoid modal layering issues
            closePreview();
            handleAddToMapa(caseDoc);
          }
          break;

        case 'download':
          // Download is handled by the modal directly
          break;

        // OPS-164: Open document in Word desktop app
        case 'open-in-word':
          if (caseDoc) {
            closePreview();
            handleOpenInWord(caseDoc);
          }
          break;

        case 'rename': {
          const actionDoc = createActionDoc();
          if (actionDoc) {
            closePreview();
            setRenameDoc(actionDoc);
          }
          break;
        }

        case 'move': {
          const actionDoc = createActionDoc();
          if (actionDoc) {
            closePreview();
            setMoveDoc(actionDoc);
          }
          break;
        }

        case 'link-to-case': {
          const actionDoc = createActionDoc();
          if (actionDoc) {
            closePreview();
            setLinkDoc(actionDoc);
          }
          break;
        }

        case 'delete': {
          const actionDoc = createActionDoc();
          if (actionDoc) {
            closePreview();
            setDeleteDoc(actionDoc);
          }
          break;
        }

        // OPS-177: Review workflow actions
        case 'submit-for-review': {
          closePreview();
          setSubmitForReviewDoc({
            id: doc.id,
            name: doc.name,
          });
          break;
        }

        case 'review-document': {
          // Get document metadata for review modal
          const gridDoc = gridDocuments.find((d) => d.document.id === doc.id);
          closePreview();
          setReviewDoc({
            id: doc.id,
            fileName: doc.name,
            metadata: gridDoc?.document?.metadata as ReviewDocument['metadata'],
          });
          break;
        }

        case 'withdraw-from-review': {
          // TODO: Call withdraw mutation directly (simple confirmation)
          console.log('Withdraw from review:', doc.id);
          break;
        }

        default:
          console.warn('Unknown action:', actionId);
      }
    },
    [documents, handleAddToMapa, handleOpenInWord, closePreview, folderId, gridDocuments]
  );

  /**
   * OPS-174: Handle preview from review queue
   * Opens document preview modal for a document in the review queue
   */
  const handleReviewPreview = useCallback(
    (item: DocumentForReview) => {
      const previewable: PreviewableDocument = {
        id: item.document.id,
        name: item.document.fileName,
        contentType: item.document.fileType,
        size: item.document.fileSize,
        previewUrl: null,
        downloadUrl: null,
        // OPS-177: Include status for action toolbar filtering
        status: item.document.status,
      };
      openPreview(previewable);
    },
    [openPreview]
  );

  /**
   * OPS-174: Handle review action from review queue
   * For now, opens the document for preview - OPS-177 will implement actual review actions
   */
  const handleReviewAction = useCallback(
    (item: DocumentForReview) => {
      // For now, just open preview - OPS-177 will add approve/reject functionality
      handleReviewPreview(item);
    },
    [handleReviewPreview]
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

  // OPS-133: Loading state - grid loading for root, folder loading for folders
  const isLoading = loading || (folderId ? folderLoading : gridLoading);

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

        {/* OPS-173: Document separation tabs */}
        {/* OPS-174: Added supervisor review queue tab */}
        <div className="mb-3">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as DocumentTab)}
            className="w-full"
          >
            <TabsList
              className={clsx(
                'grid w-full',
                isSupervisor ? 'max-w-xl grid-cols-3' : 'max-w-md grid-cols-2'
              )}
            >
              <TabsTrigger value="working" className="flex items-center gap-2">
                <FileEdit className="h-4 w-4" />
                Documente de lucru
              </TabsTrigger>
              {/* OPS-174: Review queue tab - only visible to supervisors */}
              {isSupervisor && (
                <TabsTrigger value="review" className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  De revizuit
                  {reviewCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                      {reviewCount}
                    </span>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger value="correspondence" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Corespondență
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Current folder info - OPS-133: Show loaded/total count for root */}
        {/* OPS-174: Hide count when review tab is active */}
        {activeTab !== 'review' && (
          <div className="text-sm text-gray-500">
            {folderId && selectedFolder
              ? `${selectedFolder.documentCount} documente în "${selectedFolder.name}"`
              : totalCount > 0
                ? hasMore
                  ? `${documents.length} din ${totalCount} documente`
                  : `${totalCount} documente`
                : 'Niciun document'}
          </div>
        )}
      </div>

      {/* Content */}
      {/* OPS-174: Show review queue when review tab is active */}
      {activeTab === 'review' && isSupervisor ? (
        <div className="flex-1 overflow-y-auto p-6">
          <ReviewQueueList onPreview={handleReviewPreview} onReview={handleReviewAction} />
        </div>
      ) : isLoading ? (
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
          {/* OPS-163: Click anywhere on card opens preview, OPS-176: Version badge */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.document.id}
                  doc={doc}
                  viewMode="grid"
                  onPreview={() => handlePreview(doc)}
                  onAddToMapa={() => handleAddToMapa(doc)}
                  onOpenInWord={() => handleOpenInWord(doc)}
                  onViewVersions={() =>
                    setVersionDrawerDoc({
                      id: doc.document.id,
                      name: doc.document.fileName,
                    })
                  }
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
                  onPreview={() => handlePreview(doc)}
                  onAddToMapa={() => handleAddToMapa(doc)}
                  onOpenInWord={() => handleOpenInWord(doc)}
                  onViewVersions={() =>
                    setVersionDrawerDoc({
                      id: doc.document.id,
                      name: doc.document.fileName,
                    })
                  }
                />
              ))}
            </div>
          )}

          {/* OPS-133: Load More button for pagination */}
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className={clsx(
                  'inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg transition-colors',
                  isLoadingMore
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                )}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se încarcă...
                  </>
                ) : (
                  <>
                    Încarcă mai multe
                    {remainingCount > 0 && (
                      <span className="text-blue-400">({remainingCount} rămase)</span>
                    )}
                  </>
                )}
              </button>
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

      {/* Document Preview Modal (OPS-087, OPS-139) */}
      <DocumentPreviewModal
        isOpen={isPreviewOpen}
        onClose={closePreview}
        document={previewDocument}
        onRequestPreviewUrl={fetchPreviewUrl}
        onRequestDownloadUrl={fetchDownloadUrl}
        onRequestTextContent={fetchTextContent}
        hasMsalAccount={hasMsalAccount}
        onReconnectMicrosoft={reconnectMicrosoft}
        // OPS-139: Context-aware action toolbar
        context="case-documents"
        actions={previewActions}
        userRole={userRole ?? undefined}
        onAction={handlePreviewAction}
      />

      {/* Assign to Mapa Modal - always rendered so portal container is ready */}
      {caseId && (
        <AssignToMapaModal
          isOpen={!!mapaAssignDoc}
          onClose={() => setMapaAssignDoc(null)}
          caseId={caseId}
          document={mapaAssignDoc}
          onAssigned={() => {
            setMapaAssignDoc(null);
          }}
        />
      )}

      {/* OPS-162: Delete Document Dialog */}
      {deleteDoc && (
        <DeleteDocumentDialog
          documentId={deleteDoc.id}
          documentName={deleteDoc.name}
          open={!!deleteDoc}
          onOpenChange={(open) => !open && setDeleteDoc(null)}
          onSuccess={() => setDeleteDoc(null)}
        />
      )}

      {/* OPS-162: Rename Document Dialog */}
      {renameDoc && (
        <RenameDocumentDialog
          documentId={renameDoc.id}
          currentName={renameDoc.name}
          open={!!renameDoc}
          onOpenChange={(open) => !open && setRenameDoc(null)}
          onSuccess={() => setRenameDoc(null)}
        />
      )}

      {/* OPS-162: Move Document Dialog */}
      {moveDoc && (
        <MoveDocumentDialog
          caseDocumentId={moveDoc.caseDocumentId}
          documentName={moveDoc.name}
          currentFolderId={moveDoc.folderId}
          folderTree={folderTree}
          open={!!moveDoc}
          onOpenChange={(open) => !open && setMoveDoc(null)}
          onSuccess={() => setMoveDoc(null)}
        />
      )}

      {/* OPS-162: Link to Case Dialog */}
      {linkDoc && currentCase && (
        <LinkToCaseDialog
          documentId={linkDoc.id}
          documentName={linkDoc.name}
          currentCaseId={caseId!}
          clientId={currentCase.client.id}
          open={!!linkDoc}
          onOpenChange={(open) => !open && setLinkDoc(null)}
          onSuccess={() => setLinkDoc(null)}
        />
      )}

      {/* OPS-176: Document Version History Drawer */}
      <DocumentVersionDrawer
        documentId={versionDrawerDoc?.id ?? null}
        documentName={versionDrawerDoc?.name ?? ''}
        isOpen={!!versionDrawerDoc}
        onClose={() => setVersionDrawerDoc(null)}
      />

      {/* OPS-177: Submit for Review Modal */}
      {submitForReviewDoc && (
        <SubmitForReviewModal
          documentId={submitForReviewDoc.id}
          documentName={submitForReviewDoc.name}
          open={!!submitForReviewDoc}
          onOpenChange={(open) => !open && setSubmitForReviewDoc(null)}
          onSuccess={() => setSubmitForReviewDoc(null)}
        />
      )}

      {/* OPS-177: Review Actions Modal */}
      {reviewDoc && (
        <ReviewActionsModal
          document={reviewDoc}
          open={!!reviewDoc}
          onOpenChange={(open) => !open && setReviewDoc(null)}
          onSuccess={() => setReviewDoc(null)}
        />
      )}
    </div>
  );
}

DocumentsContentPanel.displayName = 'DocumentsContentPanel';
