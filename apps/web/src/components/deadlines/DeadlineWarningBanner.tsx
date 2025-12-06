/**
 * DeadlineWarningBanner - Banner displaying deadline warnings
 * Story 5.4: Proactive AI Suggestions System (Task 28)
 */

'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DeadlineActionMenu, DeadlineActionButtons } from './DeadlineActionMenu';
import { useDeadlineWarnings, useCaseDeadlineWarnings } from '@/hooks/useDeadlineWarnings';
import type { DeadlineInfo, SuggestedAction } from '@legal-platform/types';

// Icons
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
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
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
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

export interface DeadlineWarningBannerProps {
  caseId?: string;
  onCreateTask?: (deadline: DeadlineInfo) => void;
  onSendReminder?: (deadline: DeadlineInfo) => void;
  onRequestExtension?: (deadline: DeadlineInfo) => void;
  onMarkHandled?: (deadline: DeadlineInfo) => void;
  onActionSelect?: (action: SuggestedAction, deadline: DeadlineInfo) => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  showDismiss?: boolean;
  maxVisible?: number;
  className?: string;
}

const severityConfig = {
  critical: {
    bg: 'bg-red-100',
    border: 'border-red-300',
    icon: 'text-red-600',
    text: 'text-red-900',
    badge: 'bg-red-600 text-white',
    label: 'Critic',
  },
  warning: {
    bg: 'bg-orange-100',
    border: 'border-orange-300',
    icon: 'text-orange-600',
    text: 'text-orange-900',
    badge: 'bg-orange-600 text-white',
    label: 'Atenție',
  },
  info: {
    bg: 'bg-blue-100',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    text: 'text-blue-900',
    badge: 'bg-blue-600 text-white',
    label: 'Info',
  },
};

function getDueText(daysUntilDue: number): string {
  if (daysUntilDue < 0) {
    return `Depășit cu ${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'zi' : 'zile'}`;
  }
  if (daysUntilDue === 0) return 'Astăzi';
  if (daysUntilDue === 1) return 'Mâine';
  return `În ${daysUntilDue} zile`;
}

/**
 * DeadlineWarningBanner displays deadline warnings at the top
 * of pages with severity-based styling.
 */
export function DeadlineWarningBanner({
  caseId,
  onCreateTask,
  onSendReminder,
  onRequestExtension,
  onMarkHandled,
  onActionSelect,
  collapsible = true,
  defaultExpanded = true,
  showDismiss = true,
  maxVisible = 5,
  className = '',
}: DeadlineWarningBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Use case-specific or general warnings
  const { warnings, loading, hasCritical, count } = caseId
    ? useCaseDeadlineWarnings(caseId)
    : useDeadlineWarnings();

  if (isDismissed || loading || count === 0) {
    return null;
  }

  const visibleWarnings = warnings.slice(0, maxVisible);
  const hiddenCount = count - maxVisible;

  // Determine overall severity for banner styling
  const overallSeverity = hasCritical ? 'critical' : warnings[0]?.severity || 'info';
  const config = severityConfig[overallSeverity] || severityConfig.info;

  const BannerContent = () => (
    <div className="space-y-2 pt-2" aria-live="polite">
      {visibleWarnings.map((deadline, index) => (
        <DeadlineWarningItem
          key={deadline.id || index}
          deadline={deadline}
          onCreateTask={onCreateTask}
          onSendReminder={onSendReminder}
          onRequestExtension={onRequestExtension}
          onMarkHandled={onMarkHandled}
          onActionSelect={onActionSelect}
        />
      ))}
      {hiddenCount > 0 && (
        <p className="text-sm text-muted-foreground text-center pt-2">
          și încă {hiddenCount} {hiddenCount === 1 ? 'termen' : 'termene'}...
        </p>
      )}
    </div>
  );

  if (collapsible) {
    return (
      <div
        role="banner"
        aria-label="Avertismente termene"
        className={`${config.bg} ${config.border} border rounded-lg ${className}`}
      >
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center justify-between p-3">
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                aria-expanded={isExpanded}
              >
                {overallSeverity === 'critical' ? (
                  <AlertTriangleIcon className={config.icon} />
                ) : (
                  <ClockIcon className={config.icon} />
                )}
                <span className={`font-medium ${config.text}`}>
                  {overallSeverity === 'critical'
                    ? 'Termene Critice'
                    : 'Termene Apropiate'}
                </span>
                <Badge className={config.badge}>{count}</Badge>
                <ChevronDownIcon
                  className={`transition-transform duration-200 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </CollapsibleTrigger>
            {showDismiss && (
              <Button
                size="sm"
                variant="ghost"
                className={`h-8 w-8 p-0 ${config.text}`}
                onClick={() => setIsDismissed(true)}
                aria-label="Închide banner"
              >
                <CloseIcon />
              </Button>
            )}
          </div>
          <CollapsibleContent className="px-3 pb-3">
            <BannerContent />
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  // Non-collapsible version
  return (
    <div
      role="banner"
      aria-label="Avertismente termene"
      className={`${config.bg} ${config.border} border rounded-lg p-3 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {overallSeverity === 'critical' ? (
            <AlertTriangleIcon className={config.icon} />
          ) : (
            <ClockIcon className={config.icon} />
          )}
          <span className={`font-medium ${config.text}`}>
            {overallSeverity === 'critical'
              ? 'Termene Critice'
              : 'Termene Apropiate'}
          </span>
          <Badge className={config.badge}>{count}</Badge>
        </div>
        {showDismiss && (
          <Button
            size="sm"
            variant="ghost"
            className={`h-8 w-8 p-0 ${config.text}`}
            onClick={() => setIsDismissed(true)}
            aria-label="Închide banner"
          >
            <CloseIcon />
          </Button>
        )}
      </div>
      <BannerContent />
    </div>
  );
}

DeadlineWarningBanner.displayName = 'DeadlineWarningBanner';

/**
 * Individual deadline warning item
 */
interface DeadlineWarningItemProps {
  deadline: DeadlineInfo;
  onCreateTask?: (deadline: DeadlineInfo) => void;
  onSendReminder?: (deadline: DeadlineInfo) => void;
  onRequestExtension?: (deadline: DeadlineInfo) => void;
  onMarkHandled?: (deadline: DeadlineInfo) => void;
  onActionSelect?: (action: SuggestedAction, deadline: DeadlineInfo) => void;
}

function DeadlineWarningItem({
  deadline,
  onCreateTask,
  onSendReminder,
  onRequestExtension,
  onMarkHandled,
  onActionSelect,
}: DeadlineWarningItemProps) {
  const config = severityConfig[deadline.severity] || severityConfig.info;

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg bg-white/50 border ${config.border}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground truncate">{deadline.title}</p>
          <Badge className={config.badge} variant="secondary">
            {config.label}
          </Badge>
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          <span className={deadline.daysUntilDue < 0 ? 'text-red-600 font-medium' : ''}>
            {getDueText(deadline.daysUntilDue)}
          </span>
          {deadline.case && (
            <span className="truncate">Dosar: {deadline.case.title}</span>
          )}
          {deadline.blockedBy && deadline.blockedBy.length > 0 && (
            <span className="text-orange-600">
              Blocat de {deadline.blockedBy.length}{' '}
              {deadline.blockedBy.length === 1 ? 'sarcină' : 'sarcini'}
            </span>
          )}
        </div>
      </div>
      <div className="ml-4 shrink-0">
        <DeadlineActionMenu
          deadline={deadline}
          onCreateTask={onCreateTask}
          onSendReminder={onSendReminder}
          onRequestExtension={onRequestExtension}
          onMarkHandled={onMarkHandled}
          onActionSelect={onActionSelect}
        />
      </div>
    </div>
  );
}

/**
 * Compact version for sidebar or smaller spaces
 */
export interface DeadlineWarningCompactProps {
  caseId?: string;
  onCreateTask?: (deadline: DeadlineInfo) => void;
  onMarkHandled?: (deadline: DeadlineInfo) => void;
  maxVisible?: number;
}

export function DeadlineWarningCompact({
  caseId,
  onCreateTask,
  onMarkHandled,
  maxVisible = 3,
}: DeadlineWarningCompactProps) {
  const { warnings, loading, count } = caseId
    ? useCaseDeadlineWarnings(caseId)
    : useDeadlineWarnings();

  if (loading || count === 0) {
    return null;
  }

  const visibleWarnings = warnings.slice(0, maxVisible);

  return (
    <div className="space-y-2">
      {visibleWarnings.map((deadline, index) => {
        const config = severityConfig[deadline.severity] || severityConfig.info;
        return (
          <div
            key={deadline.id || index}
            className={`flex items-center justify-between p-2 rounded ${config.bg} ${config.border} border`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{deadline.title}</p>
              <p className={`text-xs ${deadline.daysUntilDue < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {getDueText(deadline.daysUntilDue)}
              </p>
            </div>
            <DeadlineActionButtons
              deadline={deadline}
              onCreateTask={onCreateTask}
              onMarkHandled={onMarkHandled}
              compact
            />
          </div>
        );
      })}
      {count > maxVisible && (
        <p className="text-xs text-muted-foreground text-center">
          +{count - maxVisible} mai multe
        </p>
      )}
    </div>
  );
}

DeadlineWarningCompact.displayName = 'DeadlineWarningCompact';
