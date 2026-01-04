/**
 * MobileBriefing Component
 * OPS-310: Lightweight typography-first morning briefing for mobile
 *
 * Adapts desktop MorningBriefing for mobile with:
 * - AI summary as highlighted text block
 * - Key deadlines inline (no collapsible)
 * - Prioritized tasks as compact list
 * - Risk alerts for high severity only
 * - Newspaper-style typography (matches BriefRow pattern)
 */

'use client';

import React from 'react';
import { useMorningBriefing } from '../../hooks/useMorningBriefing';
import { AlertTriangle, Clock, Sparkles, CheckCircle2 } from 'lucide-react';

export function MobileBriefing() {
  const { loading, error, hasBriefing, summary, prioritizedTasks, keyDeadlines, riskAlerts } =
    useMorningBriefing();

  if (loading) {
    return <MobileBriefingSkeleton />;
  }

  if (error || !hasBriefing) {
    return null; // Graceful degradation - show feed instead
  }

  const highRiskAlerts = riskAlerts.filter((a) => a.severity === 'high');

  // Don't render if no content
  if (
    !summary &&
    keyDeadlines.length === 0 &&
    prioritizedTasks.length === 0 &&
    highRiskAlerts.length === 0
  ) {
    return null;
  }

  return (
    <div className="px-4 py-3 space-y-4">
      {/* AI Summary Block */}
      {summary && (
        <div className="bg-linear-accent-muted border-l-4 border-linear-accent p-3 rounded-r-lg">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-linear-accent mt-0.5 flex-shrink-0" />
            <p className="text-[15px] text-linear-text-primary leading-relaxed">{summary}</p>
          </div>
        </div>
      )}

      {/* High Risk Alerts - Show first if present */}
      {highRiskAlerts.length > 0 && (
        <div className="bg-linear-error/10 border border-linear-error/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-linear-error mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-linear-error">{highRiskAlerts[0].type}</p>
              <p className="text-sm text-linear-text-secondary mt-0.5">
                {highRiskAlerts[0].description}
              </p>
              {highRiskAlerts[0].suggestedAction && (
                <p className="text-xs text-linear-error mt-1 font-medium">
                  → {highRiskAlerts[0].suggestedAction}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Key Deadlines */}
      {keyDeadlines.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-linear-text-muted uppercase tracking-wider mb-2">
            Termene
          </h3>
          <div className="space-y-2">
            {keyDeadlines.slice(0, 3).map((deadline, i) => (
              <div key={deadline.id || i} className="flex items-center gap-2">
                <Clock
                  className={`w-4 h-4 flex-shrink-0 ${
                    deadline.severity === 'critical' ? 'text-linear-error' : 'text-linear-warning'
                  }`}
                />
                <span className="text-[15px] text-linear-text-primary flex-1 line-clamp-1">
                  {deadline.title}
                </span>
                <span
                  className={`text-sm font-medium whitespace-nowrap ${
                    deadline.daysUntilDue <= 0
                      ? 'text-linear-error'
                      : deadline.daysUntilDue <= 1
                        ? 'text-linear-warning'
                        : 'text-linear-text-tertiary'
                  }`}
                >
                  {deadline.daysUntilDue <= 0
                    ? 'Depășit'
                    : deadline.daysUntilDue === 1
                      ? 'Mâine'
                      : `${deadline.daysUntilDue} zile`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prioritized Tasks */}
      {prioritizedTasks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-linear-text-muted uppercase tracking-wider mb-2">
            De făcut azi
          </h3>
          <div className="space-y-1.5">
            {prioritizedTasks.slice(0, 5).map((pt) => (
              <div key={pt.taskId} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-linear-accent flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-[15px] text-linear-text-primary line-clamp-1">
                    {pt.task?.title}
                  </span>
                  {pt.task?.case && (
                    <span className="text-xs text-linear-text-tertiary block truncate">
                      {pt.task.case.title}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function MobileBriefingSkeleton() {
  return (
    <div className="px-4 py-3 space-y-4 animate-pulse">
      {/* Summary skeleton */}
      <div className="bg-linear-bg-tertiary h-20 rounded-lg" />

      {/* Deadlines skeleton */}
      <div className="space-y-2">
        <div className="bg-linear-bg-tertiary h-4 w-20 rounded" />
        <div className="bg-linear-bg-tertiary h-5 w-full rounded" />
        <div className="bg-linear-bg-tertiary h-5 w-3/4 rounded" />
      </div>

      {/* Tasks skeleton */}
      <div className="space-y-2">
        <div className="bg-linear-bg-tertiary h-4 w-24 rounded" />
        <div className="bg-linear-bg-tertiary h-5 w-full rounded" />
        <div className="bg-linear-bg-tertiary h-5 w-5/6 rounded" />
        <div className="bg-linear-bg-tertiary h-5 w-4/5 rounded" />
      </div>
    </div>
  );
}

// Export skeleton separately for flexibility
export { MobileBriefingSkeleton };
