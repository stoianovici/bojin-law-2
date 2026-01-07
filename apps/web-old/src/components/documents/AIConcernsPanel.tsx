'use client';

/**
 * AI Concerns Panel
 * Story 3.6: Document Review and Approval Workflow
 *
 * Displays AI-flagged concerns with severity indicators and dismiss functionality
 */

import * as React from 'react';
import { AlertTriangle, AlertCircle, Info, Check, X, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AIReviewConcern {
  id: string;
  concernType: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  description: string;
  anchorText: string;
  anchorStart: number;
  anchorEnd: number;
  sectionPath?: string;
  suggestedFix?: string;
  aiConfidence: number;
  dismissed: boolean;
}

interface AIConcernsPanelProps {
  concerns: AIReviewConcern[];
  onDismiss: (concernId: string) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onNavigateToConcern?: (anchorStart: number, anchorEnd: number) => void;
  isLoading?: boolean;
}

const severityConfig = {
  ERROR: {
    icon: AlertCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    label: 'Critical',
    badgeVariant: 'destructive' as const,
  },
  WARNING: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Warning',
    badgeVariant: 'secondary' as const,
  },
  INFO: {
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Suggestion',
    badgeVariant: 'outline' as const,
  },
};

const concernTypeLabels: Record<string, string> = {
  LEGAL_INCONSISTENCY: 'Legal Inconsistency',
  AMBIGUOUS_LANGUAGE: 'Ambiguous Language',
  MISSING_CLAUSE: 'Missing Clause',
  OUTDATED_REFERENCE: 'Outdated Reference',
  COMPLIANCE_ISSUE: 'Compliance Issue',
  STYLE_VIOLATION: 'Style Violation',
  HIGH_RISK_CLAUSE: 'High Risk Clause',
};

export function AIConcernsPanel({
  concerns,
  onDismiss,
  onRegenerate,
  onNavigateToConcern,
  isLoading = false,
}: AIConcernsPanelProps) {
  const [expandedConcerns, setExpandedConcerns] = React.useState<Set<string>>(new Set());
  const [dismissingId, setDismissingId] = React.useState<string | null>(null);

  const activeConcerns = concerns.filter((c) => !c.dismissed);
  const dismissedConcerns = concerns.filter((c) => c.dismissed);

  // Group by severity
  const errorCount = activeConcerns.filter((c) => c.severity === 'ERROR').length;
  const warningCount = activeConcerns.filter((c) => c.severity === 'WARNING').length;
  const infoCount = activeConcerns.filter((c) => c.severity === 'INFO').length;

  const toggleExpanded = (id: string) => {
    setExpandedConcerns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDismiss = async (concernId: string) => {
    setDismissingId(concernId);
    try {
      await onDismiss(concernId);
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI Analysis
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Re-analyze
          </Button>
        </div>

        {/* Summary badges */}
        <div className="flex gap-2 mt-2">
          {errorCount > 0 && <Badge variant="destructive">{errorCount} Critical</Badge>}
          {warningCount > 0 && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              {warningCount} Warnings
            </Badge>
          )}
          {infoCount > 0 && <Badge variant="outline">{infoCount} Suggestions</Badge>}
          {activeConcerns.length === 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Check className="mr-1 h-3 w-3" />
              No concerns found
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Analyzing document...</span>
          </div>
        ) : activeConcerns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            AI analysis found no significant concerns.
          </p>
        ) : (
          activeConcerns
            .sort((a, b) => {
              const severityOrder = { ERROR: 0, WARNING: 1, INFO: 2 };
              return severityOrder[a.severity] - severityOrder[b.severity];
            })
            .map((concern) => {
              const config = severityConfig[concern.severity];
              const Icon = config.icon;
              const isExpanded = expandedConcerns.has(concern.id);

              return (
                <Collapsible
                  key={concern.id}
                  open={isExpanded}
                  onOpenChange={() => toggleExpanded(concern.id)}
                >
                  <div className={`rounded-lg border p-3 ${config.bgColor} ${config.borderColor}`}>
                    <CollapsibleTrigger className="flex w-full items-start justify-between gap-2 text-left">
                      <div className="flex items-start gap-2 flex-1">
                        <Icon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {concernTypeLabels[concern.concernType] || concern.concernType}
                            </span>
                            <Badge variant={config.badgeVariant} className="text-xs">
                              {config.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(concern.aiConfidence * 100)}% confidence
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {concern.description}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleDismiss(concern.id);
                        }}
                        disabled={dismissingId === concern.id}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Dismiss</span>
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pt-3 space-y-3">
                      {concern.sectionPath && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Section:</span> {concern.sectionPath}
                        </div>
                      )}

                      <div className="bg-background/50 rounded p-2 text-sm">
                        <span className="font-medium text-xs block mb-1">Relevant text:</span>
                        <p className="italic text-muted-foreground">
                          &quot;{concern.anchorText.substring(0, 200)}
                          {concern.anchorText.length > 200 ? '...' : ''}&quot;
                        </p>
                      </div>

                      {concern.suggestedFix && (
                        <div className="bg-background/50 rounded p-2 text-sm">
                          <span className="font-medium text-xs block mb-1">Suggested fix:</span>
                          <p>{concern.suggestedFix}</p>
                        </div>
                      )}

                      {onNavigateToConcern && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onNavigateToConcern(concern.anchorStart, concern.anchorEnd)
                          }
                        >
                          Navigate to text
                        </Button>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
        )}

        {/* Dismissed concerns (collapsed) */}
        {dismissedConcerns.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Check className="h-4 w-4" />
              {dismissedConcerns.length} dismissed concern
              {dismissedConcerns.length > 1 ? 's' : ''}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              {dismissedConcerns.map((concern) => (
                <div
                  key={concern.id}
                  className="rounded-lg border p-2 bg-muted/30 text-muted-foreground text-sm line-through"
                >
                  {concern.description}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
