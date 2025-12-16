/**
 * Draft Generation Panel Component
 * Story 5.3: AI-Powered Email Drafting - Task 15
 *
 * Displays loading state during AI generation and multiple draft options
 * with tone labels and recommendation highlighting.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useGenerateMultipleDrafts } from '@/hooks/useEmailDraft';
import type { EmailTone, EmailDraft } from '@/hooks/useEmailDraft';
import { ToneSelector } from './ToneSelector';
import { Spinner } from '@/components/ui/spinner';

interface DraftGenerationPanelProps {
  emailId: string;
  onDraftSelect: (draft: EmailDraft) => void;
  onCancel: () => void;
}

export function DraftGenerationPanel({
  emailId,
  onDraftSelect,
  onCancel,
}: DraftGenerationPanelProps) {
  const { generate, result, loading, error } = useGenerateMultipleDrafts(emailId);
  const [selectedTone, setSelectedTone] = useState<EmailTone | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Start generating drafts
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await generate();
      if (res?.drafts?.length) {
        // Auto-select recommended tone
        setSelectedTone(res.recommendedTone);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [generate]);

  // Auto-generate on mount
  React.useEffect(() => {
    handleGenerate();
  }, []);

  const handleSelectDraft = useCallback(() => {
    if (!result || !selectedTone) return;
    const draftOption = result.drafts.find((d) => d.tone === selectedTone);
    if (draftOption) {
      onDraftSelect(draftOption.draft);
    }
  }, [result, selectedTone, onDraftSelect]);

  const selectedDraft = result?.drafts.find((d) => d.tone === selectedTone)?.draft;

  if (loading || isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center p-8" aria-busy="true">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">Generating AI drafts...</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">This may take a few seconds</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6" role="alert">
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/30">
          <div className="flex">
            <ErrorIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Draft generation failed
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error.message}</p>
              <div className="mt-4">
                <button
                  onClick={handleGenerate}
                  className="inline-flex items-center rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-800 dark:text-red-200 dark:hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Draft Options</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Select the tone that best fits your response
        </p>
      </div>

      {/* Tone Selection */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <ToneSelector
          tones={result.drafts.map((d) => d.tone)}
          selectedTone={selectedTone}
          recommendedTone={result.recommendedTone}
          recommendationReason={result.recommendationReason}
          onSelect={setSelectedTone}
        />
      </div>

      {/* Draft Preview */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedDraft && (
          <div className="space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Subject
              </label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedDraft.subject}</p>
            </div>

            {/* Body Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Preview
              </label>
              <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {selectedDraft.body}
                </div>
              </div>
            </div>

            {/* Confidence */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Confidence:</span>
              <ConfidenceIndicator confidence={selectedDraft.confidence} />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-gray-200 p-4 dark:border-gray-700">
        <button
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <RefreshIcon className="h-4 w-4" />
          Regenerate
        </button>
        <button
          onClick={handleSelectDraft}
          disabled={!selectedTone}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Use This Draft
        </button>
      </div>
    </div>
  );
}

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  const color =
    percentage >= 80
      ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
      : percentage >= 60
        ? 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30'
        : 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${color}`}
    >
      {percentage}%
    </span>
  );
}

// Icons
function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
