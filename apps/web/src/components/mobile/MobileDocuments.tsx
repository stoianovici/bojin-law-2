/**
 * MobileDocuments Component
 * OPS-328: Mobile Page Consistency
 *
 * Mobile-optimized documents browser with:
 * - Case list as entry point (tap to see documents)
 * - Full-screen document list when case selected
 * - Touch-friendly document items
 * - Back navigation between views
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Folder,
  File,
  FileImage,
  FileSpreadsheet,
  Download,
  Clock,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { MobileDrawer } from './MobileDrawer';
import { MobileHeader } from './MobileHeader';
import { useCases, type CaseWithRelations } from '../../hooks/useCases';
import { useCaseDocuments, type CaseDocumentWithContext } from '../../hooks/useCaseDocuments';
import { useSetAIContext } from '../../contexts/AIAssistantContext';
import { usePullToRefresh, type PullState } from '../../hooks/usePullToRefresh';

// File type icons
function getFileIcon(fileType: string) {
  const type = fileType.toLowerCase();
  if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg')) {
    return FileImage;
  }
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) {
    return FileSpreadsheet;
  }
  if (type.includes('pdf')) {
    return FileText;
  }
  return File;
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MobileDocuments() {
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseWithRelations | null>(null);

  // Set AI assistant context
  useSetAIContext('documents');

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const handleBack = useCallback(() => {
    setSelectedCase(null);
  }, []);

  const handleCaseSelect = useCallback((caseItem: CaseWithRelations) => {
    setSelectedCase(caseItem);
  }, []);

  // Render case selected view
  if (selectedCase) {
    return (
      <DocumentsListView
        caseItem={selectedCase}
        onBack={handleBack}
        onMenuClick={openDrawer}
        isDrawerOpen={isDrawerOpen}
        onCloseDrawer={closeDrawer}
      />
    );
  }

  // Render case selection view
  return (
    <CaseSelectionView
      onCaseSelect={handleCaseSelect}
      onMenuClick={openDrawer}
      isDrawerOpen={isDrawerOpen}
      onCloseDrawer={closeDrawer}
    />
  );
}

// ============================================================================
// CaseSelectionView - Select a case to view documents
// ============================================================================

interface CaseSelectionViewProps {
  onCaseSelect: (caseItem: CaseWithRelations) => void;
  onMenuClick: () => void;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
}

function CaseSelectionView({
  onCaseSelect,
  onMenuClick,
  isDrawerOpen,
  onCloseDrawer,
}: CaseSelectionViewProps) {
  // Only fetch active/pending cases that likely have documents
  const { cases, loading, error, refetch } = useCases({ status: 'Active' });

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const {
    state: pullState,
    pullDistance,
    progress,
    containerRef,
    containerProps,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: !loading,
  });

  // Error state
  if (error && cases.length === 0) {
    return (
      <div className="min-h-screen bg-linear-bg-primary flex flex-col">
        <MobileHeader title="Documente" onMenuClick={onMenuClick} />
        <MobileDrawer isOpen={isDrawerOpen} onClose={onCloseDrawer} />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-12 h-12 text-linear-error mb-4" />
          <p className="text-linear-text-secondary text-center mb-4">
            Nu am putut încărca dosarele
          </p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-linear-accent text-white rounded-lg active:scale-95 transition-transform"
          >
            <RefreshCw className="w-4 h-4" />
            Încearcă din nou
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-bg-primary flex flex-col">
      <MobileHeader title="Documente" onMenuClick={onMenuClick} />
      <MobileDrawer isOpen={isDrawerOpen} onClose={onCloseDrawer} />

      {/* Subtitle */}
      <div className="px-4 py-3 border-b border-linear-border-subtle">
        <p className="text-sm text-linear-text-secondary">
          Selectați un dosar pentru a vedea documentele
        </p>
      </div>

      {/* Cases List */}
      <main className="flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="h-full overflow-y-auto"
          {...containerProps}
        >
          {/* Pull-to-refresh indicator */}
          <PullIndicator state={pullState} pullDistance={pullDistance} progress={progress} />

          <div
            className="transition-transform duration-200"
            style={{
              transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
            }}
          >
            {/* Loading State */}
            {loading && cases.length === 0 && (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <CaseRowSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && cases.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 bg-linear-bg-tertiary rounded-full flex items-center justify-center mb-4">
                  <Folder className="w-8 h-8 text-linear-text-muted" />
                </div>
                <p className="text-linear-text-secondary text-center font-medium">
                  Niciun dosar activ
                </p>
                <p className="text-sm text-linear-text-muted text-center mt-1">
                  Documentele sunt organizate pe dosare
                </p>
              </div>
            )}

            {/* Cases List */}
            {cases.length > 0 && (
              <div className="p-4 space-y-2">
                {cases.map((caseItem) => (
                  <CaseRow
                    key={caseItem.id}
                    caseItem={caseItem}
                    onTap={() => onCaseSelect(caseItem)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// DocumentsListView - Show documents for selected case
// ============================================================================

interface DocumentsListViewProps {
  caseItem: CaseWithRelations;
  onBack: () => void;
  onMenuClick: () => void;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
}

function DocumentsListView({
  caseItem,
  onBack,
  onMenuClick,
  isDrawerOpen,
  onCloseDrawer,
}: DocumentsListViewProps) {
  const { documents, loading, error, refetch } = useCaseDocuments(caseItem.id);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const {
    state: pullState,
    pullDistance,
    progress,
    containerRef,
    containerProps,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: !loading,
  });

  // Error state
  if (error && documents.length === 0) {
    return (
      <div className="min-h-screen bg-linear-bg-primary flex flex-col">
        <MobileHeader
          title={caseItem.title}
          onMenuClick={onMenuClick}
          leftAction={
            <button onClick={onBack} className="p-2 -ml-2">
              <ChevronLeft className="w-5 h-5 text-linear-text-secondary" />
            </button>
          }
        />
        <MobileDrawer isOpen={isDrawerOpen} onClose={onCloseDrawer} />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-12 h-12 text-linear-error mb-4" />
          <p className="text-linear-text-secondary text-center mb-4">
            Nu am putut încărca documentele
          </p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-linear-accent text-white rounded-lg active:scale-95 transition-transform"
          >
            <RefreshCw className="w-4 h-4" />
            Încearcă din nou
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-bg-primary flex flex-col">
      <MobileHeader
        title="Documente"
        onMenuClick={onMenuClick}
        leftAction={
          <button onClick={onBack} className="p-2 -ml-2 active:scale-95 transition-transform">
            <ChevronLeft className="w-5 h-5 text-linear-text-secondary" />
          </button>
        }
      />
      <MobileDrawer isOpen={isDrawerOpen} onClose={onCloseDrawer} />

      {/* Case Info */}
      <div className="px-4 py-3 border-b border-linear-border-subtle">
        <p className="text-sm font-medium text-linear-text-primary truncate">
          {caseItem.title}
        </p>
        <p className="text-xs text-linear-text-muted mt-0.5">
          {caseItem.caseNumber}
        </p>
      </div>

      {/* Documents List */}
      <main className="flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="h-full overflow-y-auto"
          {...containerProps}
        >
          {/* Pull-to-refresh indicator */}
          <PullIndicator state={pullState} pullDistance={pullDistance} progress={progress} />

          <div
            className="transition-transform duration-200"
            style={{
              transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
            }}
          >
            {/* Loading State */}
            {loading && documents.length === 0 && (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <DocumentRowSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && documents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 bg-linear-bg-tertiary rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-linear-text-muted" />
                </div>
                <p className="text-linear-text-secondary text-center font-medium">
                  Niciun document
                </p>
                <p className="text-sm text-linear-text-muted text-center mt-1">
                  Acest dosar nu are documente încărcate
                </p>
              </div>
            )}

            {/* Documents List */}
            {documents.length > 0 && (
              <div className="p-4 space-y-2">
                {documents.map((doc) => (
                  <DocumentRow key={doc.id} document={doc} />
                ))}

                {/* Results count */}
                <div className="text-center py-2 text-sm text-linear-text-muted">
                  {documents.length} {documents.length === 1 ? 'document' : 'documente'}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// CaseRow Component
// ============================================================================

interface CaseRowProps {
  caseItem: CaseWithRelations;
  onTap: () => void;
}

function CaseRow({ caseItem, onTap }: CaseRowProps) {
  return (
    <button
      onClick={onTap}
      className="w-full text-left p-3 bg-linear-bg-secondary border border-linear-border-subtle rounded-xl flex items-center gap-3 active:scale-[0.98] active:bg-linear-bg-tertiary transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-linear-accent/10 flex items-center justify-center">
        <Folder className="w-5 h-5 text-linear-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-linear-text-primary truncate">
          {caseItem.title}
        </p>
        <p className="text-xs text-linear-text-secondary truncate">
          {caseItem.caseNumber} · {caseItem.client?.name}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-linear-text-muted flex-shrink-0" />
    </button>
  );
}

// ============================================================================
// DocumentRow Component
// ============================================================================

interface DocumentRowProps {
  document: CaseDocumentWithContext;
}

function DocumentRow({ document: docContext }: DocumentRowProps) {
  const doc = docContext.document;
  const FileIcon = getFileIcon(doc.fileType);

  const uploadDate = doc.uploadedAt
    ? format(parseISO(doc.uploadedAt), 'd MMM yyyy', { locale: ro })
    : null;

  const handleDownload = useCallback(() => {
    // For OneDrive documents, open in browser
    if (doc.oneDriveId) {
      window.open(
        `https://graph.microsoft.com/v1.0/me/drive/items/${doc.oneDriveId}/content`,
        '_blank'
      );
    }
    // TODO: Handle local storage documents
  }, [doc.oneDriveId]);

  return (
    <div className="p-3 bg-linear-bg-secondary border border-linear-border-subtle rounded-xl">
      <div className="flex items-start gap-3">
        {/* File Icon */}
        <div className="w-10 h-10 rounded-lg bg-linear-bg-tertiary flex items-center justify-center flex-shrink-0">
          <FileIcon className="w-5 h-5 text-linear-text-secondary" />
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-linear-text-primary truncate">
            {doc.fileName}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-linear-text-secondary">
            <span>{formatFileSize(doc.fileSize)}</span>
            {uploadDate && (
              <>
                <span className="text-linear-text-muted">·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {uploadDate}
                </span>
              </>
            )}
          </div>
          {doc.uploadedBy && (
            <p className="text-xs text-linear-text-muted mt-1 truncate">
              {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
            </p>
          )}
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          className="p-2 rounded-lg bg-linear-bg-tertiary active:scale-95 transition-transform"
        >
          <Download className="w-4 h-4 text-linear-text-secondary" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton Components
// ============================================================================

function CaseRowSkeleton() {
  return (
    <div className="p-3 bg-linear-bg-secondary border border-linear-border-subtle rounded-xl flex items-center gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-linear-bg-tertiary" />
      <div className="flex-1">
        <div className="h-4 w-3/4 bg-linear-bg-tertiary rounded mb-1" />
        <div className="h-3 w-1/2 bg-linear-bg-tertiary rounded" />
      </div>
    </div>
  );
}

function DocumentRowSkeleton() {
  return (
    <div className="p-3 bg-linear-bg-secondary border border-linear-border-subtle rounded-xl flex items-start gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-linear-bg-tertiary" />
      <div className="flex-1">
        <div className="h-4 w-3/4 bg-linear-bg-tertiary rounded mb-1" />
        <div className="h-3 w-1/2 bg-linear-bg-tertiary rounded" />
      </div>
    </div>
  );
}

// ============================================================================
// PullIndicator Component
// ============================================================================

interface PullIndicatorProps {
  state: PullState;
  pullDistance: number;
  progress: number;
}

function PullIndicator({ state, pullDistance, progress }: PullIndicatorProps) {
  if (pullDistance === 0 && state === 'idle') return null;

  const isRefreshing = state === 'refreshing';
  const isReady = state === 'ready';

  return (
    <div
      className="absolute left-0 right-0 flex items-center justify-center overflow-hidden z-10"
      style={{ height: pullDistance, top: 0 }}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ${
          isReady || isRefreshing ? 'bg-linear-accent-muted' : 'bg-linear-bg-tertiary'
        }`}
        style={{
          opacity: Math.min(progress * 1.5, 1),
          transform: `scale(${0.5 + progress * 0.5})`,
        }}
      >
        <RefreshCw
          className={`w-5 h-5 transition-colors ${
            isRefreshing
              ? 'text-linear-accent animate-spin'
              : isReady
                ? 'text-linear-accent'
                : 'text-linear-text-tertiary'
          }`}
        />
      </div>
    </div>
  );
}
