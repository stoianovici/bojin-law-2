'use client';

/**
 * DocumentsSidebar Component
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 *
 * Left sidebar showing cases with expandable folder trees.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import {
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
  FolderPlus,
} from 'lucide-react';
import type { CaseWithRelations } from '../../hooks/useCases';
import type { FolderTree, FolderInfo } from '../../hooks/useDocumentFolders';
import { useDocumentFoldersStore } from '../../stores/document-folders.store';
import { useFolderActions } from '../../hooks/useFolderActions';
import { CreateFolderModal } from './CreateFolderModal';
import { RenameFolderModal } from './RenameFolderModal';
import { DeleteFolderDialog } from './DeleteFolderDialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';

// ============================================================================
// Types
// ============================================================================

interface DocumentsSidebarProps {
  cases: CaseWithRelations[];
  selectedCaseId: string | null;
  selectedFolderId: string | null;
  folderTree: FolderTree | undefined;
  loading: boolean;
  onCaseSelect: (caseId: string) => void;
  onFolderSelect: (caseId: string, folderId: string | null) => void;
}

// ============================================================================
// Helper Components
// ============================================================================

function FolderItem({
  folder,
  caseId,
  caseName,
  depth,
  selectedFolderId,
  onSelect,
}: {
  folder: FolderInfo;
  caseId: string;
  caseName: string;
  depth: number;
  selectedFolderId: string | null;
  onSelect: (caseId: string, folderId: string) => void;
}) {
  const { expandedFolders, toggleFolderExpanded } = useDocumentFoldersStore();
  const { moveDocumentToFolder } = useFolderActions();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createSubfolderOpen, setCreateSubfolderOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const isExpanded = expandedFolders[folder.id] ?? false;
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;

  const handleClick = () => {
    onSelect(caseId, folder.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFolderExpanded(folder.id);
  };

  // Drag-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-case-document-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const caseDocumentId = e.dataTransfer.getData('application/x-case-document-id');
    if (caseDocumentId) {
      try {
        await moveDocumentToFolder(caseDocumentId, folder.id);
      } catch (error) {
        console.error('Failed to move document:', error);
      }
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'group flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-md mx-1 transition-colors',
          isSelected ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100 text-gray-700',
          isDragOver && 'bg-blue-200 ring-2 ring-blue-400 ring-inset'
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Expand/Collapse Toggle */}
        <button
          onClick={handleToggle}
          className={clsx(
            'p-0.5 rounded hover:bg-gray-200 transition-colors',
            !hasChildren && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Folder Icon */}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
        )}

        {/* Folder Name */}
        <span className="text-sm truncate flex-1">{folder.name}</span>

        {/* Document Count */}
        {folder.documentCount > 0 && (
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {folder.documentCount}
          </span>
        )}

        {/* Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-all"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setCreateSubfolderOpen(true);
              }}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Subdosar nou
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setRenameOpen(true);
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Redenumește
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setDeleteOpen(true);
              }}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Șterge
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              caseId={caseId}
              caseName={caseName}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {/* Rename Modal */}
      <RenameFolderModal
        folderId={folder.id}
        currentName={folder.name}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />

      {/* Delete Dialog */}
      <DeleteFolderDialog
        folderId={folder.id}
        folderName={folder.name}
        documentCount={folder.documentCount}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />

      {/* Create Subfolder Modal */}
      <CreateFolderModal
        caseId={caseId}
        caseName={caseName}
        parentFolderId={folder.id}
        open={createSubfolderOpen}
        onOpenChange={setCreateSubfolderOpen}
      />
    </div>
  );
}

function CaseItem({
  caseData,
  isSelected,
  selectedFolderId,
  folderTree,
  onCaseSelect,
  onFolderSelect,
}: {
  caseData: CaseWithRelations;
  isSelected: boolean;
  selectedFolderId: string | null;
  folderTree: FolderTree | undefined;
  onCaseSelect: (caseId: string) => void;
  onFolderSelect: (caseId: string, folderId: string | null) => void;
}) {
  const { expandedCases, toggleCaseExpanded } = useDocumentFoldersStore();
  const { moveDocumentToFolder } = useFolderActions();
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [isRootDragOver, setIsRootDragOver] = useState(false);
  const isExpanded = expandedCases[caseData.id] ?? isSelected;

  const handleCaseClick = () => {
    onCaseSelect(caseData.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleCaseExpanded(caseData.id);
  };

  const handleRootClick = () => {
    onFolderSelect(caseData.id, null);
  };

  // Drag-drop handlers for root folder
  const handleRootDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-case-document-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsRootDragOver(true);
    }
  };

  const handleRootDragLeave = () => {
    setIsRootDragOver(false);
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsRootDragOver(false);

    const caseDocumentId = e.dataTransfer.getData('application/x-case-document-id');
    if (caseDocumentId) {
      try {
        // Move to root (no folder)
        await moveDocumentToFolder(caseDocumentId, null);
      } catch (error) {
        console.error('Failed to move document to root:', error);
      }
    }
  };

  // Count total documents for this case
  const totalDocs = isSelected && folderTree ? folderTree.totalDocuments : 0;

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      {/* Case Header */}
      <div
        onClick={handleCaseClick}
        className={clsx(
          'flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors',
          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
        )}
      >
        <button onClick={handleToggle} className="p-0.5 rounded hover:bg-gray-200">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">{caseData.title}</span>
          </div>
          <div className="text-xs text-gray-500">{caseData.caseNumber}</div>
        </div>

        {totalDocs > 0 && (
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {totalDocs}
          </span>
        )}

        {/* Add Folder Button */}
        {isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCreateFolderOpen(true);
            }}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
            title="Dosar nou"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && isSelected && folderTree && (
        <div className="pb-2">
          {/* Root Level (all documents) */}
          <div
            onClick={handleRootClick}
            onDragOver={handleRootDragOver}
            onDragLeave={handleRootDragLeave}
            onDrop={handleRootDrop}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 mx-1 cursor-pointer rounded-md transition-colors',
              selectedFolderId === null
                ? 'bg-blue-100 text-blue-900'
                : 'hover:bg-gray-100 text-gray-700',
              isRootDragOver && 'bg-blue-200 ring-2 ring-blue-400 ring-inset'
            )}
            style={{ paddingLeft: '24px' }}
          >
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="text-sm">Toate documentele</span>
            {folderTree.totalDocuments > 0 && (
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded ml-auto">
                {folderTree.totalDocuments}
              </span>
            )}
          </div>

          {/* Folder Tree */}
          {folderTree.folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              caseId={caseData.id}
              caseName={caseData.title}
              depth={1}
              selectedFolderId={selectedFolderId}
              onSelect={onFolderSelect}
            />
          ))}
        </div>
      )}

      {/* Create Folder Modal */}
      <CreateFolderModal
        caseId={caseData.id}
        caseName={caseData.title}
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentsSidebar({
  cases,
  selectedCaseId,
  selectedFolderId,
  folderTree,
  loading,
  onCaseSelect,
  onFolderSelect,
}: DocumentsSidebarProps) {
  if (loading && cases.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-gray-500">Se încarcă...</div>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Folder className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500 text-center">Nu există dosare</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Section Header */}
      <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Folder className="h-4 w-4 text-gray-500" />
          DOSARE
        </div>
      </div>

      {/* Cases List */}
      <div>
        {cases.map((caseData) => (
          <CaseItem
            key={caseData.id}
            caseData={caseData}
            isSelected={selectedCaseId === caseData.id}
            selectedFolderId={selectedCaseId === caseData.id ? selectedFolderId : null}
            folderTree={selectedCaseId === caseData.id ? folderTree : undefined}
            onCaseSelect={onCaseSelect}
            onFolderSelect={onFolderSelect}
          />
        ))}
      </div>
    </div>
  );
}

DocumentsSidebar.displayName = 'DocumentsSidebar';
