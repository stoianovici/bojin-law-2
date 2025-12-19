/**
 * Refinement Input Component
 * Story 5.3: AI-Powered Email Drafting - Task 21
 *
 * Text input for refinement instructions with quick action buttons
 */

'use client';

import React, { useState, useCallback } from 'react';
import type { DraftRefinement } from '@/hooks/useEmailDraft';
import { Spinner } from '@/components/ui/spinner';

interface RefinementInputProps {
  onRefine: (instruction: string) => Promise<void>;
  loading: boolean;
  refinementHistory?: DraftRefinement[];
}

const QUICK_ACTIONS = [
  { label: 'Mai scurt', instruction: 'Fă-l mai scurt', icon: '📝' },
  { label: 'Mai formal', instruction: 'Fă-l mai formal', icon: '👔' },
  { label: 'Mai detaliat', instruction: 'Adaugă mai multe detalii', icon: '📋' },
  { label: 'În română', instruction: 'Traduce în română', icon: '🇷🇴' },
  { label: 'În engleză', instruction: 'Traduce în engleză', icon: '🇬🇧' },
];

export function RefinementInput({
  onRefine,
  loading,
  refinementHistory = [],
}: RefinementInputProps) {
  const [instruction, setInstruction] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!instruction.trim() || loading) return;
      await onRefine(instruction);
      setInstruction('');
    },
    [instruction, loading, onRefine]
  );

  const handleQuickAction = useCallback(
    async (quickInstruction: string) => {
      if (loading) return;
      await onRefine(quickInstruction);
    },
    [loading, onRefine]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Rafinare AI</h4>
        {refinementHistory.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {showHistory ? 'Ascunde' : 'Arată'} istoric ({refinementHistory.length})
          </button>
        )}
      </div>

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick refinement actions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => handleQuickAction(action.instruction)}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750"
            role="button"
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Custom instruction input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="refinement-input" className="sr-only">
          Instrucțiune personalizată de rafinare
        </label>
        <input
          id="refinement-input"
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Instrucțiuni de rafinare personalizate (ex: 'Adaugă un paragraf despre termene limită')"
          disabled={loading}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400"
          aria-label="Instrucțiune personalizată de rafinare"
        />
        <button
          type="submit"
          disabled={loading || !instruction.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          aria-busy={loading}
        >
          {loading ? (
            <>
              <Spinner size="xs" /> Se rafinează...
            </>
          ) : (
            'Rafinează'
          )}
        </button>
      </form>

      {/* Refinement history */}
      {showHistory && refinementHistory.length > 0 && (
        <div className="space-y-2" role="list" aria-label="Istoric rafinări">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Rafinări recente:
          </p>
          {refinementHistory.slice(0, 5).map((refinement) => (
            <div
              key={refinement.id}
              role="listitem"
              className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <p className="font-medium text-gray-700 dark:text-gray-300">
                &ldquo;{refinement.instruction}&rdquo;
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {new Date(refinement.createdAt).toLocaleString()} · {refinement.tokensUsed} token-uri
                utilizați
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
