/**
 * Document Edit Page
 * Story 3.3: Intelligent Document Drafting
 *
 * Full-screen document editor with AI assistance
 * Route: /cases/[caseId]/documents/[documentId]/edit
 */

'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { AIDocumentEditor } from '@/components/documents/AIDocumentEditor';
import { LanguageExplanationPanel } from '@/components/documents/LanguageExplanation';
import { useUploadDocument } from '@/hooks/useDocumentActions';
import type { DocumentType } from '@legal-platform/types';

interface DocumentEditContentProps {
  caseId: string;
  documentId: string;
}

function DocumentEditContent({ caseId, documentId }: DocumentEditContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { uploadDocument, loading: uploading, error: uploadError } = useUploadDocument();

  // Check if this is a newly generated document
  const isGenerated = searchParams.get('generated') === 'true';
  const docType = (searchParams.get('type') as DocumentType) || 'Contract';
  const generatedContent = searchParams.get('content');
  const suggestedTitle = searchParams.get('title');

  // Track initial content for metrics
  const initialContentRef = useRef<string>('');

  // Editor state
  const [content, setContent] = useState('');
  const [documentType] = useState<DocumentType>(docType);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Explanation panel state
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Load initial content
  useEffect(() => {
    if (generatedContent) {
      // Decode the generated content from URL
      try {
        const decoded = decodeURIComponent(generatedContent);
        setContent(decoded);
        initialContentRef.current = decoded;
      } catch {
        setContent('');
      }
    } else if (!isGenerated) {
      // Load existing document content
      loadDocumentContent();
    }
  }, [documentId, generatedContent, isGenerated]);

  const loadDocumentContent = async () => {
    // TODO: Replace with actual GraphQL query
    // For now, set empty content
    setContent('');
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(true);
  };

  const handleTextSelect = (text: string) => {
    if (text.length > 3) {
      setSelectedText(text);
      setShowExplanation(true);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Replace with actual GraphQL mutation
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'Aveți modificări nesalvate. Sigur doriți să părăsiți pagina?'
      );
      if (!confirmed) return;
    }
    router.push(`/cases/${caseId}`);
  };

  const handleFinalize = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      if (isGenerated) {
        // For new AI-generated documents, create the document in the database
        const timestamp = Date.now();
        const fileName = `${suggestedTitle || `Document-${documentType}`}-${timestamp}.txt`;

        // Generate a storage path for the AI-generated document
        const storagePath = `ai-generated/${caseId}/${timestamp}-${fileName}`;

        const uploadedDoc = await uploadDocument({
          caseId,
          fileName,
          fileType: 'text/plain',
          fileSize: new Blob([content]).size,
          storagePath,
          metadata: {
            title: suggestedTitle || `Document ${documentType}`,
            description: `AI-generated ${documentType} document`,
            aiGenerated: true,
            initialContent: initialContentRef.current.substring(0, 500), // Store first 500 chars for reference
          },
        });

        if (uploadedDoc) {
          // Navigate to the newly created document
          router.push(`/cases/${caseId}/documents/${uploadedDoc.id}`);
        } else {
          setSaveError(uploadError?.message || 'Failed to save document');
        }
      } else {
        // For existing documents, just save and navigate
        await handleSave();
        router.push(`/cases/${caseId}/documents/${documentId}`);
      }
    } catch (error) {
      console.error('Failed to finalize document:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCancel}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Înapoi"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {isGenerated ? 'Document Nou Generat' : 'Editare Document'}
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                  {documentType}
                </span>
                {lastSaved && (
                  <span>
                    Salvat la {lastSaved.toLocaleTimeString('ro-RO')}
                  </span>
                )}
                {hasUnsavedChanges && (
                  <span className="text-amber-600">Modificări nesalvate</span>
                )}
                {saveError && (
                  <span className="text-red-600">Eroare: {saveError}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className={clsx(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                'border border-gray-300 text-gray-700',
                'hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isSaving ? 'Se salvează...' : 'Salvează'}
            </button>
            <button
              onClick={handleFinalize}
              disabled={isSaving || uploading}
              className={clsx(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                'bg-blue-600 text-white hover:bg-blue-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isSaving || uploading ? 'Se salvează...' : 'Finalizează'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        <div className={clsx(
          'flex-1 p-6 overflow-hidden transition-all duration-300',
          showExplanation ? 'pr-96' : ''
        )}>
          <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <AIDocumentEditor
              initialContent={content}
              documentType={documentType}
              documentId={documentId}
              onContentChange={handleContentChange}
              onTextSelect={handleTextSelect}
              placeholder="Începeți să scrieți sau editați documentul generat..."
              enableSuggestions={true}
            />
          </div>
        </div>

        {/* Explanation Sidebar */}
        {showExplanation && selectedText && (
          <div className="w-96 bg-white border-l border-gray-200 flex-shrink-0 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Explicație</h2>
                <button
                  onClick={() => setShowExplanation(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <LanguageExplanationPanel
                  isVisible={showExplanation}
                  selectedText={selectedText}
                  documentId={documentId}
                  onClose={() => setShowExplanation(false)}
                  position="right"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Generated Banner */}
      {isGenerated && (
        <div className="bg-blue-50 border-t border-blue-100 px-6 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-800">
              Acest document a fost generat de AI. Vă rugăm să revizuiți și editați conținutul înainte de finalizare.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentEditPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  const documentId = params.documentId as string;

  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <DocumentEditContent caseId={caseId} documentId={documentId} />
    </Suspense>
  );
}
