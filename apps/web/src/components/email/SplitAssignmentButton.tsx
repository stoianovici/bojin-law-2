'use client';

import { useState } from 'react';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CaseSuggestion } from '@/types/email';

interface SplitAssignmentButtonProps {
  primaryCase: CaseSuggestion;
  secondaryCase?: CaseSuggestion;
  allSuggestions?: CaseSuggestion[];
  onAssign: (caseId: string) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SplitAssignmentButton({
  primaryCase,
  secondaryCase,
  allSuggestions = [],
  onAssign,
  loading = false,
  disabled = false,
  className,
}: SplitAssignmentButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const handleAssign = async (caseId: string) => {
    setAssigningId(caseId);
    setDropdownOpen(false);
    try {
      await onAssign(caseId);
    } finally {
      setAssigningId(null);
    }
  };

  const primaryColor = getConfidenceColorClasses(primaryCase.confidence);
  const secondaryColor = secondaryCase ? getConfidenceColorClasses(secondaryCase.confidence) : null;

  const isLoading = loading || assigningId !== null;

  return (
    <div className={cn('flex gap-1', className)}>
      {/* Primary Button (80%) */}
      <button
        onClick={() => handleAssign(primaryCase.id)}
        disabled={disabled || isLoading}
        className={cn(
          'flex-[4] flex flex-col items-center justify-center gap-0.5 px-4 py-2.5 rounded-l-lg',
          'transition-colors cursor-pointer',
          primaryColor.bg,
          primaryColor.text,
          primaryColor.hover,
          (disabled || isLoading) && 'opacity-50 cursor-not-allowed'
        )}
      >
        {assigningId === primaryCase.id ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <span className="text-sm font-medium line-clamp-1">{primaryCase.title}</span>
            <span className="text-xs opacity-75">
              {Math.round(primaryCase.confidence * 100)}% încredere
            </span>
          </>
        )}
      </button>

      {/* Secondary Button (20%) with dropdown */}
      {secondaryCase && (
        <div className="relative flex-1">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={disabled || isLoading}
            className={cn(
              'w-full h-full flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 rounded-r-lg',
              'transition-colors cursor-pointer',
              secondaryColor?.bg,
              secondaryColor?.text,
              secondaryColor?.hover,
              (disabled || isLoading) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {assigningId === secondaryCase.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span className="text-xs font-medium line-clamp-1">
                  {truncateTitle(secondaryCase.title, 15)}
                </span>
                <span className="text-xs opacity-75 flex items-center gap-0.5">
                  {Math.round(secondaryCase.confidence * 100)}%
                  <ChevronDown className="h-3 w-3" />
                </span>
              </>
            )}
          </button>

          {/* Dropdown for all suggestions */}
          {dropdownOpen && allSuggestions.length > 0 && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />

              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[250px] max-h-[300px] overflow-y-auto bg-linear-bg-elevated border border-linear-border-subtle rounded-lg shadow-lg">
                {allSuggestions.map((suggestion) => {
                  const color = getConfidenceColorClasses(suggestion.confidence);
                  const isSelected =
                    suggestion.id === primaryCase.id || suggestion.id === secondaryCase?.id;

                  return (
                    <button
                      key={suggestion.id}
                      onClick={() => handleAssign(suggestion.id)}
                      disabled={assigningId === suggestion.id}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-4 py-3',
                        'hover:bg-linear-bg-hover transition-colors',
                        'border-b border-linear-border-subtle last:border-b-0'
                      )}
                    >
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-linear-text-primary line-clamp-1">
                          {suggestion.title}
                        </div>
                        {suggestion.referenceNumbers?.[0] && (
                          <div className="text-xs text-linear-text-tertiary">
                            {suggestion.referenceNumbers[0]}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            color.bg,
                            color.text
                          )}
                        >
                          {Math.round(suggestion.confidence * 100)}%
                        </span>
                        {isSelected && <Check className="h-4 w-4 text-linear-accent" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Single button if no secondary case */}
      {!secondaryCase && (
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={disabled || isLoading || allSuggestions.length <= 1}
          className={cn(
            'flex-1 flex items-center justify-center px-3 py-2.5 rounded-r-lg',
            'bg-linear-bg-tertiary text-linear-text-secondary',
            'hover:bg-linear-bg-hover transition-colors',
            (disabled || isLoading || allSuggestions.length <= 1) && 'opacity-50 cursor-not-allowed'
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Get color classes based on confidence level
function getConfidenceColorClasses(confidence: number): {
  bg: string;
  text: string;
  hover: string;
} {
  if (confidence >= 0.7) {
    // High confidence - Cyan
    return {
      bg: 'bg-cyan-500/15',
      text: 'text-cyan-400',
      hover: 'hover:bg-cyan-500/25',
    };
  } else if (confidence >= 0.4) {
    // Medium confidence - Yellow
    return {
      bg: 'bg-yellow-500/15',
      text: 'text-yellow-400',
      hover: 'hover:bg-yellow-500/25',
    };
  } else {
    // Low confidence - Magenta
    return {
      bg: 'bg-fuchsia-500/15',
      text: 'text-fuchsia-400',
      hover: 'hover:bg-fuchsia-500/25',
    };
  }
}

// Truncate title for display
function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength)}...`;
}
