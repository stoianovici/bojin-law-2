'use client';

/**
 * Documents Page - Case-Organized with Folder Structure
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 * OPS-328: Mobile Page Consistency - Added mobile view
 *
 * Two-column layout for document management:
 * - Left: Case sidebar with nested folder trees
 * - Right: Document list and preview
 *
 * Supports URL routing: /documents?case={caseId}&folder={folderId}
 * On mobile devices (< 768px), shows MobileDocuments instead.
 */

import { Suspense, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

// Components
import { DocumentsSidebar } from '../../components/documents/DocumentsSidebar';
import { DocumentsContentPanel } from '../../components/documents/DocumentsContentPanel';
import { PageLayout } from '../../components/linear/PageLayout';
import { MobileDocuments } from '../../components/mobile';

// Hooks
import { useCases } from '../../hooks/useCases';
import { useCaseFolderTree } from '../../hooks/useDocumentFolders';
import { useDocumentFoldersStore } from '../../stores/document-folders.store';
import { useSetAIContext } from '../../contexts/AIAssistantContext';
import { useIsMobile } from '../../hooks/useIsMobile';

// ============================================================================
// URL Routing Helper
// ============================================================================

function buildDocumentsUrl(caseId: string | null, folderId: string | null): string {
  const params = new URLSearchParams();
  if (caseId) params.set('case', caseId);
  if (folderId) params.set('folder', folderId);
  const queryString = params.toString();
  return queryString ? `/documents?${queryString}` : '/documents';
}

// ============================================================================
// Main Content Component (needs Suspense for useSearchParams)
// ============================================================================

function DocumentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Set AI assistant context
  useSetAIContext('documents');

  // Store state
  const { selectedCaseId, selectedFolderId, setSelectedCase, selectCaseAndFolder } =
    useDocumentFoldersStore();

  // Fetch cases for sidebar
  const { cases, loading: casesLoading, refetch: refetchCases } = useCases({ assignedToMe: true });

  // Fetch folder tree for selected case
  const {
    folderTree,
    loading: foldersLoading,
    refetch: refetchFolders,
  } = useCaseFolderTree(selectedCaseId);

  // Initialize from URL params on mount (URL takes precedence over localStorage)
  useEffect(() => {
    const urlCaseId = searchParams?.get('case');
    const urlFolderId = searchParams?.get('folder');

    if (urlCaseId) {
      // URL has case/folder params - use them (overrides localStorage)
      selectCaseAndFolder(urlCaseId, urlFolderId);
    }
    // If no URL params, Zustand persist middleware will restore from localStorage
  }, []); // Only run on mount

  // Auto-select first case only if no selection exists (no URL, no localStorage)
  useEffect(() => {
    const urlCaseId = searchParams?.get('case');
    // Only auto-select if:
    // 1. No URL params provided
    // 2. No persisted selection from localStorage
    // 3. Cases are loaded
    if (!urlCaseId && !selectedCaseId && cases.length > 0) {
      setSelectedCase(cases[0].id);
    }
  }, [selectedCaseId, cases, setSelectedCase, searchParams]);

  // Sync URL when selection changes
  const updateUrl = useCallback(
    (caseId: string | null, folderId: string | null) => {
      const newUrl = buildDocumentsUrl(caseId, folderId);
      router.replace(newUrl, { scroll: false });
    },
    [router]
  );

  // Handle case selection
  const handleCaseSelect = useCallback(
    (caseId: string) => {
      selectCaseAndFolder(caseId, null);
      updateUrl(caseId, null);
    },
    [selectCaseAndFolder, updateUrl]
  );

  // Handle folder selection
  const handleFolderSelect = useCallback(
    (caseId: string, folderId: string | null) => {
      selectCaseAndFolder(caseId, folderId);
      updateUrl(caseId, folderId);
    },
    [selectCaseAndFolder, updateUrl]
  );

  // Handle refresh
  const handleRefresh = () => {
    refetchCases();
    if (selectedCaseId) {
      refetchFolders();
    }
  };

  // Loading state
  const isLoading = casesLoading;

  return (
    <PageLayout className="flex h-full p-0">
      {/* Left Sidebar - Cases and Folders */}
      <div className="flex w-80 flex-col border-r border-linear-border-subtle bg-linear-bg-secondary">
        {/* Header */}
        <div className="border-b border-linear-border-subtle bg-linear-bg-tertiary px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-linear-text-secondary" />
              <h1 className="text-lg font-semibold text-linear-text-primary">Documente</h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className={clsx(
                'rounded-md p-1.5 transition-colors',
                isLoading
                  ? 'text-linear-text-tertiary'
                  : 'text-linear-text-secondary hover:bg-linear-bg-hover hover:text-linear-text-primary'
              )}
              title="Reîmprospătează"
            >
              <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Sidebar Content */}
        <DocumentsSidebar
          cases={cases}
          selectedCaseId={selectedCaseId}
          selectedFolderId={selectedFolderId}
          folderTree={folderTree}
          loading={casesLoading || foldersLoading}
          onCaseSelect={handleCaseSelect}
          onFolderSelect={handleFolderSelect}
        />
      </div>

      {/* Right Panel - Documents */}
      <div className="flex min-w-0 flex-1 flex-col">
        <DocumentsContentPanel
          caseId={selectedCaseId}
          folderId={selectedFolderId}
          folderTree={folderTree}
          cases={cases}
          loading={foldersLoading}
        />
      </div>
    </PageLayout>
  );
}

// ============================================================================
// Page Export (wrapped in Suspense for useSearchParams)
// ============================================================================

export default function DocumentsPage() {
  const isMobile = useIsMobile();

  // On mobile, render MobileDocuments
  if (isMobile) {
    return <MobileDocuments />;
  }

  // Desktop: render full documents page
  return (
    <Suspense
      fallback={
        <PageLayout className="flex h-full items-center justify-center p-0">
          <div className="text-sm text-linear-text-secondary">Se încarcă...</div>
        </PageLayout>
      }
    >
      <DocumentsPageContent />
    </Suspense>
  );
}
