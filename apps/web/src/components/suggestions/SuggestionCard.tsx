/**
 * SuggestionCard - Individual AI suggestion card
 * Story 5.4: Proactive AI Suggestions System (Task 25)
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AISuggestion, SuggestionType, SuggestionPriority } from '@legal-platform/types';

// Icons
const PatternIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
    />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const TaskIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const MailIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="14"
    height="14"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

export interface SuggestionCardProps {
  suggestion: AISuggestion;
  onAccept?: (suggestion: AISuggestion) => void;
  onDismiss?: (suggestionId: string, reason?: string) => void;
  isUrgent?: boolean;
  showExplanation?: boolean;
}

// Type-specific styling
const typeStyles: Record<
  SuggestionType,
  {
    bgColor: string;
    borderColor: string;
    iconColor: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  PatternMatch: {
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    iconColor: 'text-purple-600',
    Icon: PatternIcon,
  },
  DeadlineWarning: {
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    iconColor: 'text-orange-600',
    Icon: ClockIcon,
  },
  DocumentCheck: {
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    iconColor: 'text-yellow-600',
    Icon: DocumentIcon,
  },
  TaskSuggestion: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
    Icon: TaskIcon,
  },
  RiskAlert: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-600',
    Icon: AlertIcon,
  },
  FollowUp: {
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-600',
    Icon: MailIcon,
  },
  MorningBriefing: {
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    iconColor: 'text-indigo-600',
    Icon: TaskIcon,
  },
};

const priorityStyles: Record<SuggestionPriority, { badge: string; label: string }> = {
  Urgent: { badge: 'bg-red-600 text-white', label: 'Urgent' },
  High: { badge: 'bg-orange-600 text-white', label: 'Important' },
  Normal: { badge: 'bg-blue-600 text-white', label: 'Normal' },
  Low: { badge: 'bg-gray-600 text-white', label: 'Scăzut' },
};

function getExplanationText(suggestion: AISuggestion): string {
  switch (suggestion.type) {
    case 'PatternMatch':
      return `Această sugestie este bazată pe tiparele tale de lucru. Am observat că de obicei faci această acțiune în contexte similare.`;
    case 'DeadlineWarning':
      return `Acest termen se apropie sau necesită atenție. AI-ul recomandă să iei măsuri pentru a evita întârzieri.`;
    case 'DocumentCheck':
      return `Am identificat potențiale probleme în documentul curent care ar trebui rezolvate înainte de finalizare.`;
    case 'TaskSuggestion':
      return `Bazat pe contextul curent, această acțiune ar putea fi următorul pas logic în workflow-ul tău.`;
    case 'RiskAlert':
      return `Am detectat un potențial risc care necesită atenția ta. Verifică detaliile și ia măsurile necesare.`;
    case 'FollowUp':
      return `Bazat pe conversațiile recente, ar fi util să urmărești această acțiune.`;
    default:
      return `Sugestie generată de AI bazată pe analiza contextului curent.`;
  }
}

/**
 * SuggestionCard displays an individual AI suggestion with
 * type-specific styling and action buttons.
 */
export function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
  isUrgent = false,
  showExplanation: initialShowExplanation = false,
}: SuggestionCardProps) {
  const [showExplanation, setShowExplanation] = useState(initialShowExplanation);

  const style = typeStyles[suggestion.type] || typeStyles.TaskSuggestion;
  const priorityStyle = priorityStyles[suggestion.priority] || priorityStyles.Normal;
  const Icon = style.Icon;

  // For urgent suggestions, use role="alert"
  const roleAttr = isUrgent || suggestion.priority === 'Urgent' ? 'alert' : 'article';

  return (
    <Card
      role={roleAttr}
      aria-label={`Sugestie: ${suggestion.title}`}
      className={`${style.bgColor} ${style.borderColor} border transition-all duration-200 hover:shadow-md`}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className={style.iconColor} />
            <Badge className={priorityStyle.badge}>{priorityStyle.label}</Badge>
          </div>
          {/* Confidence indicator (subtle) */}
          {suggestion.confidence && suggestion.confidence > 0 && (
            <span
              className="text-xs text-muted-foreground"
              title={`Încredere: ${Math.round(suggestion.confidence * 100)}%`}
            >
              {Math.round(suggestion.confidence * 100)}%
            </span>
          )}
        </div>

        {/* Title & Description */}
        <h4 className="mt-3 font-medium text-foreground" id={`suggestion-title-${suggestion.id}`}>
          {suggestion.title}
        </h4>
        <p
          className="mt-1 text-sm text-muted-foreground"
          id={`suggestion-desc-${suggestion.id}`}
          aria-describedby={`suggestion-title-${suggestion.id}`}
        >
          {suggestion.description}
        </p>

        {/* Case reference if available */}
        {suggestion.case && (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium">Dosar:</span> {suggestion.case.title}
          </p>
        )}

        {/* Why this suggestion? (expandable) */}
        <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
          <CollapsibleTrigger asChild>
            <button
              className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={showExplanation}
            >
              <InfoIcon />
              <span>De ce această sugestie?</span>
              <ChevronDownIcon
                className={`transition-transform duration-200 ${
                  showExplanation ? 'rotate-180' : ''
                }`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <p className="text-xs text-muted-foreground bg-white/50 p-2 rounded border">
              {getExplanationText(suggestion)}
            </p>
          </CollapsibleContent>
        </Collapsible>

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2" role="group" aria-label="Acțiuni sugestie">
          <Button
            size="sm"
            onClick={() => onAccept?.(suggestion)}
            aria-label={`Acceptă sugestia: ${suggestion.title}`}
          >
            Acceptă
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDismiss?.(suggestion.id)}
            aria-label={`Respinge sugestia: ${suggestion.title}`}
          >
            Respinge
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

SuggestionCard.displayName = 'SuggestionCard';

/**
 * Compact version of SuggestionCard for use in lists or widgets
 */
export function SuggestionCardCompact({ suggestion, onAccept, onDismiss }: SuggestionCardProps) {
  const style = typeStyles[suggestion.type] || typeStyles.TaskSuggestion;
  const Icon = style.Icon;

  return (
    <div
      role="article"
      aria-label={`Sugestie: ${suggestion.title}`}
      className={`flex items-center justify-between p-3 rounded-lg ${style.bgColor} ${style.borderColor} border`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Icon className={`${style.iconColor} shrink-0`} />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{suggestion.title}</p>
          <p className="text-xs text-muted-foreground truncate">{suggestion.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 ml-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={() => onAccept?.(suggestion)}
          aria-label="Acceptă"
        >
          ✓
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={() => onDismiss?.(suggestion.id)}
          aria-label="Respinge"
        >
          ✕
        </Button>
      </div>
    </div>
  );
}

SuggestionCardCompact.displayName = 'SuggestionCardCompact';
