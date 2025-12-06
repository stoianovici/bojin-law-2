'use client';

import { useEffect, useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, SkipForward, Loader2 } from 'lucide-react';
import { DocumentViewer } from '@/components/DocumentViewer';
import { CategorySelector } from './CategorySelector';
import { DocumentMetadataPanel } from './DocumentMetadataPanel';
import { ProgressBar } from './ProgressBar';
import { FilterBar } from './FilterBar';
import { useDocumentStore } from '@/stores/documentStore';
import { useAuth } from '@/contexts/AuthContext';
import type { Category, DocumentState } from '@/stores/documentStore';

interface CategorizationWorkspaceProps {
  sessionId: string;
}

export function CategorizationWorkspace({ sessionId }: CategorizationWorkspaceProps) {
  const { user } = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Store selectors
  const setSession = useDocumentStore((s: DocumentState) => s.setSession);
  const setBatch = useDocumentStore((s: DocumentState) => s.setBatch);
  const setSessionProgress = useDocumentStore((s: DocumentState) => s.setSessionProgress);
  const setDocuments = useDocumentStore((s: DocumentState) => s.setDocuments);
  const setCategories = useDocumentStore((s: DocumentState) => s.setCategories);
  const addCategory = useDocumentStore((s: DocumentState) => s.addCategory);
  const setDocumentUrl = useDocumentStore((s: DocumentState) => s.setDocumentUrl);

  const currentDocument = useDocumentStore((s: DocumentState) => s.getCurrentDocument());
  const documentUrls = useDocumentStore((s: DocumentState) => s.documentUrls);
  const getFilteredDocuments = useDocumentStore((s: DocumentState) => s.getFilteredDocuments);
  const currentDocumentIndex = useDocumentStore((s: DocumentState) => s.currentDocumentIndex);

  const goToNextDocument = useDocumentStore((s: DocumentState) => s.goToNextDocument);
  const goToPreviousDocument = useDocumentStore((s: DocumentState) => s.goToPreviousDocument);
  const categorizeDocument = useDocumentStore((s: DocumentState) => s.categorizeDocument);
  const skipDocument = useDocumentStore((s: DocumentState) => s.skipDocument);

  const filteredDocuments = getFilteredDocuments();

  // Initialize workspace data
  useEffect(() => {
    async function initialize() {
      if (!user?.id) {
        setInitError('User not authenticated');
        setIsInitializing(false);
        return;
      }

      try {
        setIsInitializing(true);
        setInitError(null);

        // Fetch batch assignment
        const batchRes = await fetch(`/api/get-batch?sessionId=${sessionId}&userId=${user.id}`);
        if (!batchRes.ok) throw new Error('Failed to get batch assignment');
        const batchData = await batchRes.json();

        setSession(sessionId, batchData.sessionStatus);
        setBatch(batchData.batch, batchData.batchRange);
        setDocuments(batchData.documents);
        setCategories(batchData.categories);
        setSessionProgress(batchData.sessionProgress);
      } catch (err) {
        setInitError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setIsInitializing(false);
      }
    }

    initialize();
  }, [sessionId, user?.id, setSession, setBatch, setDocuments, setCategories, setSessionProgress]);

  // Fetch document URL when current document changes
  useEffect(() => {
    async function fetchDocumentUrl() {
      if (!currentDocument) return;
      if (documentUrls[currentDocument.id]) return;

      try {
        const res = await fetch(`/api/document-url?documentId=${currentDocument.id}`);
        if (!res.ok) throw new Error('Failed to get document URL');
        const data = await res.json();
        setDocumentUrl(currentDocument.id, data.url);
      } catch (err) {
        console.error('Failed to fetch document URL:', err);
      }
    }

    fetchDocumentUrl();
  }, [currentDocument, documentUrls, setDocumentUrl]);

  // Sync categories on document change
  useEffect(() => {
    async function syncCategories() {
      if (!currentDocument || !sessionId) return;

      try {
        const res = await fetch(`/api/sync-categories?sessionId=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories);
        }
      } catch (err) {
        console.error('Failed to sync categories:', err);
      }
    }

    syncCategories();
  }, [currentDocument?.id, sessionId, setCategories]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Ignore if focus is on input
      if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) {
        return;
      }

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          goToNextDocument();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          goToPreviousDocument();
          break;
        case 's':
        case 'S':
          event.preventDefault();
          if (currentDocument) handleSkip();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [goToNextDocument, goToPreviousDocument, currentDocument]);

  // Handle category selection
  const handleCategorySelect = useCallback(
    async (categoryId: string, categoryName: string) => {
      if (!currentDocument || isSubmitting) return;

      setIsSubmitting(true);
      try {
        const res = await fetch('/api/categorize-doc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: currentDocument.id,
            categoryId,
          }),
        });

        if (!res.ok) throw new Error('Failed to categorize document');

        categorizeDocument(currentDocument.id, categoryId, categoryName);

        // Auto-advance to next uncategorized document
        setTimeout(() => goToNextDocument(), 300);
      } catch (err) {
        console.error('Failed to categorize:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentDocument, isSubmitting, categorizeDocument, goToNextDocument]
  );

  // Handle skip
  const handleSkip = useCallback(async () => {
    if (!currentDocument || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/categorize-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: currentDocument.id,
          skip: true,
        }),
      });

      if (!res.ok) throw new Error('Failed to skip document');

      skipDocument(currentDocument.id);
      setTimeout(() => goToNextDocument(), 300);
    } catch (err) {
      console.error('Failed to skip:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentDocument, isSubmitting, skipDocument, goToNextDocument]);

  // Handle new category creation
  const handleCreateCategory = useCallback(
    async (name: string): Promise<Category> => {
      const res = await fetch('/api/create-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create category');
      }

      const newCategory = await res.json();
      addCategory(newCategory);
      return newCategory;
    },
    [sessionId, addCategory]
  );

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">Se încarcă documentele...</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 font-medium">{initError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reîncearcă
        </button>
      </div>
    );
  }

  const documentUrl = currentDocument ? documentUrls[currentDocument.id] : null;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <ProgressBar />

      {/* Filter Bar */}
      <FilterBar />

      {/* Main Workspace */}
      <div className="grid grid-cols-12 gap-4 min-h-[600px]">
        {/* Document Viewer (8 cols) */}
        <div className="col-span-8 bg-white rounded-lg border border-gray-200 overflow-hidden">
          {currentDocument ? (
            <DocumentViewer
              url={documentUrl}
              fileName={currentDocument.fileName}
              fileExtension={currentDocument.fileExtension}
              extractedText={currentDocument.extractedText}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Nu sunt documente de afișat
            </div>
          )}
        </div>

        {/* Sidebar (4 cols) */}
        <div className="col-span-4 space-y-4">
          {/* Category Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Atribuie categorie</h3>
            <CategorySelector
              selectedCategoryId={currentDocument?.categoryId || null}
              onSelect={handleCategorySelect}
              onCreateCategory={handleCreateCategory}
              disabled={!currentDocument || isSubmitting}
            />

            {/* Navigation Controls */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={goToPreviousDocument}
                disabled={currentDocumentIndex === 0}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>

              <span className="text-sm text-gray-500">
                {filteredDocuments.length > 0
                  ? `${currentDocumentIndex + 1} / ${filteredDocuments.length}`
                  : '0 / 0'}
              </span>

              <button
                onClick={goToNextDocument}
                disabled={currentDocumentIndex >= filteredDocuments.length - 1}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Următor
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Skip Button */}
            <button
              onClick={handleSkip}
              disabled={!currentDocument || isSubmitting}
              className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SkipForward className="h-4 w-4" />
              Sari peste document (S)
            </button>
          </div>

          {/* Document Metadata */}
          {currentDocument && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Detalii document</h3>
              <DocumentMetadataPanel document={currentDocument} />
            </div>
          )}

          {/* Keyboard Shortcuts */}
          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Scurtături tastatură
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <kbd className="px-1.5 py-0.5 bg-white border rounded">←</kbd> Anterior
              </div>
              <div>
                <kbd className="px-1.5 py-0.5 bg-white border rounded">→</kbd> Următor
              </div>
              <div>
                <kbd className="px-1.5 py-0.5 bg-white border rounded">S</kbd> Sari
              </div>
              <div>
                <kbd className="px-1.5 py-0.5 bg-white border rounded">1-9</kbd> Atribuire rapidă
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
