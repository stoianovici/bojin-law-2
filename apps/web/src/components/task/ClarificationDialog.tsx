/**
 * ClarificationDialog Component
 * Story 4.1: Natural Language Task Parser - Task 11
 *
 * Dialog for resolving ambiguous input during task parsing.
 * Shows options and allows free text input when applicable.
 */

'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ClarificationQuestion, ClarificationOption } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export interface ClarificationDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void;
  /** The clarification question to display */
  question: ClarificationQuestion | null;
  /** Callback when user submits an answer */
  onAnswer: (questionId: string, answer: string) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Detected language for labels */
  language?: 'ro' | 'en';
}

// ============================================================================
// Labels
// ============================================================================

const LABELS = {
  ro: {
    title: 'Clarificare necesară',
    selectOption: 'Selectează o opțiune',
    orEnterManually: 'sau introdu manual',
    placeholder: 'Introdu răspunsul...',
    submit: 'Confirmă',
    cancel: 'Anulează',
    skip: 'Omite',
    entityTypes: {
      case: 'Dosar',
      assignee: 'Persoană responsabilă',
      taskType: 'Tip sarcină',
      date: 'Data',
    },
  },
  en: {
    title: 'Clarification needed',
    selectOption: 'Select an option',
    orEnterManually: 'or enter manually',
    placeholder: 'Enter your answer...',
    submit: 'Confirm',
    cancel: 'Cancel',
    skip: 'Skip',
    entityTypes: {
      case: 'Case',
      assignee: 'Assignee',
      taskType: 'Task Type',
      date: 'Date',
    },
  },
};

// ============================================================================
// Entity Icon Component
// ============================================================================

interface EntityIconProps {
  type: string;
  className?: string;
}

function EntityIcon({ type, className }: EntityIconProps) {
  const iconClass = cn('w-5 h-5', className);

  switch (type) {
    case 'case':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      );
    case 'assignee':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      );
    case 'taskType':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      );
    case 'date':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

// ============================================================================
// Option Button Component
// ============================================================================

interface OptionButtonProps {
  option: ClarificationOption;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function OptionButton({ option, isSelected, onClick, disabled }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full p-3 text-left rounded-lg border-2 transition-all',
        'hover:border-blue-400 hover:bg-blue-50',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isSelected
          ? 'border-blue-500 bg-blue-50 text-blue-900'
          : 'border-gray-200 bg-white text-gray-700'
      )}
    >
      <div className="font-medium">{option.label}</div>
      {option.context && (
        <div className="text-sm text-gray-500 mt-1">{option.context}</div>
      )}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ClarificationDialog({
  open,
  onOpenChange,
  question,
  onAnswer,
  isLoading = false,
  language = 'ro',
}: ClarificationDialogProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeTextValue, setFreeTextValue] = useState('');
  const [useFreeText, setUseFreeText] = useState(false);

  const labels = LABELS[language];

  // Reset state when question changes
  React.useEffect(() => {
    setSelectedOption(null);
    setFreeTextValue('');
    setUseFreeText(false);
  }, [question?.id]);

  const handleSubmit = () => {
    if (!question) return;

    const answer = useFreeText ? freeTextValue : selectedOption;
    if (answer) {
      onAnswer(question.id, answer);
    }
  };

  const handleSkip = () => {
    if (!question) return;
    onAnswer(question.id, '');
    onOpenChange(false);
  };

  const canSubmit = useFreeText ? freeTextValue.trim().length > 0 : selectedOption !== null;

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600">
              <EntityIcon type={question.entityType} />
            </div>
            <div>
              <DialogTitle>{labels.title}</DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                {labels.entityTypes[question.entityType as keyof typeof labels.entityTypes] ||
                  question.entityType}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Question text */}
        <div className="py-2">
          <p className="text-gray-800 font-medium">{question.question}</p>
        </div>

        {/* Options */}
        {question.options && question.options.length > 0 && !useFreeText && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">{labels.selectOption}:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {question.options.map((option) => (
                <OptionButton
                  key={option.value}
                  option={option}
                  isSelected={selectedOption === option.value}
                  onClick={() => setSelectedOption(option.value)}
                  disabled={isLoading}
                />
              ))}
            </div>
          </div>
        )}

        {/* Free text input */}
        {question.allowFreeText && (
          <div className="space-y-2">
            {question.options && question.options.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-200" />
                <button
                  type="button"
                  onClick={() => setUseFreeText(!useFreeText)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {labels.orEnterManually}
                </button>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}

            {(useFreeText || !question.options || question.options.length === 0) && (
              <input
                type="text"
                value={freeTextValue}
                onChange={(e) => setFreeTextValue(e.target.value)}
                placeholder={labels.placeholder}
                disabled={isLoading}
                className={cn(
                  'w-full px-3 py-2 border rounded-lg text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isLoading}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {labels.skip}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              {labels.cancel}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isLoading}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                'bg-blue-600 text-white hover:bg-blue-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin w-4 h-4"
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
                  <span>...</span>
                </span>
              ) : (
                labels.submit
              )}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Inline Clarification Component (for embedding in forms)
// ============================================================================

export interface InlineClarificationProps {
  /** The clarification question to display */
  question: ClarificationQuestion;
  /** Callback when user submits an answer */
  onAnswer: (answer: string) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Detected language for labels */
  language?: 'ro' | 'en';
  /** Additional class names */
  className?: string;
}

export function InlineClarification({
  question,
  onAnswer,
  isLoading = false,
  language = 'ro',
  className,
}: InlineClarificationProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeTextValue, setFreeTextValue] = useState('');
  const [showFreeText, setShowFreeText] = useState(false);

  const labels = LABELS[language];

  const handleSelect = (value: string) => {
    setSelectedOption(value);
    onAnswer(value);
  };

  const handleFreeTextSubmit = () => {
    if (freeTextValue.trim()) {
      onAnswer(freeTextValue.trim());
    }
  };

  return (
    <div className={cn('bg-amber-50 border border-amber-200 rounded-lg p-4', className)}>
      {/* Question */}
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-shrink-0 mt-0.5">
          <EntityIcon type={question.entityType} className="w-4 h-4 text-amber-600" />
        </div>
        <p className="text-sm font-medium text-amber-800">{question.question}</p>
      </div>

      {/* Options as chips */}
      {question.options && question.options.length > 0 && !showFreeText && (
        <div className="flex flex-wrap gap-2 mb-2">
          {question.options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              disabled={isLoading}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full border transition-all',
                'hover:border-amber-400 hover:bg-amber-100',
                'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                selectedOption === option.value
                  ? 'border-amber-500 bg-amber-100 text-amber-900'
                  : 'border-amber-300 bg-white text-amber-800'
              )}
              title={option.context || undefined}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Free text toggle and input */}
      {question.allowFreeText && (
        <div className="mt-2">
          {!showFreeText && question.options && question.options.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowFreeText(true)}
              className="text-xs text-amber-600 hover:text-amber-700"
            >
              {labels.orEnterManually}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={freeTextValue}
                onChange={(e) => setFreeTextValue(e.target.value)}
                placeholder={labels.placeholder}
                disabled={isLoading}
                className="flex-1 px-3 py-1.5 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFreeTextSubmit();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleFreeTextSubmit}
                disabled={!freeTextValue.trim() || isLoading}
                className="px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                OK
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ClarificationDialog;
