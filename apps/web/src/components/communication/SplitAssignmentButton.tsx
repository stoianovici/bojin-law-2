'use client';

/**
 * SplitAssignmentButton Component
 * OPS-188: Split button for inline email-to-case assignment
 *
 * Replaces ClassificationModal with inline assignment. Shows primary
 * case suggestion on left (80%) and secondary on right (20%) with
 * confidence-based colors.
 *
 * Color coding:
 * - Cyan (#06b6d4): High confidence (70%+)
 * - Yellow (#eab308): Medium confidence (40-69%)
 * - Magenta (#d946ef): Low confidence (<40%)
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Loader2, User, Check } from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface CaseSuggestion {
  id: string;
  title: string;
  confidence: number; // 0.0 - 1.0
  caseNumber?: string;
}

export interface SplitAssignmentButtonProps {
  /** Primary case suggestion (left side, 80% width) */
  primaryCase: CaseSuggestion;
  /** Secondary case suggestion (right side, 20% width) */
  secondaryCase?: CaseSuggestion;
  /** All available suggestions for dropdown */
  allSuggestions?: CaseSuggestion[];
  /** Called when a case is selected for assignment */
  onAssign: (caseId: string) => void;
  /** Called when sender should be marked as personal contact */
  onPersonal?: () => void;
  /** Shows loading state */
  loading?: boolean;
  /** Disables all interactions */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Returns Tailwind classes for confidence-based colors
 */
function getConfidenceStyles(confidence: number): {
  bg: string;
  bgHover: string;
  text: string;
  border: string;
} {
  if (confidence >= 0.7) {
    // High confidence - Cyan
    return {
      bg: 'bg-cyan-500',
      bgHover: 'hover:bg-cyan-600',
      text: 'text-white',
      border: 'border-cyan-600',
    };
  } else if (confidence >= 0.4) {
    // Medium confidence - Yellow
    return {
      bg: 'bg-yellow-500',
      bgHover: 'hover:bg-yellow-600',
      text: 'text-white',
      border: 'border-yellow-600',
    };
  } else {
    // Low confidence - Magenta
    return {
      bg: 'bg-fuchsia-500',
      bgHover: 'hover:bg-fuchsia-600',
      text: 'text-white',
      border: 'border-fuchsia-600',
    };
  }
}

/**
 * Format confidence as percentage string
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

// ============================================================================
// Sub-Components
// ============================================================================

interface DropdownItemProps {
  suggestion: CaseSuggestion;
  onSelect: () => void;
  isSelected?: boolean;
}

function DropdownItem({ suggestion, onSelect, isSelected }: DropdownItemProps) {
  const confidenceStyles = getConfidenceStyles(suggestion.confidence);

  return (
    <button
      onClick={onSelect}
      className={clsx(
        'w-full flex items-center justify-between gap-2 px-3 py-2 text-left',
        'hover:bg-linear-bg-tertiary transition-colors rounded',
        isSelected && 'bg-linear-accent/10'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-linear-text-primary truncate">{suggestion.title}</p>
        {suggestion.caseNumber && <p className="text-xs text-linear-text-tertiary">{suggestion.caseNumber}</p>}
      </div>
      <span
        className={clsx(
          'flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full',
          confidenceStyles.bg,
          confidenceStyles.text
        )}
      >
        {formatConfidence(suggestion.confidence)}
      </span>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SplitAssignmentButton({
  primaryCase,
  secondaryCase,
  allSuggestions = [],
  onAssign,
  onPersonal,
  loading = false,
  disabled = false,
  className,
}: SplitAssignmentButtonProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const handlePrimaryClick = () => {
    if (loading || disabled) return;
    setSelectedId(primaryCase.id);
    onAssign(primaryCase.id);
  };

  const handleSecondaryClick = () => {
    if (loading || disabled) return;
    setIsDropdownOpen((prev) => !prev);
  };

  const handleSuggestionSelect = (caseId: string) => {
    setSelectedId(caseId);
    setIsDropdownOpen(false);
    onAssign(caseId);
  };

  const handlePersonalClick = () => {
    setIsDropdownOpen(false);
    onPersonal?.();
  };

  const primaryStyles = getConfidenceStyles(primaryCase.confidence);
  const secondaryStyles = secondaryCase
    ? getConfidenceStyles(secondaryCase.confidence)
    : primaryStyles;

  const isDisabled = loading || disabled;
  const hasSingleSuggestion = !secondaryCase && allSuggestions.length <= 1;

  // Dropdown suggestions (exclude primary to avoid duplication)
  const dropdownSuggestions =
    allSuggestions.length > 0
      ? allSuggestions.filter((s) => s.id !== primaryCase.id)
      : secondaryCase
        ? [secondaryCase]
        : [];

  // Single suggestion - full width button
  if (hasSingleSuggestion) {
    return (
      <button
        onClick={handlePrimaryClick}
        disabled={isDisabled}
        className={clsx(
          'w-full flex items-center justify-center gap-2 px-4 py-2.5',
          'rounded-lg font-medium text-sm transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          primaryStyles.bg,
          primaryStyles.bgHover,
          primaryStyles.text,
          className
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Se atribuie...</span>
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            <span>Adaugă: {truncateText(primaryCase.title, 30)}</span>
            <span className="ml-auto opacity-75">{formatConfidence(primaryCase.confidence)}</span>
          </>
        )}
      </button>
    );
  }

  // Split button with primary (80%) and secondary (20%)
  return (
    <div ref={buttonRef} className={clsx('relative', className)}>
      <div className="flex rounded-lg overflow-hidden shadow-sm">
        {/* Primary button - 80% */}
        <button
          onClick={handlePrimaryClick}
          disabled={isDisabled}
          className={clsx(
            'flex-[4] flex items-center justify-center gap-2 px-3 py-2.5',
            'font-medium text-sm transition-all border-r',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            primaryStyles.bg,
            primaryStyles.bgHover,
            primaryStyles.text,
            primaryStyles.border
          )}
        >
          {loading && selectedId === primaryCase.id ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Se atribuie...</span>
            </>
          ) : (
            <>
              <span className="truncate">Adaugă: {truncateText(primaryCase.title, 25)}</span>
            </>
          )}
        </button>

        {/* Secondary button - 20% (dropdown trigger) */}
        <button
          onClick={handleSecondaryClick}
          disabled={isDisabled}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1 px-2 py-2.5',
            'font-medium text-sm transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            secondaryStyles.bg,
            secondaryStyles.bgHover,
            secondaryStyles.text
          )}
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
        >
          {secondaryCase ? (
            <span className="truncate text-xs">{truncateText(secondaryCase.title, 12)}</span>
          ) : (
            <ChevronDown
              className={clsx('h-4 w-4 transition-transform', isDropdownOpen && 'rotate-180')}
            />
          )}
          <ChevronDown
            className={clsx(
              'h-3 w-3 transition-transform flex-shrink-0',
              isDropdownOpen && 'rotate-180'
            )}
          />
        </button>
      </div>

      {/* Dropdown menu */}
      {isDropdownOpen && (
        <div
          className={clsx(
            'absolute z-50 mt-1 w-full min-w-[280px] max-h-64 overflow-y-auto',
            'bg-linear-bg-secondary rounded-lg shadow-lg border border-linear-border-subtle',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
          role="listbox"
        >
          <div className="p-2 space-y-1">
            {/* All case suggestions */}
            {dropdownSuggestions.map((suggestion) => (
              <DropdownItem
                key={suggestion.id}
                suggestion={suggestion}
                onSelect={() => handleSuggestionSelect(suggestion.id)}
                isSelected={selectedId === suggestion.id}
              />
            ))}

            {/* Separator */}
            {onPersonal && dropdownSuggestions.length > 0 && (
              <div className="border-t border-linear-border-subtle my-2" />
            )}

            {/* Personal contact option */}
            {onPersonal && (
              <button
                onClick={handlePersonalClick}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-left',
                  'hover:bg-linear-bg-tertiary transition-colors rounded',
                  'text-linear-text-tertiary'
                )}
              >
                <User className="h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">Contact personal</p>
                  <p className="text-xs text-linear-text-muted">
                    Nu mai sincroniza emailuri de la acest expeditor
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

SplitAssignmentButton.displayName = 'SplitAssignmentButton';

export default SplitAssignmentButton;
