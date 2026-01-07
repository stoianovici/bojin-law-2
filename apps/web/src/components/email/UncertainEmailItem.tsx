'use client';

import { Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UncertainEmail, CaseSuggestion } from '@/types/email';

interface UncertainEmailItemProps {
  email: UncertainEmail;
  isSelected: boolean;
  onClick: () => void;
}

export function UncertainEmailItem({ email, isSelected, onClick }: UncertainEmailItemProps) {
  const formattedDate = formatRelativeDate(email.receivedDateTime);

  return (
    <div
      className={cn(
        'px-4 py-3 cursor-pointer transition-colors border-b border-linear-border-subtle',
        'hover:bg-linear-bg-hover',
        isSelected && 'bg-linear-accent/10 border-l-2 border-l-linear-accent'
      )}
      onClick={onClick}
    >
      {/* Header: Sender + Date */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-linear-text-primary">
          {email.from.name || email.from.address}
        </span>
        <span className="text-xs text-linear-text-tertiary flex items-center gap-2">
          {email.hasAttachments && <Paperclip className="h-3 w-3" />}
          {formattedDate}
        </span>
      </div>

      {/* Subject */}
      <div className="text-sm text-linear-text-secondary mb-2 line-clamp-1">
        {email.subject || '(Fără subiect)'}
      </div>

      {/* Case Suggestions */}
      {email.suggestedCases.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {email.suggestedCases.slice(0, 3).map((suggestion) => (
            <CaseSuggestionChip key={suggestion.id} suggestion={suggestion} />
          ))}
          {email.suggestedCases.length > 3 && (
            <span className="text-xs text-linear-text-tertiary self-center">
              +{email.suggestedCases.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface CaseSuggestionChipProps {
  suggestion: CaseSuggestion;
}

function CaseSuggestionChip({ suggestion }: CaseSuggestionChipProps) {
  const confidencePercent = Math.round(suggestion.confidence * 100);
  const colorClass = getConfidenceColorClass(suggestion.confidence);

  // Truncate title if too long
  const displayTitle =
    suggestion.title.length > 25 ? `${suggestion.title.slice(0, 25)}...` : suggestion.title;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
        colorClass
      )}
    >
      <span>{displayTitle}</span>
      <span className="opacity-75">({confidencePercent}%)</span>
    </span>
  );
}

// Get color class based on confidence level
function getConfidenceColorClass(confidence: number): string {
  if (confidence >= 0.7) {
    // High confidence - Cyan
    return 'bg-cyan-500/15 text-cyan-400';
  } else if (confidence >= 0.4) {
    // Medium confidence - Yellow
    return 'bg-yellow-500/15 text-yellow-400';
  } else {
    // Low confidence - Magenta
    return 'bg-fuchsia-500/15 text-fuchsia-400';
  }
}

// Helper function for relative dates
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'ieri';
  } else if (diffDays < 7) {
    return `${diffDays} zile`;
  } else {
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
  }
}
