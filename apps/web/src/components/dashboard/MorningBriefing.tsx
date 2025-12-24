/**
 * MorningBriefing - AI-generated morning briefing component
 * Story 5.4: Proactive AI Suggestions System (Task 21)
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { PrioritizedTaskCard } from './PrioritizedTaskCard';
import { useMorningBriefing } from '@/hooks/useMorningBriefing';
import type { DeadlineInfo, RiskAlert, ProactiveAISuggestion } from '@legal-platform/types';

// Use the correct AISuggestion type (GraphQL-compatible)
type AISuggestion = ProactiveAISuggestion;

// Icons (inline SVG for simplicity)
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
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

const AlertTriangleIcon = ({ className }: { className?: string }) => (
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

const LightbulbIcon = ({ className }: { className?: string }) => (
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
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

export interface MorningBriefingProps {
  onTaskStart?: (taskId: string) => void;
  onTaskReschedule?: (taskId: string) => void;
  onTaskDelegate?: (taskId: string) => void;
  onSuggestionAccept?: (suggestion: AISuggestion) => void;
  onSuggestionDismiss?: (suggestionId: string) => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  headingLevel?: 'h2' | 'h3';
}

function CollapsibleSection({
  title,
  icon,
  count,
  defaultOpen = true,
  children,
  headingLevel = 'h3',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const HeadingTag = headingLevel;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 transition-colors"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2">
            {icon}
            <HeadingTag className="text-base font-medium">{title}</HeadingTag>
            <Badge variant="secondary" className="ml-2">
              {count}
            </Badge>
          </div>
          <ChevronDownIcon
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

const severityColors = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
};

const riskSeverityColors = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
};

/**
 * MorningBriefing displays the AI-generated daily briefing with
 * prioritized tasks, deadlines, risk alerts, and suggestions.
 */
export function MorningBriefing({
  onTaskStart,
  onTaskReschedule,
  onTaskDelegate,
  onSuggestionAccept,
  onSuggestionDismiss,
}: MorningBriefingProps) {
  const {
    briefing,
    loading,
    error,
    hasBriefing,
    markViewed,
    generateBriefing,
    summary,
    prioritizedTasks,
    keyDeadlines,
    riskAlerts,
    suggestions,
    isViewed,
  } = useMorningBriefing();

  // Mark as viewed when component mounts with briefing
  useEffect(() => {
    if (hasBriefing && !isViewed) {
      markViewed();
    }
  }, [hasBriefing, isViewed, markViewed]);

  if (loading) {
    return (
      <Card role="region" aria-label="Morning briefing" aria-busy="true">
        <CardHeader className="flex flex-row items-center gap-3">
          <SparklesIcon className="text-primary animate-pulse" />
          <CardTitle>Briefing-ul de Dimineață</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card role="region" aria-label="Morning briefing">
        <CardHeader className="flex flex-row items-center gap-3">
          <SparklesIcon className="text-muted-foreground" />
          <CardTitle>Briefing-ul de Dimineață</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Nu am putut încărca briefing-ul. Vă rugăm încercați din nou.
            </p>
            <Button onClick={() => generateBriefing()}>
              <RefreshIcon className="mr-2" />
              Reîncarcă
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasBriefing) {
    return (
      <Card role="region" aria-label="Morning briefing">
        <CardHeader className="flex flex-row items-center gap-3">
          <SparklesIcon className="text-primary" />
          <CardTitle>Briefing-ul de Dimineață</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Nu există un briefing pentru astăzi. Generați unul acum?
            </p>
            <Button onClick={() => generateBriefing()}>
              <SparklesIcon className="mr-2 h-4 w-4" />
              Generează Briefing
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card role="region" aria-label="Morning briefing">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <SparklesIcon className="text-primary" />
          <div>
            <CardTitle>Briefing-ul de Dimineață</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {briefing?.briefingDate
                ? new Date(briefing.briefingDate).toLocaleDateString('ro-RO', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : 'Astăzi'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => generateBriefing()}>
          <RefreshIcon className="mr-1" />
          Actualizează
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* AI Summary Section */}
        {summary && (
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/10" aria-live="polite">
            <h3 className="sr-only">Rezumat AI</h3>
            <p className="text-sm leading-relaxed">{summary}</p>
          </div>
        )}

        {/* Prioritized Tasks Section */}
        <CollapsibleSection
          title="Task-uri Prioritizate"
          icon={<ClockIcon className="text-blue-600" />}
          count={prioritizedTasks.length}
          defaultOpen={true}
          headingLevel="h3"
        >
          {prioritizedTasks.length > 0 ? (
            <div className="space-y-3">
              {prioritizedTasks.map((pt) => (
                <PrioritizedTaskCard
                  key={pt.taskId}
                  data={pt}
                  onStart={onTaskStart}
                  onReschedule={onTaskReschedule}
                  onDelegate={onTaskDelegate}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nu aveți task-uri prioritizate pentru astăzi.
            </p>
          )}
        </CollapsibleSection>

        {/* Key Deadlines Section */}
        <CollapsibleSection
          title="Termene Cheie"
          icon={<ClockIcon className="text-orange-600" />}
          count={keyDeadlines.length}
          defaultOpen={keyDeadlines.some((d: DeadlineInfo) => d.severity === 'critical')}
          headingLevel="h3"
        >
          {keyDeadlines.length > 0 ? (
            <div className="space-y-2">
              {keyDeadlines.map((deadline: DeadlineInfo, index: number) => (
                <div
                  key={deadline.id || index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    severityColors[deadline.severity] || severityColors.info
                  }`}
                >
                  <div>
                    <p className="font-medium">{deadline.title}</p>
                    <p className="text-sm opacity-80">
                      {deadline.daysUntilDue <= 0
                        ? 'Depășit!'
                        : deadline.daysUntilDue === 1
                          ? 'Mâine'
                          : `În ${deadline.daysUntilDue} zile`}
                    </p>
                  </div>
                  <Badge
                    className={
                      deadline.severity === 'critical'
                        ? 'bg-red-600 text-white'
                        : deadline.severity === 'warning'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-blue-600 text-white'
                    }
                  >
                    {deadline.severity === 'critical'
                      ? 'Critic'
                      : deadline.severity === 'warning'
                        ? 'Atenție'
                        : 'Info'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nu aveți termene cheie în această perioadă.
            </p>
          )}
        </CollapsibleSection>

        {/* Risk Alerts Section */}
        {riskAlerts.length > 0 && (
          <CollapsibleSection
            title="Alerte de Risc"
            icon={<AlertTriangleIcon className="text-red-600" />}
            count={riskAlerts.length}
            defaultOpen={riskAlerts.some((r: RiskAlert) => r.severity === 'high')}
            headingLevel="h3"
          >
            <div className="space-y-2">
              {riskAlerts.map((alert: RiskAlert, index: number) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    riskSeverityColors[alert.severity] || riskSeverityColors.low
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{alert.type}</p>
                      <p className="text-sm mt-1">{alert.description}</p>
                    </div>
                    <Badge
                      className={
                        alert.severity === 'high'
                          ? 'bg-red-600 text-white'
                          : alert.severity === 'medium'
                            ? 'bg-yellow-600 text-white'
                            : 'bg-blue-600 text-white'
                      }
                    >
                      {alert.severity === 'high'
                        ? 'Ridicat'
                        : alert.severity === 'medium'
                          ? 'Mediu'
                          : 'Scăzut'}
                    </Badge>
                  </div>
                  {alert.suggestedAction && (
                    <p className="text-sm mt-2 text-muted-foreground">
                      <span className="font-medium">Acțiune sugerată:</span> {alert.suggestedAction}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* AI Suggestions Section */}
        <CollapsibleSection
          title="Sugestii AI"
          icon={<LightbulbIcon className="text-purple-600" />}
          count={suggestions.length}
          defaultOpen={suggestions.length > 0}
          headingLevel="h3"
        >
          {suggestions.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((suggestion: AISuggestion) => (
                <div
                  key={suggestion.id}
                  className="p-3 rounded-lg border bg-purple-50 border-purple-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-purple-900">{suggestion.title}</p>
                      <p className="text-sm mt-1 text-purple-700">{suggestion.description}</p>
                    </div>
                    <Badge
                      className={
                        suggestion.priority === 'Urgent'
                          ? 'bg-red-600 text-white'
                          : suggestion.priority === 'High'
                            ? 'bg-orange-600 text-white'
                            : 'bg-purple-600 text-white'
                      }
                    >
                      {suggestion.priority === 'Urgent'
                        ? 'Urgent'
                        : suggestion.priority === 'High'
                          ? 'Important'
                          : 'Normal'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" onClick={() => onSuggestionAccept?.(suggestion)}>
                      Acceptă
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSuggestionDismiss?.(suggestion.id)}
                    >
                      Respinge
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nu există sugestii AI pentru moment.
            </p>
          )}
        </CollapsibleSection>
      </CardContent>
    </Card>
  );
}

MorningBriefing.displayName = 'MorningBriefing';
