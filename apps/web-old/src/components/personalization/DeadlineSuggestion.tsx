'use client';

import * as React from 'react';
import { CalendarClock, Lightbulb, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useSuggestDeadline, getConfidenceLabel } from '@/hooks/useResponsePatterns';

export interface DeadlineSuggestionProps {
  taskType: string;
  caseType?: string;
  currentDueDate?: string;
  onAccept: (date: string) => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * AI-powered deadline suggestion component
 * Shows suggested due date based on user's historical response patterns
 * Story 5.6: AI Learning and Personalization (Task 36)
 */
export function DeadlineSuggestion({
  taskType,
  caseType,
  currentDueDate,
  onAccept,
  onDismiss,
  className = '',
}: DeadlineSuggestionProps) {
  const { suggestion, loading, hasSuggestion } = useSuggestDeadline(taskType, caseType);
  const [isDismissed, setIsDismissed] = React.useState(false);

  // Reset dismissed state when task type changes
  React.useEffect(() => {
    setIsDismissed(false);
  }, [taskType]);

  // Don't show if dismissed, loading, no suggestion, or already has due date matching suggestion
  if (isDismissed || loading || !hasSuggestion || !suggestion) {
    return null;
  }

  const suggestedDate = new Date(suggestion.suggestedDate);
  const formattedDate = suggestedDate.toLocaleDateString('ro-RO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const isoDate = suggestedDate.toISOString().split('T')[0];

  // Don't show if current due date matches suggested date
  if (currentDueDate === isoDate) {
    return null;
  }

  const confidenceLabel = getConfidenceLabel(suggestion.confidence);
  const confidenceColor = getConfidenceColor(suggestion.confidence);

  const handleAccept = () => {
    onAccept(isoDate);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}
      role="region"
      aria-label="Sugestie termen limită AI"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-1.5 bg-blue-100 rounded-full">
          <Lightbulb className="h-4 w-4 text-blue-600" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-blue-900">Sugestie AI pentru termen</span>
            <SimpleTooltip
              content={`Bazat pe ${suggestion.basedOnSamples} sarcini similare anterioare`}
            >
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full cursor-help ${confidenceColor}`}
                aria-label={`Încredere: ${confidenceLabel}`}
              >
                {confidenceLabel}
              </span>
            </SimpleTooltip>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span className="text-sm text-blue-800 font-medium">{formattedDate}</span>
          </div>

          <p className="text-xs text-blue-700 mb-3">{suggestion.reasoning}</p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={handleAccept}
              aria-label={`Acceptă termenul sugerat: ${formattedDate}`}
            >
              <Check className="h-3 w-3 mr-1" aria-hidden="true" />
              Acceptă
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-3 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-100"
              onClick={handleDismiss}
              aria-label="Respinge sugestia"
            >
              <X className="h-3 w-3 mr-1" aria-hidden="true" />
              Ignoră
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact inline version of deadline suggestion
 */
export function DeadlineSuggestionInline({
  taskType,
  caseType,
  currentDueDate,
  onAccept,
}: Omit<DeadlineSuggestionProps, 'onDismiss' | 'className'>) {
  const { suggestion, loading, hasSuggestion } = useSuggestDeadline(taskType, caseType);

  if (loading || !hasSuggestion || !suggestion) {
    return null;
  }

  const suggestedDate = new Date(suggestion.suggestedDate);
  const isoDate = suggestedDate.toISOString().split('T')[0];

  // Don't show if current due date matches suggested date
  if (currentDueDate === isoDate) {
    return null;
  }

  const shortDate = suggestedDate.toLocaleDateString('ro-RO', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <button
      type="button"
      onClick={() => onAccept(isoDate)}
      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
      aria-label={`Folosește data sugerată: ${shortDate}`}
    >
      <Lightbulb className="h-3 w-3" aria-hidden="true" />
      <span>Sugerare: {shortDate}</span>
    </button>
  );
}

/**
 * Loading skeleton for deadline suggestion
 */
export function DeadlineSuggestionSkeleton() {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    </div>
  );
}

// Helper function for confidence colors
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'bg-green-100 text-green-800';
  if (confidence >= 0.7) return 'bg-blue-100 text-blue-800';
  if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-800';
}

export default DeadlineSuggestion;
