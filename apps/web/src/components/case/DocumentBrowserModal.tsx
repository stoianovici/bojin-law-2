/**
 * DocumentBrowserModal - Modal for browsing and importing documents from other cases
 * Story 2.8.4: Cross-Case Document Linking
 *
 * Features:
 * - Documents grouped by source case
 * - Search and file type filtering
 * - Multi-select for batch importing
 * - Shows linked cases for each document
 */

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { useClientDocumentsGrouped, type ClientDocument, type DocumentsByCase } from '../../hooks/useClientDocuments';
import { useLinkDocuments } from '../../hooks/useDocumentActions';

export interface DocumentBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  caseId: string;
  caseName: string;
  onImportComplete?: () => void;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get file icon based on file type
 */
function FileIcon({ fileType }: { fileType: string }) {
  const type = fileType.toLowerCase();

  if (type.includes('pdf')) {
    return (
      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  }

  if (type.includes('doc') || type.includes('word')) {
    return (
      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  }

  if (type.includes('xls') || type.includes('excel')) {
    return (
      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  }

  return (
    <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Document row component
 */
function DocumentRow({
  document,
  isSelected,
  onToggle,
}: {
  document: ClientDocument;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const linkedCaseCount = document.linkedCases.length;
  const uploaderName = `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`;

  return (
    <tr
      onClick={onToggle}
      className={clsx(
        'cursor-pointer transition-colors border-b border-gray-100 last:border-0',
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      )}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <FileIcon fileType={document.fileType} />
          <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
            {document.fileName}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatFileSize(document.fileSize)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {uploaderName}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {format(new Date(document.uploadedAt), 'dd MMM yyyy')}
      </td>
      <td className="px-4 py-3">
        {linkedCaseCount > 0 && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            Linked to {linkedCaseCount} {linkedCaseCount === 1 ? 'case' : 'cases'}
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * Case group component
 */
function CaseGroup({
  group,
  selectedIds,
  onToggleDocument,
  onToggleAll,
  isExpanded,
  onToggleExpand,
}: {
  group: DocumentsByCase;
  selectedIds: Set<string>;
  onToggleDocument: (id: string) => void;
  onToggleAll: (ids: string[], select: boolean) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const allSelected = group.documents.length > 0 &&
    group.documents.every((d) => selectedIds.has(d.id));
  const someSelected = group.documents.some((d) => selectedIds.has(d.id));
  const documentIds = group.documents.map((d) => d.id);

  const caseName = group.case
    ? `${group.case.caseNumber}: ${group.case.title}`
    : 'Client Documents (No Case)';

  return (
    <div className="border border-gray-200 rounded-lg mb-3 overflow-hidden">
      {/* Group Header */}
      <div
        onClick={onToggleExpand}
        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected;
            }}
            onChange={() => onToggleAll(documentIds, !allSelected)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <svg
            className={clsx(
              'w-4 h-4 text-gray-500 transition-transform',
              isExpanded && 'transform rotate-90'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div>
            <span className="font-medium text-gray-900">{caseName}</span>
            <span className="ml-2 text-sm text-gray-500">
              ({group.documentCount} {group.documentCount === 1 ? 'document' : 'documents'})
            </span>
          </div>
        </div>
        {group.case?.status && (
          <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">
            {group.case.status}
          </span>
        )}
      </div>

      {/* Documents Table */}
      {isExpanded && (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-t border-gray-200">
            <tr>
              <th className="px-4 py-2 w-10"></th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                File Name
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Size
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Uploaded By
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Linked
              </th>
            </tr>
          </thead>
          <tbody>
            {group.documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                isSelected={selectedIds.has(doc.id)}
                onToggle={() => onToggleDocument(doc.id)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * DocumentBrowserModal Component
 */
export function DocumentBrowserModal({
  isOpen,
  onClose,
  clientId,
  caseId,
  caseName,
  onImportComplete,
}: DocumentBrowserModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  // Fetch documents grouped by case, excluding current case
  const { documentsByCase, loading, error, refetch } = useClientDocumentsGrouped(
    clientId,
    caseId,
    searchQuery || undefined
  );

  // Link documents mutation
  const { linkDocuments, loading: linkLoading } = useLinkDocuments();

  // Filter groups based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return documentsByCase;

    const query = searchQuery.toLowerCase();
    return documentsByCase
      .map((group) => ({
        ...group,
        documents: group.documents.filter((doc) =>
          doc.fileName.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.documents.length > 0);
  }, [documentsByCase, searchQuery]);

  // Total available documents
  const totalDocuments = filteredGroups.reduce((sum, g) => sum + g.documents.length, 0);

  // Toggle document selection
  const toggleDocument = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Toggle all documents in a group
  const toggleAll = useCallback((ids: string[], select: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (select) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  }, []);

  // Toggle group expansion
  const toggleExpand = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Handle import
  const handleImport = async () => {
    if (selectedIds.size === 0) return;

    setIsImporting(true);
    try {
      await linkDocuments({
        caseId,
        documentIds: Array.from(selectedIds),
      });
      setSelectedIds(new Set());
      onImportComplete?.();
      onClose();
    } catch (err) {
      console.error('Failed to import documents:', err);
      // Error will be displayed via the hook's error state
    } finally {
      setIsImporting(false);
    }
  };

  // Clear selection and close
  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchQuery('');
    onClose();
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setSearchQuery('');
      setExpandedGroups(new Set());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Import Documents
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Select documents to import into <span className="font-medium">{caseName}</span>
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="px-6 py-3 border-b border-gray-200">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents by filename..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
              <span>
                {totalDocuments} {totalDocuments === 1 ? 'document' : 'documents'} available
              </span>
              <span>
                {selectedIds.size} selected
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-red-600">
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="font-medium">Failed to load documents</p>
                <button
                  onClick={() => refetch()}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="font-medium">
                  {searchQuery ? 'No documents match your search' : 'No documents available to import'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-sm text-blue-600 hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              filteredGroups.map((group) => {
                const groupId = group.case?.id || 'no-case';
                return (
                  <CaseGroup
                    key={groupId}
                    group={group}
                    selectedIds={selectedIds}
                    onToggleDocument={toggleDocument}
                    onToggleAll={toggleAll}
                    isExpanded={expandedGroups.has(groupId)}
                    onToggleExpand={() => toggleExpand(groupId)}
                  />
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || isImporting || linkLoading}
              className={clsx(
                'px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
                selectedIds.size === 0 || isImporting || linkLoading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              {isImporting || linkLoading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Importing...
                </span>
              ) : (
                `Import ${selectedIds.size} ${selectedIds.size === 1 ? 'Document' : 'Documents'}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

DocumentBrowserModal.displayName = 'DocumentBrowserModal';
