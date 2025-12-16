'use client';

/**
 * Risk Alert Banner Component
 * Story 5.2: Communication Intelligence Engine
 *
 * Displays high-severity risks prominently at top of case page.
 * Uses aria-live for screen reader announcements.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  AlertTriangle,
  X,
  ExternalLink,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileWarning,
  AlertCircle,
  UserX,
  Scale,
} from 'lucide-react';
import {
  useHighSeverityRisks,
  useResolveRisk,
  type RiskIndicator,
  type RiskType,
} from '../../hooks/useRiskIndicators';

// ============================================================================
// Types
// ============================================================================

interface RiskAlertBannerProps {
  caseId: string;
  onViewEmail?: (emailId: string) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getRiskIcon(riskType: RiskType): React.ReactNode {
  const iconClass = 'h-5 w-5';
  switch (riskType) {
    case 'MissedDeadline':
      return <Clock className={iconClass} aria-hidden="true" />;
    case 'ContradictoryStatements':
      return <FileWarning className={iconClass} aria-hidden="true" />;
    case 'UnresolvedDispute':
      return <Scale className={iconClass} aria-hidden="true" />;
    case 'ComplianceRisk':
      return <AlertCircle className={iconClass} aria-hidden="true" />;
    case 'ClientDissatisfaction':
      return <UserX className={iconClass} aria-hidden="true" />;
    default:
      return <AlertTriangle className={iconClass} aria-hidden="true" />;
  }
}

function getRiskTypeLabel(riskType: RiskType): string {
  const labels: Record<RiskType, string> = {
    MissedDeadline: 'Missed Deadline',
    ContradictoryStatements: 'Contradictory Statements',
    UnresolvedDispute: 'Unresolved Dispute',
    ComplianceRisk: 'Compliance Risk',
    ClientDissatisfaction: 'Client Dissatisfaction',
    Other: 'Other Risk',
  };
  return labels[riskType];
}

// ============================================================================
// Single Risk Alert Component
// ============================================================================

interface RiskAlertProps {
  risk: RiskIndicator;
  onResolve: (note?: string) => Promise<void>;
  onViewEmail?: () => void;
  onDismiss: () => void;
  isResolving: boolean;
}

function RiskAlert({ risk, onResolve, onViewEmail, onDismiss, isResolving }: RiskAlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const resolveButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management for expanded state
  useEffect(() => {
    if (showResolveForm && resolveButtonRef.current) {
      // Focus returns to resolve button area when form is shown
    }
  }, [showResolveForm]);

  const handleResolve = async () => {
    await onResolve(resolutionNote || undefined);
    setShowResolveForm(false);
    setResolutionNote('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && showResolveForm) {
      setShowResolveForm(false);
      resolveButtonRef.current?.focus();
    }
  };

  return (
    <div
      className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg"
      role="alert"
      aria-live="assertive"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 text-red-500">{getRiskIcon(risk.riskType)}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-red-800">{getRiskTypeLabel(risk.riskType)}</span>
            <span
              className="px-2 py-0.5 rounded text-xs font-medium bg-red-200 text-red-900"
              aria-label="Severity: High"
            >
              High Severity
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-red-700 mt-1">{risk.description}</p>

          {/* Expandable evidence */}
          {risk.evidence && (
            <div className="mt-2">
              <button
                ref={expandButtonRef}
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                aria-expanded={isExpanded}
                aria-controls={`evidence-${risk.id}`}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" aria-hidden="true" />
                    Hide evidence
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                    Show evidence
                  </>
                )}
              </button>
              {isExpanded && (
                <div
                  id={`evidence-${risk.id}`}
                  className="mt-2 p-2 bg-red-100 rounded text-xs text-red-800"
                >
                  <p className="font-medium mb-1">Evidence:</p>
                  <p className="italic">&ldquo;{risk.evidence}&rdquo;</p>
                  {risk.suggestedAction && (
                    <>
                      <p className="font-medium mt-2 mb-1">Suggested Action:</p>
                      <p>{risk.suggestedAction}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            {onViewEmail && (
              <button
                onClick={onViewEmail}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                aria-label="View source email"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                View Email
              </button>
            )}

            {!showResolveForm ? (
              <button
                ref={resolveButtonRef}
                onClick={() => setShowResolveForm(true)}
                disabled={isResolving}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:opacity-50"
                aria-label="Resolve this risk"
              >
                <CheckCircle className="h-3 w-3" aria-hidden="true" />
                Resolve
              </button>
            ) : (
              <div className="flex items-center gap-2" role="group" aria-label="Resolution form">
                <input
                  type="text"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Add resolution note (optional)"
                  className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  aria-label="Resolution note"
                />
                <button
                  onClick={handleResolve}
                  disabled={isResolving}
                  className="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {isResolving ? 'Saving...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowResolveForm(false)}
                  className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 text-red-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
          aria-label={`Dismiss risk alert: ${risk.description}`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Banner Component
// ============================================================================

export function RiskAlertBanner({ caseId, onViewEmail }: RiskAlertBannerProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data, loading, error, refetch } = useHighSeverityRisks(caseId);
  const [resolveRiskMutation] = useResolveRisk();

  // Filter out dismissed risks
  const visibleRisks = (data?.riskIndicators ?? []).filter((risk) => !dismissedIds.has(risk.id));

  const handleDismiss = useCallback((riskId: string) => {
    setDismissedIds((prev) => new Set([...prev, riskId]));
  }, []);

  const handleResolve = useCallback(
    async (riskId: string, note?: string) => {
      setResolvingId(riskId);
      try {
        await resolveRiskMutation({
          variables: { input: { riskId, resolutionNote: note } },
        });
        refetch();
      } catch (err) {
        console.error('Failed to resolve risk:', err);
      } finally {
        setResolvingId(null);
      }
    },
    [resolveRiskMutation, refetch]
  );

  // Don't render if loading, error, or no risks
  if (loading || error || visibleRisks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-4" role="region" aria-label="Risk alerts">
      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite">
        {visibleRisks.length} high severity risk{visibleRisks.length !== 1 ? 's' : ''} detected
      </div>

      {visibleRisks.map((risk) => (
        <RiskAlert
          key={risk.id}
          risk={risk}
          onResolve={(note) => handleResolve(risk.id, note)}
          onViewEmail={onViewEmail ? () => onViewEmail(risk.emailId) : undefined}
          onDismiss={() => handleDismiss(risk.id)}
          isResolving={resolvingId === risk.id}
        />
      ))}
    </div>
  );
}

export default RiskAlertBanner;
