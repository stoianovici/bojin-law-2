'use client';

/**
 * Risk Indicators Panel Component
 * Story 5.2: Communication Intelligence Engine
 *
 * Lists all risks for a case with severity badges, filters, and expandable details.
 */

import { useState, useMemo, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Filter,
  ExternalLink,
  Clock,
  FileWarning,
  AlertCircle,
  UserX,
  Scale,
  Loader2,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import {
  useCaseRisks,
  type RiskIndicator,
  type RiskType,
  type RiskSeverity,
} from '../../hooks/useRiskIndicators';

// ============================================================================
// Types
// ============================================================================

interface RiskIndicatorsPanelProps {
  caseId: string;
  onViewEmail?: (emailId: string) => void;
}

type SortField = 'createdAt' | 'severity';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// Helper Functions
// ============================================================================

function getRiskIcon(riskType: RiskType): React.ReactNode {
  const iconClass = 'h-4 w-4';
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
    Other: 'Other',
  };
  return labels[riskType];
}

function getSeverityConfig(severity: RiskSeverity) {
  const configs = {
    High: { bg: 'bg-linear-error/15', text: 'text-linear-error', border: 'border-linear-error/30' },
    Medium: {
      bg: 'bg-linear-warning/15',
      text: 'text-linear-warning',
      border: 'border-linear-warning/30',
    },
    Low: {
      bg: 'bg-linear-success/15',
      text: 'text-linear-success',
      border: 'border-linear-success/30',
    },
  };
  return configs[severity];
}

function severityToNumber(severity: RiskSeverity): number {
  return { High: 3, Medium: 2, Low: 1 }[severity];
}

// ============================================================================
// Risk Item Component
// ============================================================================

interface RiskItemProps {
  risk: RiskIndicator;
  onResolve: (note?: string) => Promise<{ success: boolean }>;
  onViewEmail?: () => void;
  isResolving: boolean;
}

function RiskItem({ risk, onResolve, onViewEmail, isResolving }: RiskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  const severityConfig = getSeverityConfig(risk.severity);

  const handleResolve = async () => {
    const result = await onResolve(resolutionNote || undefined);
    if (result.success) {
      setShowResolveForm(false);
      setResolutionNote('');
    }
  };

  return (
    <div
      className={`border rounded-lg ${risk.isResolved ? 'bg-linear-bg-primary opacity-75' : 'bg-linear-bg-secondary'}`}
      role="listitem"
    >
      {/* Header */}
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Expand button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 p-1 hover:bg-linear-bg-hover rounded focus:outline-none focus:ring-2 focus:ring-linear-accent"
            aria-expanded={isExpanded}
            aria-controls={`risk-details-${risk.id}`}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-linear-text-tertiary" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4 text-linear-text-tertiary" aria-hidden="true" />
            )}
          </button>

          {/* Icon */}
          <div className={`flex-shrink-0 ${severityConfig.text}`}>{getRiskIcon(risk.riskType)}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{getRiskTypeLabel(risk.riskType)}</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${severityConfig.bg} ${severityConfig.text}`}
                aria-label={`Severity: ${risk.severity}`}
              >
                {risk.severity}
              </span>
              {risk.isResolved && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-linear-bg-tertiary text-linear-text-secondary">
                  Resolved
                </span>
              )}
            </div>
            <p className="text-sm text-linear-text-secondary mt-1 line-clamp-2">
              {risk.description}
            </p>
            <p className="text-xs text-linear-text-muted mt-1">
              {format(parseISO(risk.createdAt), 'MMM d, yyyy h:mm a')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex items-center gap-2">
            {onViewEmail && (
              <button
                onClick={onViewEmail}
                className="p-1 text-linear-text-muted hover:text-linear-accent focus:outline-none focus:ring-2 focus:ring-linear-accent rounded"
                aria-label="View source email"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {!risk.isResolved && (
              <button
                onClick={() => setShowResolveForm(!showResolveForm)}
                className="p-1 text-linear-text-muted hover:text-linear-success focus:outline-none focus:ring-2 focus:ring-linear-success rounded"
                aria-label="Resolve risk"
              >
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Resolve form */}
        {showResolveForm && (
          <div className="mt-3 p-2 bg-linear-bg-primary rounded flex items-center gap-2">
            <input
              type="text"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Resolution note (optional)"
              className="flex-1 px-2 py-1 text-sm border border-linear-border rounded focus:outline-none focus:ring-2 focus:ring-linear-success bg-linear-bg-secondary text-linear-text-primary"
              aria-label="Resolution note"
            />
            <button
              onClick={handleResolve}
              disabled={isResolving}
              className="px-3 py-1 text-sm font-medium text-white bg-linear-success rounded hover:bg-linear-success/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-linear-success"
            >
              {isResolving ? 'Saving...' : 'Resolve'}
            </button>
            <button
              onClick={() => setShowResolveForm(false)}
              className="px-2 py-1 text-sm text-linear-text-secondary hover:text-linear-text-primary focus:outline-none focus:ring-2 focus:ring-linear-accent"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div id={`risk-details-${risk.id}`} className="px-3 pb-3 border-t pt-3 ml-10">
          {risk.evidence && (
            <div className="mb-2">
              <p className="text-xs font-medium text-linear-text-tertiary mb-1">Evidence</p>
              <p className="text-sm text-linear-text-secondary italic">
                &ldquo;{risk.evidence}&rdquo;
              </p>
            </div>
          )}
          {risk.suggestedAction && (
            <div className="mb-2">
              <p className="text-xs font-medium text-linear-text-tertiary mb-1">Suggested Action</p>
              <p className="text-sm text-linear-text-secondary">{risk.suggestedAction}</p>
            </div>
          )}
          {risk.isResolved && risk.resolvedAt && (
            <div className="mt-2 p-2 bg-linear-success/10 rounded">
              <p className="text-xs text-linear-success">
                Resolved on {format(parseISO(risk.resolvedAt), 'MMM d, yyyy')}
                {risk.resolutionNote && `: ${risk.resolutionNote}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

export function RiskIndicatorsPanel({ caseId, onViewEmail }: RiskIndicatorsPanelProps) {
  const [filterSeverity, setFilterSeverity] = useState<RiskSeverity | 'all'>('all');
  const [filterType, setFilterType] = useState<RiskType | 'all'>('all');
  const [filterResolved, setFilterResolved] = useState<'all' | 'resolved' | 'unresolved'>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { risks, summary, loading, error, resolving, resolveRisk } = useCaseRisks(caseId);

  // Filter and sort risks
  const filteredRisks = useMemo(() => {
    let result = [...risks];

    // Apply filters
    if (filterSeverity !== 'all') {
      result = result.filter((r) => r.severity === filterSeverity);
    }
    if (filterType !== 'all') {
      result = result.filter((r) => r.riskType === filterType);
    }
    if (filterResolved === 'resolved') {
      result = result.filter((r) => r.isResolved);
    } else if (filterResolved === 'unresolved') {
      result = result.filter((r) => !r.isResolved);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'severity') {
        comparison = severityToNumber(a.severity) - severityToNumber(b.severity);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [risks, filterSeverity, filterType, filterResolved, sortField, sortDirection]);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('desc');
      }
    },
    [sortField]
  );

  // Loading state
  if (loading && risks.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-linear-accent" aria-hidden="true" />
        <span className="ml-2 text-sm text-linear-text-secondary">Loading risk indicators...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 bg-linear-error/10 rounded-lg" role="alert">
        <div className="flex items-center gap-2 text-linear-error">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          <span className="font-medium">Failed to load risk indicators</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header with summary */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Risk Indicators</h2>
        {summary && (
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 rounded bg-linear-error/15 text-linear-error">
              {summary.highSeverity} High
            </span>
            <span className="px-2 py-0.5 rounded bg-linear-warning/15 text-linear-warning">
              {summary.mediumSeverity} Med
            </span>
            <span className="px-2 py-0.5 rounded bg-linear-success/15 text-linear-success">
              {summary.lowSeverity} Low
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-linear-bg-primary rounded-lg">
        <Filter className="h-4 w-4 text-linear-text-tertiary" aria-hidden="true" />

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as RiskSeverity | 'all')}
          className="text-sm border border-linear-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-linear-accent bg-linear-bg-secondary text-linear-text-primary"
          aria-label="Filter by severity"
        >
          <option value="all">All severities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as RiskType | 'all')}
          className="text-sm border border-linear-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-linear-accent bg-linear-bg-secondary text-linear-text-primary"
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          <option value="MissedDeadline">Missed Deadline</option>
          <option value="ContradictoryStatements">Contradictory Statements</option>
          <option value="UnresolvedDispute">Unresolved Dispute</option>
          <option value="ComplianceRisk">Compliance Risk</option>
          <option value="ClientDissatisfaction">Client Dissatisfaction</option>
          <option value="Other">Other</option>
        </select>

        <select
          value={filterResolved}
          onChange={(e) => setFilterResolved(e.target.value as 'all' | 'resolved' | 'unresolved')}
          className="text-sm border border-linear-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-linear-accent bg-linear-bg-secondary text-linear-text-primary"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
        </select>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => toggleSort('severity')}
            className={`p-1 rounded hover:bg-linear-bg-hover ${sortField === 'severity' ? 'bg-linear-bg-tertiary' : ''}`}
            aria-label="Sort by severity"
            aria-sort={
              sortField === 'severity'
                ? sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
          >
            {sortDirection === 'asc' && sortField === 'severity' ? (
              <SortAsc className="h-4 w-4" aria-hidden="true" />
            ) : (
              <SortDesc className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <span className="text-xs text-linear-text-tertiary">Severity</span>
        </div>
      </div>

      {/* Risk list */}
      {filteredRisks.length === 0 ? (
        <div className="text-center py-8 text-linear-text-tertiary">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-linear-success" aria-hidden="true" />
          <p className="text-sm">No risks found</p>
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Risk indicators list">
          {filteredRisks.map((risk) => (
            <RiskItem
              key={risk.id}
              risk={risk}
              onResolve={(note) => resolveRisk(risk.id, note)}
              onViewEmail={onViewEmail ? () => onViewEmail(risk.emailId) : undefined}
              isResolving={resolving}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default RiskIndicatorsPanel;
