/**
 * Language Explanation Component
 * Story 3.3: Intelligent Document Drafting
 *
 * Provides AI explanations for selected legal text
 * Features: right-click context menu, side panel, legal basis, alternatives
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import type { LanguageExplanation as LanguageExplanationType } from '@legal-platform/types';

export interface LanguageExplanationProps {
  /** Whether the explanation panel is visible */
  isVisible: boolean;
  /** The selected text being explained */
  selectedText: string;
  /** Callback when panel is closed */
  onClose: () => void;
  /** Document ID for context */
  documentId: string;
  /** Position for panel display */
  position?: 'right' | 'bottom' | 'modal';
}

/**
 * Side panel or modal for displaying language explanations
 */
export function LanguageExplanationPanel({
  isVisible,
  selectedText,
  onClose,
  documentId,
  position = 'right',
}: LanguageExplanationProps) {
  const [explanation, setExplanation] = useState<LanguageExplanationType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch explanation when selected text changes
  useEffect(() => {
    if (isVisible && selectedText && selectedText.length > 0) {
      fetchExplanation(selectedText);
    }
  }, [isVisible, selectedText]);

  const fetchExplanation = async (text: string) => {
    if (text.length < 3) {
      setError('Selectați mai mult text pentru explicație');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual GraphQL mutation
      // const { data } = await client.mutate({
      //   mutation: EXPLAIN_LANGUAGE_CHOICE_MUTATION,
      //   variables: {
      //     documentId,
      //     selectedText: text,
      //   },
      // });

      // Mock explanation for demo
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockExplanation: LanguageExplanationType = {
        selection: text,
        explanation:
          'Această formulare este o clauză standard în contractele de prestări servicii, ' +
          'menită să definească clar obligațiile de confidențialitate ale părților. ' +
          'Utilizarea termenului "se obligă" creează o obligație contractuală fermă, ' +
          'iar specificarea duratei de 5 ani asigură protecție pe termen lung.',
        legalBasis:
          'Conform art. 1270 Cod Civil privind forța obligatorie a contractului și ' +
          'art. 1350 privind obligația de confidențialitate. Practica judiciară confirmă ' +
          'că o perioadă de 5 ani este rezonabilă pentru clauze de confidențialitate în ' +
          'relațiile comerciale.',
        alternatives: [
          'Prestatorul garantează păstrarea confidențialității...',
          'Prestatorul își asumă obligația de a menține confidențiale...',
          'Prestatorul se angajează să nu divulge...',
        ],
      };

      setExplanation(mockExplanation);
    } catch (err) {
      setError('Nu s-a putut obține explicația. Încercați din nou.');
      console.error('Failed to fetch explanation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Track explanation request for analytics
  const trackExplanationRequest = useCallback(() => {
    // TODO: Implement analytics tracking
    console.log('Explanation requested:', {
      documentId,
      textLength: selectedText.length,
      timestamp: new Date().toISOString(),
    });
  }, [documentId, selectedText]);

  useEffect(() => {
    if (isVisible && selectedText) {
      trackExplanationRequest();
    }
  }, [isVisible, selectedText, trackExplanationRequest]);

  if (!isVisible) return null;

  // Modal view
  if (position === 'modal') {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={onClose}
        />
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <ExplanationContent
              explanation={explanation}
              selectedText={selectedText}
              isLoading={isLoading}
              error={error}
              onClose={onClose}
              onRetry={() => fetchExplanation(selectedText)}
            />
          </div>
        </div>
      </div>
    );
  }

  // Side panel view
  return (
    <div
      className={clsx(
        'bg-white border-gray-200 shadow-lg overflow-hidden',
        position === 'right' && 'w-80 border-l',
        position === 'bottom' && 'h-64 border-t'
      )}
    >
      <ExplanationContent
        explanation={explanation}
        selectedText={selectedText}
        isLoading={isLoading}
        error={error}
        onClose={onClose}
        onRetry={() => fetchExplanation(selectedText)}
      />
    </div>
  );
}

/**
 * Internal component for explanation content
 */
interface ExplanationContentProps {
  explanation: LanguageExplanationType | null;
  selectedText: string;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}

function ExplanationContent({
  explanation,
  selectedText,
  isLoading,
  error,
  onClose,
  onRetry,
}: ExplanationContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-600"
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
          <h3 className="text-sm font-semibold text-gray-900">
            Explicație Limbaj Juridic
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Selected Text */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">Text selectat:</p>
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-gray-800 italic">
            "{selectedText.length > 200 ? selectedText.slice(0, 200) + '...' : selectedText}"
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
              <p className="text-sm text-gray-500">Se analizează textul...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="text-center py-8">
            <svg
              className="w-8 h-8 mx-auto mb-2 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <button
              onClick={onRetry}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Reîncearcă
            </button>
          </div>
        )}

        {/* Explanation Content */}
        {explanation && !isLoading && !error && (
          <div className="space-y-4">
            {/* Main Explanation */}
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Explicație
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                {explanation.explanation}
              </p>
            </div>

            {/* Legal Basis */}
            {explanation.legalBasis && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Bază Legală
                </h4>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-sm text-blue-800 leading-relaxed">
                    {explanation.legalBasis}
                  </p>
                </div>
              </div>
            )}

            {/* Alternatives */}
            {explanation.alternatives && explanation.alternatives.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Formulări Alternative
                </h4>
                <ul className="space-y-2">
                  {explanation.alternatives.map((alt, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <span className="flex-shrink-0 w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-500">
                        {idx + 1}
                      </span>
                      <span className="flex-1">{alt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          Powered by AI • Verificați întotdeauna cu un avocat
        </p>
      </div>
    </div>
  );
}

/**
 * Context Menu for triggering explanation
 */
export interface ExplanationContextMenuProps {
  /** Position of the context menu */
  position: { x: number; y: number } | null;
  /** Callback when "Explain" is clicked */
  onExplain: () => void;
  /** Callback when menu is closed */
  onClose: () => void;
}

export function ExplanationContextMenu({
  position,
  onExplain,
  onClose,
}: ExplanationContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!position) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [position, onClose]);

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
      style={{
        top: position.y,
        left: position.x,
      }}
    >
      <button
        onClick={() => {
          onExplain();
          onClose();
        }}
        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
      >
        <svg
          className="w-4 h-4 text-blue-600"
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
        Explică acest text
      </button>
      <div className="border-t border-gray-100 my-1" />
      <button
        onClick={onClose}
        className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
      >
        Anulare
      </button>
    </div>
  );
}

/**
 * Hook for managing language explanation state
 */
export function useLanguageExplanation(_documentId: string) {
  const [isExplanationVisible, setIsExplanationVisible] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || '';

    if (text.length > 0) {
      e.preventDefault();
      setSelectedText(text);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
    }
  }, []);

  // Show explanation panel
  const showExplanation = useCallback(() => {
    setIsExplanationVisible(true);
    setContextMenuPosition(null);
  }, []);

  // Close explanation panel
  const closeExplanation = useCallback(() => {
    setIsExplanationVisible(false);
    setSelectedText('');
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenuPosition(null);
  }, []);

  return {
    isExplanationVisible,
    selectedText,
    contextMenuPosition,
    handleContextMenu,
    showExplanation,
    closeExplanation,
    closeContextMenu,
    setSelectedText,
  };
}

export default LanguageExplanationPanel;
