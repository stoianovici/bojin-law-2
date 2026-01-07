'use client';

/**
 * DocumentsContentPanel Component
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 * OPS-133: Documents - Add Pagination / Load More UI
 * OPS-173: Documents Tab Separation UI ("Documente de lucru" | "Corespondență")
 * OPS-174: Supervisor Review Queue Tab ("De revizuit")
 * OPS-360: Linear-inspired UI with status toggle and period grouping
 *
 * Right panel showing documents in selected case/folder with grid/list view.
 * Integrates with OPS-087 preview modal for document preview.
 *
 * Uses paginated caseDocumentsGrid query for root-level documents (20 per page).
 * Folder-level documents use folder query (no pagination - folders typically smaller).
 */

import React, { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  FileText,
  Upload,
  FolderPlus,
  File,
  FileImage,
  FileSpreadsheet,
  FolderInput,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { CaseWithRelations } from '../../hooks/useCases';
import type { FolderTree, FolderInfo, CaseDocumentContext } from '../../hooks/useDocumentFolders';
import { useFolderContents } from '../../hooks/useDocumentFolders';
import { useDocumentFoldersStore } from '../../stores/document-folders.store';
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

// OPS-360: Linear-styled components
import { Breadcrumb } from '../linear/Breadcrumb';
import { StatusToggle } from '../linear/StatusToggle';
import { ViewToggle } from '../linear/ViewToggle';
import { SearchBox } from '../linear/SearchBox';
import { PeriodSection } from '../linear/CollapsibleSection';
import { DocumentCard as LinearDocumentCard, DocumentGrid } from '../linear/DocumentCard';

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

// OPS-360: Document status filter type
type DocumentStatusFilter = 'DRAFT' | 'IN_REVIEW' | 'FINAL';

// OPS-360: Period grouping keys
type PeriodGroupKey = 'thisWeek' | 'thisMonth' | string; // string for older months like "Noiembrie 2024"

interface PeriodGroup {
  key: PeriodGroupKey;
  title: string;
  documents: CaseDocumentContext[];
  defaultExpanded: boolean;
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

/**
 * OPS-360: Get file extension from filename or fileType
 */
function getFileExtension(fileName: string, fileType: string): string {
  // Try to get extension from fileName first
  const extFromName = fileName.split('.').pop()?.toLowerCase() || '';
  if (extFromName && extFromName.length <= 4) return extFromName;

  // Fallback to parsing fileType
  const type = fileType.toLowerCase();
  if (type.includes('pdf')) return 'pdf';
  if (type.includes('doc') || type.includes('word')) return 'docx';
  if (type.includes('sheet') || type.includes('excel')) return 'xlsx';
  if (type.includes('png')) return 'png';
  if (type.includes('jpg') || type.includes('jpeg')) return 'jpg';
  if (type.includes('image')) return 'img';

  return extFromName || 'file';
}

/**
 * OPS-360: Group documents by time period
 */
function groupDocumentsByPeriod(documents: CaseDocumentContext[]): PeriodGroup[] {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);

  const groups: Map<string, PeriodGroup> = new Map();

  // Romanian month names
  const monthNames = [
    'Ianuarie',
    'Februarie',
    'Martie',
    'Aprilie',
    'Mai',
    'Iunie',
    'Iulie',
    'August',
    'Septembrie',
    'Octombrie',
    'Noiembrie',
    'Decembrie',
  ];

  for (const doc of documents) {
    const date = new Date(doc.linkedAt);
    let key: string;
    let title: string;
    let defaultExpanded: boolean;

    if (date >= startOfWeek) {
      key = 'thisWeek';
      title = 'Această săptămână';
      defaultExpanded = true;
    } else if (date >= startOfMonth) {
      key = 'thisMonth';
      title = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      defaultExpanded = true;
    } else {
      // Older months
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      key = monthKey;
      title = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      defaultExpanded = false;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title,
        documents: [],
        defaultExpanded,
      });
    }
    groups.get(key)!.documents.push(doc);
  }

  // Sort groups: thisWeek first, then thisMonth, then by date descending
  const sortOrder = (key: string): number => {
    if (key === 'thisWeek') return 0;
    if (key === 'thisMonth') return 1;
    return 2;
  };

  return Array.from(groups.values()).sort((a, b) => {
    const orderA = sortOrder(a.key);
    const orderB = sortOrder(b.key);
    if (orderA !== orderB) return orderA - orderB;
    // For older months, sort by date descending
    return b.key.localeCompare(a.key);
  });
}

// ============================================================================
// Helper Components
// ============================================================================

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

/**
 * OPS-360: Linear-styled list item for documents (list view)
 */
function DocumentListItem({
  doc,
  onPreview,
  onAddToMapa,
  onOpenInWord,
}: {
  doc: CaseDocumentContext;
  onPreview: () => void;
  onAddToMapa: () => void;
  onOpenInWord?: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileType = doc.document.fileType;
  const isWord = isWordDocument(fileType);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-case-document-id', doc.id);
    e.dataTransfer.setData('text/plain', doc.document.fileName);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onPreview}
      className={cn(
        'flex items-center gap-4 px-4 py-3 border-b border-linear-border-subtle cursor-pointer transition-colors',
        'hover:bg-linear-bg-hover',
        isDragging && 'opacity-50 bg-linear-accent-muted'
      )}
    >
      {React.createElement(getFileIcon(fileType), {
        className: 'h-8 w-8 text-linear-text-muted flex-shrink-0',
      })}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-linear-text-primary truncate">
          {doc.document.fileName}
        </div>
        <div className="text-xs text-linear-text-tertiary">
          {formatFileSize(doc.document.fileSize)} • {formatDate(doc.linkedAt)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToMapa();
          }}
          className="p-1.5 rounded-md hover:bg-linear-bg-tertiary text-linear-text-tertiary hover:text-linear-text-primary transition-colors"
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
            className="p-1.5 rounded-md hover:bg-linear-bg-tertiary text-linear-text-tertiary hover:text-linear-accent transition-colors"
            title="Deschide în Word"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * OPS-360: Linear-styled empty state
 */
function EmptyState({
  hasFolders,
  onCreateFolder,
}: {
  hasFolders: boolean;
  onCreateFolder: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <FileText className="h-16 w-16 text-linear-text-muted mb-4" />
      <h3 className="text-lg font-medium text-linear-text-primary mb-2">Niciun document</h3>
      <p className="text-sm text-linear-text-secondary text-center mb-6 max-w-sm">
        {hasFolders
          ? 'Acest dosar nu conține documente. Încărcați documente sau selectați alt dosar.'
          : 'Nu există documente în acest dosar. Începeți prin a încărca un document.'}
      </p>
      <div className="flex gap-3">
        <button className="flex items-center gap-2 px-4 py-2 bg-linear-accent text-white rounded-lg hover:bg-linear-accent-hover transition-colors">
          <Upload className="h-4 w-4" />
          Încarcă document
        </button>
        <button
          onClick={onCreateFolder}
          className="flex items-center gap-2 px-4 py-2 border border-linear-border-default text-linear-text-secondary rounded-lg hover:bg-linear-bg-hover hover:text-linear-text-primary transition-colors"
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

// OPS-360: Source types for documents
const WORKING_DOC_SOURCE_TYPES: DocumentSourceType[] = ['UPLOAD', 'AI_GENERATED', 'TEMPLATE'];

export function DocumentsContentPanel({
  caseId,
  folderId,
  folderTree,
  cases,
  loading,
}: DocumentsContentPanelProps) {
  const { viewMode, setViewMode } = useDocumentFoldersStore();
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [mapaAssignDoc, setMapaAssignDoc] = useState<DocumentInfo | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // OPS-360: Status filter state (Ciornă, Review, Final)
  const [statusFilter, setStatusFilter] = useState<DocumentStatusFilter>('DRAFT');

  // OPS-360: Search filter state
  const [searchQuery, setSearchQuery] = useState('');

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

  // OPS-360: All documents use WORKING source types
  const sourceTypesFilter = WORKING_DOC_SOURCE_TYPES;

  // Include promoted attachments
  const includePromotedAttachments = true;

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
  const { hasMsalAccount, reconnectMicrosoft } = useAuth();

  // OPS-139: Get filtered preview actions for case-documents context
  const { actions: previewActions, userRole } = usePreviewActions({
    context: 'case-documents',
  });

  // Find current case
  const currentCase = useMemo(() => cases.find((c) => c.id === caseId), [cases, caseId]);

  // OPS-360: Map DocumentStatusFilter to DB status values for filtering
  const statusFilterValues = useMemo((): string[] => {
    switch (statusFilter) {
      case 'DRAFT':
        return ['DRAFT'];
      case 'IN_REVIEW':
        return ['IN_REVIEW', 'CHANGES_REQUESTED'];
      case 'FINAL':
        return ['FINAL'];
      default:
        return ['DRAFT'];
    }
  }, [statusFilter]);

  // OPS-133: Get documents to display - use paginated grid for root, folder query for folders
  // OPS-360: Filter by status and search query
  const documents = useMemo((): CaseDocumentContext[] => {
    let docs: CaseDocumentContext[] = [];

    if (folderId && selectedFolder) {
      // Folder selected: use folder query (not paginated)
      docs = selectedFolder.documents ?? [];
    } else if (caseId && !folderId && gridDocuments.length > 0) {
      // Root level: use paginated grid documents, convert to CaseDocumentContext format
      docs = gridDocuments.map(
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

    // OPS-360: Filter by status
    docs = docs.filter((doc) => statusFilterValues.includes(doc.document.status ?? 'DRAFT'));

    // OPS-360: Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      docs = docs.filter((doc) => doc.document.fileName.toLowerCase().includes(query));
    }

    return docs;
  }, [folderId, selectedFolder, caseId, gridDocuments, statusFilterValues, searchQuery]);

  // OPS-360: Count documents by status (for badges)
  const statusCounts = useMemo(() => {
    let allDocs: CaseDocumentContext[] = [];

    if (folderId && selectedFolder) {
      allDocs = selectedFolder.documents ?? [];
    } else if (caseId && !folderId && gridDocuments.length > 0) {
      allDocs = gridDocuments.map(
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
            thumbnailUrl: undefined,
            downloadUrl: undefined,
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

    return {
      draft: allDocs.filter((d) => d.document.status === 'DRAFT').length,
      inReview: allDocs.filter((d) =>
        ['IN_REVIEW', 'CHANGES_REQUESTED'].includes(d.document.status ?? 'DRAFT')
      ).length,
      final: allDocs.filter((d) => d.document.status === 'FINAL').length,
    };
  }, [folderId, selectedFolder, caseId, gridDocuments]);

  // OPS-360: Group documents by period
  const documentGroups = useMemo(() => {
    return groupDocumentsByPeriod(documents);
  }, [documents]);

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

  // OPS-133: Loading state - grid loading for root, folder loading for folders
  const isLoading = loading || (folderId ? folderLoading : gridLoading);

  // OPS-360: Build breadcrumb items for Linear component
  // Must be called before early return to maintain hook order
  const breadcrumbItems = useMemo(() => {
    if (!currentCase) return [];

    const items = [{ label: currentCase.title, href: folderId ? '#' : undefined }];

    for (let i = 0; i < breadcrumbPath.length; i++) {
      const item = breadcrumbPath[i];
      const isLast = i === breadcrumbPath.length - 1;
      items.push({
        label: item.name,
        href: isLast ? undefined : '#',
      });
    }

    return items;
  }, [currentCase, breadcrumbPath, folderId]);

  // OPS-360: Status toggle options with counts
  const statusOptions = useMemo(
    () => [
      { value: 'DRAFT' as DocumentStatusFilter, label: 'Ciornă', count: statusCounts.draft },
      { value: 'IN_REVIEW' as DocumentStatusFilter, label: 'Review', count: statusCounts.inReview },
      { value: 'FINAL' as DocumentStatusFilter, label: 'Final', count: statusCounts.final },
    ],
    [statusCounts]
  );

  // OPS-360: View toggle options
  const viewOptions = useMemo(
    () => [
      { value: 'grid' as const, label: 'Vizualizare grilă', icon: 'grid' as const },
      { value: 'list' as const, label: 'Vizualizare listă', icon: 'list' as const },
    ],
    []
  );

  // No case selected - OPS-360: Linear styling
  if (!caseId || !currentCase) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-linear-bg-primary">
        <FileText className="h-16 w-16 text-linear-text-muted mb-4" />
        <h3 className="text-lg font-medium text-linear-text-primary mb-2">Selectați un dosar</h3>
        <p className="text-sm text-linear-text-secondary text-center">
          Alegeți un dosar din panoul din stânga pentru a vedea documentele.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-linear-bg-primary">
      {/* OPS-360: Linear-styled Header */}
      <div className="px-6 py-4 border-b border-linear-border-subtle bg-linear-bg-secondary">
        {/* Top row: Breadcrumb and actions */}
        <div className="flex items-center justify-between mb-4">
          {/* Breadcrumb */}
          <Breadcrumb items={breadcrumbItems} size="sm" />

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <SearchBox
              placeholder="Caută documente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[200px]"
              size="sm"
            />

            {/* View Toggle */}
            <ViewToggle options={viewOptions} value={viewMode} onChange={setViewMode} />

            {/* Upload Button */}
            <button className="flex items-center gap-2 px-3 py-2 bg-linear-accent text-white text-xs font-medium rounded-lg hover:bg-linear-accent-hover transition-colors">
              <Upload className="h-3.5 w-3.5" />
              Încarcă
            </button>
          </div>
        </div>

        {/* OPS-360: Status Toggle */}
        <div className="flex items-center justify-between">
          <StatusToggle
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            size="sm"
          />

          {/* Document count */}
          <div className="text-xs text-linear-text-tertiary">
            {documents.length} {documents.length === 1 ? 'document' : 'documente'}
            {hasMore && ` din ${totalCount}`}
          </div>
        </div>
      </div>

      {/* OPS-360: Content with Linear styling */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center bg-linear-bg-primary">
          <Loader2 className="h-6 w-6 animate-spin text-linear-text-tertiary" />
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          hasFolders={(folderTree?.folders.length ?? 0) > 0}
          onCreateFolder={() => setCreateFolderOpen(true)}
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* OPS-360: Period-grouped documents */}
          {viewMode === 'grid' ? (
            // Grid view with period sections
            <>
              {documentGroups.map((group) => (
                <PeriodSection
                  key={group.key}
                  title={group.title}
                  count={group.documents.length}
                  defaultExpanded={group.defaultExpanded}
                >
                  <DocumentGrid>
                    {group.documents.map((doc) => (
                      <LinearDocumentCard
                        key={doc.document.id}
                        name={doc.document.fileName}
                        fileType={getFileExtension(doc.document.fileName, doc.document.fileType)}
                        size={formatFileSize(doc.document.fileSize)}
                        thumbnail={
                          doc.document.thumbnailUrl ? (
                            <img
                              src={doc.document.thumbnailUrl}
                              alt={doc.document.fileName}
                              className="w-full h-full object-cover"
                            />
                          ) : undefined
                        }
                        onFolderClick={() => handleAddToMapa(doc)}
                        onWordClick={
                          isWordDocument(doc.document.fileType)
                            ? () => handleOpenInWord(doc)
                            : undefined
                        }
                        onClick={() => handlePreview(doc)}
                      />
                    ))}
                  </DocumentGrid>
                </PeriodSection>
              ))}
            </>
          ) : (
            // List view with period sections
            <>
              {documentGroups.map((group) => (
                <PeriodSection
                  key={group.key}
                  title={group.title}
                  count={group.documents.length}
                  defaultExpanded={group.defaultExpanded}
                >
                  <div className="rounded-lg border border-linear-border-subtle overflow-hidden bg-linear-bg-secondary">
                    {group.documents.map((doc) => (
                      <DocumentListItem
                        key={doc.document.id}
                        doc={doc}
                        onPreview={() => handlePreview(doc)}
                        onAddToMapa={() => handleAddToMapa(doc)}
                        onOpenInWord={() => handleOpenInWord(doc)}
                      />
                    ))}
                  </div>
                </PeriodSection>
              ))}
            </>
          )}

          {/* OPS-133: Load More button for pagination */}
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-2.5 text-xs font-medium rounded-lg transition-colors',
                  isLoadingMore
                    ? 'bg-linear-bg-tertiary text-linear-text-muted cursor-not-allowed'
                    : 'bg-linear-accent-muted text-linear-accent hover:bg-linear-accent/20'
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
                      <span className="text-linear-text-tertiary">({remainingCount} rămase)</span>
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
