/**
 * Document Generation Page
 * Story 3.3: Intelligent Document Drafting
 *
 * Page for generating new documents using AI
 * Route: /cases/[caseId]/documents/new
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { clsx } from 'clsx';
import type { DocumentType } from '@legal-platform/types';

// GraphQL Queries and Mutations
const GENERATE_DOCUMENT_MUTATION = gql`
  mutation GenerateDocumentWithAI($input: AIDocumentGenerationInput!) {
    generateDocumentWithAI(input: $input) {
      id
      title
      content
      suggestedTitle
      templateUsed {
        id
        name
      }
      tokensUsed
      generationTimeMs
    }
  }
`;

const GET_CASE_CONTEXT_QUERY = gql`
  query GetCaseForDocument($caseId: ID!) {
    case(id: $caseId) {
      id
      caseNumber
      title
      caseType
      openedDate
      description
      client {
        id
        name
      }
    }
  }
`;

const SUGGEST_TEMPLATES_QUERY = gql`
  query SuggestTemplates($caseId: ID!, $documentType: DocumentType!) {
    suggestTemplates(caseId: $caseId, documentType: $documentType) {
      id
      name
      category
      qualityScore
    }
  }
`;

interface DocumentGenerationPageProps {
  params: Promise<{
    caseId: string;
  }>;
}

// Document type options
const DOCUMENT_TYPES: { value: DocumentType; label: string; description: string }[] = [
  { value: 'Contract', label: 'Contract', description: 'Contracte și acorduri juridice' },
  { value: 'Motion', label: 'Cerere', description: 'Cereri către instanță sau autorități' },
  { value: 'Letter', label: 'Scrisoare', description: 'Corespondență juridică oficială' },
  { value: 'Memo', label: 'Memorandum', description: 'Note și memorandumuri interne' },
  { value: 'Pleading', label: 'Acțiune în instanță', description: 'Cereri de chemare în judecată' },
  { value: 'Other', label: 'Altele', description: 'Alte tipuri de documente' },
];

// Placeholder prompt examples
const PROMPT_EXAMPLES: Record<DocumentType, string> = {
  Contract: 'Generează un contract de prestări servicii juridice pentru client...',
  Motion: 'Redactează o cerere de amânare a termenului de judecată pentru motivul...',
  Letter: 'Scrie o scrisoare de notificare către partea adversă privind...',
  Memo: 'Creează un memorandum intern despre analiza juridică a cazului...',
  Pleading: 'Redactează o cerere de chemare în judecată pentru recuperarea...',
  Other: 'Descrie documentul pe care dorești să-l generezi...',
};

// Types for GraphQL responses
interface CaseData {
  id: string;
  caseNumber: string;
  title: string;
  caseType: string;
  openedDate: string;
  description?: string;
  client?: { id: string; name: string };
}

interface TemplateData {
  id: string;
  name: string;
  category: string;
  qualityScore?: number;
}

interface GeneratedDocument {
  id: string;
  title: string;
  content: string;
  suggestedTitle: string;
  templateUsed?: { id: string; name: string };
  tokensUsed: number;
  generationTimeMs: number;
}

/**
 * Document Generation Page Component
 */
export default function DocumentGenerationPage({ params }: DocumentGenerationPageProps) {
  const resolvedParams = React.use(params);
  const { caseId } = resolvedParams;
  const router = useRouter();

  // Form state
  const [documentType, setDocumentType] = useState<DocumentType>('Contract');
  const [prompt, setPrompt] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [includeContext, setIncludeContext] = useState(true);

  // UI state
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch case context
  const { data: caseData, loading: caseLoading } = useQuery<{ case: CaseData }>(
    GET_CASE_CONTEXT_QUERY,
    {
      variables: { caseId },
      skip: !caseId,
    }
  );

  // Fetch template suggestions
  const { data: templatesData } = useQuery<{
    suggestTemplates: TemplateData[];
  }>(SUGGEST_TEMPLATES_QUERY, {
    variables: { caseId, documentType },
    skip: !caseId,
  });

  // Document generation mutation
  const [generateDocument, { loading: isGenerating }] = useMutation<{
    generateDocumentWithAI: GeneratedDocument;
  }>(GENERATE_DOCUMENT_MUTATION, {
    onError: (err) => {
      setError(err.message || 'A apărut o eroare la generarea documentului.');
    },
  });

  // Extract data from queries
  const caseContext = caseData?.case;
  const templates = templatesData?.suggestTemplates ?? [];
  const isLoadingContext = caseLoading;

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Vă rugăm să introduceți o descriere a documentului.');
      return;
    }

    if (prompt.trim().length < 10) {
      setError('Descrierea trebuie să aibă cel puțin 10 caractere.');
      return;
    }

    setError(null);
    setProgress(0);

    // Start progress simulation
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 5, 90));
    }, 200);

    try {
      const result = await generateDocument({
        variables: {
          input: {
            caseId,
            prompt: prompt.trim(),
            documentType,
            templateId,
            includeContext,
          },
        },
      });

      clearInterval(progressInterval);
      setProgress(100);

      const generated = result.data?.generateDocumentWithAI;
      if (generated) {
        // Navigate to document editor with generated content
        const encodedContent = encodeURIComponent(generated.content);
        const encodedTitle = encodeURIComponent(generated.suggestedTitle || generated.title);
        router.push(
          `/cases/${caseId}/documents/${generated.id}/edit?generated=true&type=${documentType}&content=${encodedContent}&title=${encodedTitle}`
        );
      }
    } catch (err) {
      clearInterval(progressInterval);
      setProgress(0);
      setError(err instanceof Error ? err.message : 'A apărut o eroare la generarea documentului.');
    }
  }, [caseId, prompt, documentType, templateId, includeContext, generateDocument, router]);

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <nav className="text-sm text-gray-500 mb-2">
            <button onClick={handleCancel} className="hover:text-gray-700">
              Cazuri
            </button>
            <span className="mx-2">/</span>
            <span>{caseContext?.caseNumber || caseId}</span>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Document Nou</span>
          </nav>
          <h1 className="text-2xl font-semibold text-gray-900">Generare Document cu AI</h1>
          <p className="mt-1 text-sm text-gray-500">
            Descrieți documentul dorit și AI-ul va genera o versiune inițială
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className="col-span-2 space-y-6">
            {/* Document Type Selection */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Tip Document</h2>
              <div className="grid grid-cols-2 gap-3">
                {DOCUMENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setDocumentType(type.value)}
                    className={clsx(
                      'p-4 rounded-lg border text-left transition-all',
                      documentType === type.value
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <span className="font-medium text-gray-900">{type.label}</span>
                    <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Prompt Input */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Descriere Document</h2>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={PROMPT_EXAMPLES[documentType]}
                rows={6}
                className={clsx(
                  'w-full rounded-lg border px-4 py-3 text-gray-900',
                  'placeholder:text-gray-400 focus:outline-none focus:ring-2',
                  error
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                )}
              />
              <div className="flex justify-between mt-2">
                <p className="text-sm text-gray-500">{prompt.length} / 10,000 caractere</p>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            </section>

            {/* Template Selection (Optional) */}
            {templates.length > 0 && (
              <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Șablon (Opțional)</h2>
                <select
                  value={templateId || ''}
                  onChange={(e) => setTemplateId(e.target.value || null)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-200"
                >
                  <option value="">Fără șablon - generare liberă</option>
                  {templates
                    .filter((t) => t.category === documentType || t.category.includes(documentType))
                    .map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                </select>
              </section>
            )}

            {/* Options */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Opțiuni</h2>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeContext}
                  onChange={(e) => setIncludeContext(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Include context cazului</span>
                  <p className="text-sm text-gray-500">
                    AI-ul va folosi informațiile cazului pentru generare
                  </p>
                </div>
              </label>
            </section>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleCancel}
                disabled={isGenerating}
                className="px-6 py-3 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Anulare
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className={clsx(
                  'px-8 py-3 font-medium rounded-lg transition-all',
                  'text-white bg-blue-600 hover:bg-blue-700',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center space-x-2'
                )}
              >
                {isGenerating ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Generare... {progress}%</span>
                  </>
                ) : (
                  <span>Generează Document</span>
                )}
              </button>
            </div>
          </div>

          {/* Right Column - Context Preview */}
          <div className="col-span-1 space-y-6">
            {/* Case Context Preview */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Context Caz</h2>
              {isLoadingContext ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              ) : caseContext ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500">Număr caz:</span>
                    <p className="font-medium text-gray-900">{caseContext.caseNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Client:</span>
                    <p className="font-medium text-gray-900">{caseContext.client?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Tip caz:</span>
                    <p className="font-medium text-gray-900">{caseContext.caseType}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Deschis:</span>
                    <p className="font-medium text-gray-900">
                      {new Date(caseContext.openedDate).toLocaleDateString('ro-RO')}
                    </p>
                  </div>
                  {caseContext.description && (
                    <div>
                      <span className="text-gray-500">Descriere:</span>
                      <p className="text-gray-700 mt-1">{caseContext.description}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Nu s-au putut încărca informațiile cazului.</p>
              )}
            </section>

            {/* AI Info */}
            <section className="bg-blue-50 rounded-lg border border-blue-100 p-6">
              <div className="flex items-start space-x-3">
                <svg
                  className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="font-medium text-blue-900">Despre generarea AI</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Documentul generat este o versiune inițială care necesită revizuire. AI-ul
                    folosește contextul cazului și șabloanele firmei pentru a crea documente
                    relevante.
                  </p>
                </div>
              </div>
            </section>

            {/* Quality Target */}
            <section className="bg-gray-50 rounded-lg border border-gray-200 p-6">
              <h3 className="font-medium text-gray-900 mb-2">Obiectiv calitate</h3>
              <p className="text-sm text-gray-600">
                Documentele generate necesită în medie{' '}
                <span className="font-semibold text-gray-900">&lt; 30%</span> editare manuală.
              </p>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '70%' }} />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
