/**
 * NLPTaskCreator Component
 * Story 4.1: Natural Language Task Parser - Task 13
 *
 * Integrated component for creating tasks using natural language.
 * Combines CommandPaletteInput, TaskParsePreview, and ClarificationDialog.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useNLPTaskParser, type TaskParseContext } from '@/hooks/useNLPTaskParser';
import { CommandPaletteInput } from './CommandPaletteInput';
import { TaskParsePreview } from './TaskParsePreview';
import { ClarificationDialog, InlineClarification } from './ClarificationDialog';
import type { TaskCorrections } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export interface NLPTaskCreatorProps {
  /** Context for parsing (cases, team members) */
  context?: TaskParseContext;
  /** Callback when task is created successfully */
  onTaskCreated?: (task: any) => void;
  /** Callback when task creation is cancelled */
  onCancel?: () => void;
  /** Display mode: 'inline' shows preview inline, 'dialog' shows in modal */
  mode?: 'inline' | 'compact';
  /** Language */
  language?: 'ro' | 'en';
  /** Auto-focus the input */
  autoFocus?: boolean;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Labels
// ============================================================================

const LABELS = {
  ro: {
    title: 'Creează sarcină nouă',
    subtitle: 'Descrie sarcina în limbaj natural',
    creating: 'Se creează sarcina...',
    success: 'Sarcină creată cu succes!',
    error: 'Eroare la crearea sarcinii',
    tryAgain: 'Încearcă din nou',
    cancel: 'Anulează',
    needsClarification: 'Clarificare necesară',
    lowConfidence: 'Încredere scăzută - verifică detaliile',
    examples: [
      'Pregătește contract pentru client Ion Popescu până pe 15 decembrie',
      'Cercetare jurisprudență pentru dosar 123/2024',
      'Întâlnire cu echipa luni la ora 10',
      'Termen instanță Tribunalul București marți',
    ],
  },
  en: {
    title: 'Create new task',
    subtitle: 'Describe the task in natural language',
    creating: 'Creating task...',
    success: 'Task created successfully!',
    error: 'Error creating task',
    tryAgain: 'Try again',
    cancel: 'Cancel',
    needsClarification: 'Clarification needed',
    lowConfidence: 'Low confidence - verify details',
    examples: [
      'Prepare contract for client John Smith by December 15',
      'Research case law for case 123/2024',
      'Team meeting Monday at 10am',
      'Court hearing at Bucharest Tribunal Tuesday',
    ],
  },
};

// ============================================================================
// Status Component
// ============================================================================

interface StatusBannerProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onDismiss?: () => void;
}

function StatusBanner({ type, message, onDismiss }: StatusBannerProps) {
  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  };

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-lg border', colors[type])}>
      {icons[type]}
      <span className="flex-1 text-sm font-medium">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Example Chips Component
// ============================================================================

interface ExampleChipsProps {
  examples: string[];
  onSelect: (example: string) => void;
  language: 'ro' | 'en';
}

function ExampleChips({ examples, onSelect, language }: ExampleChipsProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500">
        {language === 'ro' ? 'Exemple:' : 'Examples:'}
      </p>
      <div className="flex flex-wrap gap-2">
        {examples.slice(0, 3).map((example, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(example)}
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
          >
            {example.length > 40 ? `${example.substring(0, 40)}...` : example}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function NLPTaskCreator({
  context,
  onTaskCreated,
  onCancel,
  mode = 'inline',
  language = 'ro',
  autoFocus = false,
  className,
}: NLPTaskCreatorProps) {
  const [status, setStatus] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');
  const [corrections, setCorrections] = useState<TaskCorrections>({});
  const [clarificationOpen, setClarificationOpen] = useState(false);

  const labels = LABELS[language];

  const {
    inputText,
    setInputText,
    parseResult,
    isLoading,
    error,
    suggestions,
    parseInput,
    resolveClarification,
    confirmTask,
    reset,
    needsClarification,
    currentClarification,
    confidenceLevel,
    parsedFields,
  } = useNLPTaskParser({
    context,
    debounceMs: 500,
    minCharsForParse: 10,
    autoParse: true,
  });

  // Handle submit (parse input)
  const handleSubmit = useCallback(async () => {
    if (!inputText.trim()) return;
    await parseInput();
  }, [inputText, parseInput]);

  // Handle field edit
  const handleFieldEdit = useCallback((field: string, value: string) => {
    setCorrections((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Handle clarification answer
  const handleClarificationAnswer = useCallback(
    async (questionId: string, answer: string) => {
      setClarificationOpen(false);
      await resolveClarification(questionId, answer);
    },
    [resolveClarification]
  );

  // Handle confirm task creation
  const handleConfirm = useCallback(async () => {
    try {
      setStatus('creating');
      const task = await confirmTask(corrections);
      setStatus('success');
      onTaskCreated?.(task);

      // Reset after success
      setTimeout(() => {
        reset();
        setStatus('idle');
        setCorrections({});
      }, 2000);
    } catch (err) {
      setStatus('error');
      console.error('Task creation failed:', err);
    }
  }, [confirmTask, corrections, onTaskCreated, reset]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    reset();
    setCorrections({});
    setStatus('idle');
    onCancel?.();
  }, [reset, onCancel]);

  // Handle example selection
  const handleExampleSelect = useCallback(
    (example: string) => {
      setInputText(example);
    },
    [setInputText]
  );

  // Open clarification dialog when needed
  React.useEffect(() => {
    if (needsClarification && currentClarification && mode === 'inline') {
      setClarificationOpen(true);
    }
  }, [needsClarification, currentClarification, mode]);

  const showPreview = parseResult && parsedFields && !isLoading;
  const showExamples = !inputText && !parseResult;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{labels.title}</h2>
          <p className="text-sm text-gray-500">{labels.subtitle}</p>
        </div>
        {onCancel && (
          <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Status banners */}
      {status === 'success' && <StatusBanner type="success" message={labels.success} />}
      {status === 'error' && (
        <StatusBanner type="error" message={labels.error} onDismiss={() => setStatus('idle')} />
      )}
      {error && status === 'idle' && (
        <StatusBanner type="error" message={error.message} onDismiss={() => {}} />
      )}

      {/* Command palette input */}
      <CommandPaletteInput
        value={inputText}
        onChange={setInputText}
        onSubmit={handleSubmit}
        suggestions={suggestions}
        entities={parseResult?.entities}
        isLoading={isLoading}
        autoFocus={autoFocus}
        language={language}
        disabled={status === 'creating'}
      />

      {/* Example chips */}
      {showExamples && (
        <ExampleChips
          examples={labels.examples}
          onSelect={handleExampleSelect}
          language={language}
        />
      )}

      {/* Inline clarifications */}
      {needsClarification && currentClarification && mode === 'compact' && (
        <InlineClarification
          question={currentClarification}
          onAnswer={(answer) => handleClarificationAnswer(currentClarification.id, answer)}
          isLoading={isLoading}
          language={language}
        />
      )}

      {/* Low confidence warning */}
      {showPreview && confidenceLevel === 'low' && (
        <StatusBanner type="warning" message={labels.lowConfidence} />
      )}

      {/* Parse preview */}
      {showPreview && (
        <TaskParsePreview
          parsedFields={parsedFields}
          entities={parseResult?.entities}
          originalText={parseResult?.originalText}
          overallConfidence={parseResult?.overallConfidence}
          detectedLanguage={parseResult?.detectedLanguage as 'ro' | 'en'}
          isLoading={status === 'creating'}
          allowEditing={true}
          onFieldEdit={handleFieldEdit}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Creating spinner */}
      {status === 'creating' && (
        <div className="flex items-center justify-center gap-3 py-4 text-gray-600">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
          <span className="text-sm font-medium">{labels.creating}</span>
        </div>
      )}

      {/* Clarification dialog */}
      <ClarificationDialog
        open={clarificationOpen && mode === 'inline'}
        onOpenChange={setClarificationOpen}
        question={currentClarification}
        onAnswer={handleClarificationAnswer}
        isLoading={isLoading}
        language={language}
      />
    </div>
  );
}

// ============================================================================
// Export index file helper
// ============================================================================

export { CommandPaletteInput } from './CommandPaletteInput';
export { TaskParsePreview } from './TaskParsePreview';
export { ClarificationDialog, InlineClarification } from './ClarificationDialog';

export default NLPTaskCreator;
