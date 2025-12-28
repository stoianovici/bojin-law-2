'use client';

/**
 * Thread Summary Panel Component
 * Story 5.2: Communication Intelligence Engine - Task 20
 *
 * Displays AI-generated thread analysis including:
 * - Opposing counsel position summary
 * - Key arguments with evidence
 * - Position change timeline
 *
 * Accessibility:
 * - aria-label on panel: "Thread analysis summary"
 * - role="list" for key arguments list
 * - Links to source emails with descriptive aria-label
 * - "Reanalyze" button with aria-disabled when processing
 * - Position change timeline with aria-label on each change event
 */

import { useState, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  MessageSquare,
  Users,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Quote,
  TrendingUp,
} from 'lucide-react';
import {
  useThreadSummary,
  useCaseThreadSummaries,
  useTriggerThreadAnalysis,
  type ThreadSummary,
  type KeyArgument,
  type PositionChange,
} from '../../hooks/useExtractedItems';

// ============================================================================
// Types
// ============================================================================

interface ThreadSummaryPanelProps {
  conversationId: string;
  onEmailClick?: (emailId: string) => void;
}

interface CaseThreadSummariesPanelProps {
  caseId: string;
  onEmailClick?: (emailId: string) => void;
}

// ============================================================================
// Key Argument Card Component
// ============================================================================

interface KeyArgumentCardProps {
  argument: KeyArgument;
  index: number;
  onEmailClick?: (emailId: string) => void;
}

function KeyArgumentCard({ argument, index, onEmailClick }: KeyArgumentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div role="listitem" className="p-3 bg-linear-bg-tertiary rounded-lg border border-linear-border-subtle">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {/* Party tag */}
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-linear-accent/15 text-linear-accent">
              <Users className="h-3 w-3 mr-1" aria-hidden="true" />
              {argument.party}
            </span>
            <span className="text-xs text-linear-text-tertiary">
              {format(new Date(argument.date), 'MMM d, yyyy')}
            </span>
          </div>

          {/* Argument text */}
          <p className="text-sm text-linear-text-primary">{argument.argument}</p>

          {/* Evidence (expandable) */}
          {argument.evidence && (
            <div className="mt-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-linear-text-tertiary hover:text-linear-text-secondary flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-linear-accent rounded"
                aria-expanded={isExpanded}
                aria-controls={`argument-evidence-${index}`}
              >
                <Quote className="h-3 w-3" aria-hidden="true" />
                {isExpanded ? 'Hide evidence' : 'Show evidence'}
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
              {isExpanded && (
                <blockquote
                  id={`argument-evidence-${index}`}
                  className="mt-2 pl-3 border-l-2 border-linear-border text-xs text-linear-text-secondary italic"
                >
                  &ldquo;{argument.evidence}&rdquo;
                </blockquote>
              )}
            </div>
          )}

          {/* Link to source email */}
          <div className="mt-2">
            <button
              onClick={() => onEmailClick?.(argument.emailId)}
              className="inline-flex items-center gap-1 text-xs text-linear-accent hover:underline focus:outline-none focus:ring-2 focus:ring-linear-accent"
              aria-label={`View source email for argument: ${argument.argument.substring(0, 50)}...`}
            >
              View source email
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Position Change Timeline Component
// ============================================================================

interface PositionChangeTimelineProps {
  changes: PositionChange[];
  onEmailClick?: (emailId: string) => void;
}

function PositionChangeTimeline({ changes, onEmailClick }: PositionChangeTimelineProps) {
  if (changes.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-linear-text-secondary flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-linear-warning" aria-hidden="true" />
        Position Changes
      </h4>
      <div className="relative pl-4 border-l-2 border-linear-warning/30 space-y-4">
        {changes.map((change, index) => (
          <div
            key={index}
            className="relative"
            aria-label={`Position changed on ${format(new Date(change.date), 'MMMM d, yyyy')}: from "${change.previousPosition}" to "${change.newPosition}"`}
          >
            {/* Timeline dot */}
            <div
              className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-linear-warning border-2 border-white"
              aria-hidden="true"
            />

            <div className="bg-linear-warning/10 rounded-lg p-3 border border-linear-warning/20">
              {/* Date */}
              <div className="text-xs text-linear-text-tertiary mb-2">
                {format(new Date(change.date), 'MMM d, yyyy')}
              </div>

              {/* Position change visualization */}
              <div className="flex items-start gap-2 text-sm">
                <div className="flex-1 p-2 bg-linear-bg-secondary rounded border border-linear-border-subtle">
                  <span className="text-xs text-linear-text-tertiary block mb-1">From:</span>
                  <span className="text-linear-text-secondary">{change.previousPosition}</span>
                </div>
                <ArrowRight
                  className="h-4 w-4 text-linear-warning flex-shrink-0 mt-4"
                  aria-hidden="true"
                />
                <div className="flex-1 p-2 bg-linear-warning/15 rounded border border-linear-warning/30">
                  <span className="text-xs text-linear-warning block mb-1">To:</span>
                  <span className="text-linear-warning font-medium">{change.newPosition}</span>
                </div>
              </div>

              {/* Trigger */}
              {change.trigger && (
                <div className="mt-2 text-xs text-linear-text-secondary">
                  <span className="font-medium">Trigger:</span> {change.trigger}
                </div>
              )}

              {/* Source email link */}
              <div className="mt-2">
                <button
                  onClick={() => onEmailClick?.(change.emailId)}
                  className="inline-flex items-center gap-1 text-xs text-linear-accent hover:underline focus:outline-none focus:ring-2 focus:ring-linear-accent"
                  aria-label={`View source email for position change on ${format(new Date(change.date), 'MMMM d, yyyy')}`}
                >
                  View source
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Thread Summary Content Component
// ============================================================================

interface ThreadSummaryContentProps {
  summary: ThreadSummary;
  onEmailClick?: (emailId: string) => void;
  onReanalyze: () => void;
  isReanalyzing: boolean;
}

function ThreadSummaryContent({
  summary,
  onEmailClick,
  onReanalyze,
  isReanalyzing,
}: ThreadSummaryContentProps) {
  return (
    <div className="space-y-4">
      {/* Header with metadata */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-linear-text-tertiary">
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          <span>{summary.messageCount} messages analyzed</span>
          <span className="text-linear-text-muted">|</span>
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span>Updated {formatDistanceToNow(new Date(summary.lastAnalyzedAt))} ago</span>
        </div>
        <button
          onClick={onReanalyze}
          disabled={isReanalyzing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-linear-text-secondary border border-linear-border rounded-md hover:bg-linear-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-linear-accent"
          aria-disabled={isReanalyzing}
          aria-label="Reanalyze thread for updated summary"
        >
          {isReanalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reanalyze
            </>
          )}
        </button>
      </div>

      {/* Opposing Counsel Position */}
      {summary.opposingCounselPosition && (
        <div className="bg-linear-accent/10 rounded-lg p-4 border border-linear-accent/20">
          <h4 className="text-sm font-medium text-linear-accent flex items-center gap-2 mb-2">
            <Users className="h-4 w-4" aria-hidden="true" />
            Opposing Counsel Position
          </h4>
          <p className="text-sm text-linear-accent">{summary.opposingCounselPosition}</p>
        </div>
      )}

      {/* Key Arguments */}
      {summary.keyArguments.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-linear-text-secondary flex items-center gap-2 mb-3">
            <Quote className="h-4 w-4 text-linear-accent" aria-hidden="true" />
            Key Arguments ({summary.keyArguments.length})
          </h4>
          <div role="list" aria-label="Key arguments from thread analysis" className="space-y-3">
            {summary.keyArguments.map((arg, index) => (
              <KeyArgumentCard
                key={index}
                argument={arg}
                index={index}
                onEmailClick={onEmailClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Position Changes */}
      <PositionChangeTimeline changes={summary.positionChanges} onEmailClick={onEmailClick} />

      {/* Case link */}
      {summary.case && (
        <div className="pt-3 border-t border-linear-border-subtle">
          <a
            href={`/cases/${summary.case.id}`}
            className="inline-flex items-center gap-1 text-sm text-linear-accent hover:underline focus:outline-none focus:ring-2 focus:ring-linear-accent"
          >
            View case: {summary.case.title}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Thread Summary Panel Component
// ============================================================================

export function ThreadSummaryPanel({ conversationId, onEmailClick }: ThreadSummaryPanelProps) {
  const { data, loading, error, refetch } = useThreadSummary(conversationId);
  const [triggerAnalysis, { loading: isReanalyzing }] = useTriggerThreadAnalysis();

  const handleReanalyze = useCallback(async () => {
    try {
      await triggerAnalysis({ variables: { conversationId } });
      refetch();
    } catch (err) {
      console.error('Failed to reanalyze thread:', err);
    }
  }, [triggerAnalysis, conversationId, refetch]);

  // Loading state
  if (loading && !data?.threadSummary) {
    return (
      <div
        className="p-6 flex items-center justify-center"
        role="status"
        aria-busy="true"
        aria-label="Loading thread analysis"
      >
        <Loader2 className="h-6 w-6 animate-spin text-linear-accent" aria-hidden="true" />
        <span className="ml-2 text-sm text-linear-text-secondary">Loading thread analysis...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-linear-error/10 rounded-lg" role="alert">
        <div className="flex items-center gap-2 text-linear-error">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <span className="font-medium">Failed to load thread analysis</span>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-linear-error hover:underline focus:outline-none focus:ring-2 focus:ring-linear-error"
        >
          Try again
        </button>
      </div>
    );
  }

  // No summary available
  if (!data?.threadSummary) {
    return (
      <div className="p-6 text-center bg-linear-bg-tertiary rounded-lg">
        <MessageSquare className="h-12 w-12 mx-auto mb-3 text-linear-text-muted" aria-hidden="true" />
        <p className="text-sm text-linear-text-tertiary">No analysis available for this thread</p>
        <button
          onClick={handleReanalyze}
          disabled={isReanalyzing}
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-linear-accent text-white rounded-md hover:bg-linear-accent-hover transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2"
        >
          {isReanalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Analyze Thread
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className="p-4 bg-linear-bg-secondary rounded-lg border border-linear-border-subtle"
      aria-label="Thread analysis summary"
    >
      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-linear-accent" aria-hidden="true" />
        Thread Analysis
      </h3>
      <ThreadSummaryContent
        summary={data.threadSummary}
        onEmailClick={onEmailClick}
        onReanalyze={handleReanalyze}
        isReanalyzing={isReanalyzing}
      />
    </div>
  );
}

// ============================================================================
// Case Thread Summaries Panel (Multiple Threads)
// ============================================================================

export function CaseThreadSummariesPanel({ caseId, onEmailClick }: CaseThreadSummariesPanelProps) {
  const { data, loading, error, refetch } = useCaseThreadSummaries(caseId);
  const [triggerAnalysis, { loading: isReanalyzing }] = useTriggerThreadAnalysis();
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const toggleThread = useCallback((conversationId: string) => {
    setExpandedThreads((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
      } else {
        newSet.add(conversationId);
      }
      return newSet;
    });
  }, []);

  const handleReanalyze = useCallback(
    async (conversationId: string) => {
      try {
        await triggerAnalysis({ variables: { conversationId } });
        refetch();
      } catch (err) {
        console.error('Failed to reanalyze thread:', err);
      }
    },
    [triggerAnalysis, refetch]
  );

  // Loading state
  if (loading && !data?.caseThreadSummaries) {
    return (
      <div className="p-6 flex items-center justify-center" role="status" aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin text-linear-accent" aria-hidden="true" />
        <span className="ml-2 text-sm text-linear-text-secondary">Loading thread analyses...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-linear-error/10 rounded-lg" role="alert">
        <div className="flex items-center gap-2 text-linear-error">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <span className="font-medium">Failed to load thread analyses</span>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-linear-error hover:underline focus:outline-none focus:ring-2 focus:ring-linear-error"
        >
          Try again
        </button>
      </div>
    );
  }

  const summaries = data?.caseThreadSummaries ?? [];

  // Empty state
  if (summaries.length === 0) {
    return (
      <div className="p-6 text-center bg-linear-bg-tertiary rounded-lg">
        <MessageSquare className="h-12 w-12 mx-auto mb-3 text-linear-text-muted" aria-hidden="true" />
        <p className="text-sm text-linear-text-tertiary">No thread analyses available</p>
        <p className="text-xs text-linear-text-muted mt-1">
          Thread analyses will appear when email conversations are processed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-label="Case thread summaries">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-linear-accent" aria-hidden="true" />
        Thread Analyses ({summaries.length})
      </h3>

      <div className="space-y-3">
        {summaries.map((summary) => (
          <div key={summary.id} className="border border-linear-border-subtle rounded-lg overflow-hidden">
            {/* Thread header (clickable to expand) */}
            <button
              onClick={() => toggleThread(summary.conversationId)}
              className="w-full p-4 text-left bg-linear-bg-secondary hover:bg-linear-bg-tertiary focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-inset"
              aria-expanded={expandedThreads.has(summary.conversationId)}
              aria-controls={`thread-content-${summary.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare
                    className="h-5 w-5 text-linear-accent flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <div className="font-medium text-sm">{summary.messageCount} messages</div>
                    <div className="text-xs text-linear-text-tertiary">
                      Updated {formatDistanceToNow(new Date(summary.lastAnalyzedAt))} ago
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {summary.positionChanges.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-linear-warning/15 text-linear-warning">
                      {summary.positionChanges.length} position change
                      {summary.positionChanges.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {expandedThreads.has(summary.conversationId) ? (
                    <ChevronUp className="h-5 w-5 text-linear-text-muted" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-linear-text-muted" aria-hidden="true" />
                  )}
                </div>
              </div>
              {summary.opposingCounselPosition && (
                <p className="mt-2 text-sm text-linear-text-secondary line-clamp-2">
                  {summary.opposingCounselPosition}
                </p>
              )}
            </button>

            {/* Expanded content */}
            {expandedThreads.has(summary.conversationId) && (
              <div
                id={`thread-content-${summary.id}`}
                className="border-t border-linear-border-subtle p-4 bg-linear-bg-tertiary"
              >
                <ThreadSummaryContent
                  summary={summary}
                  onEmailClick={onEmailClick}
                  onReanalyze={() => handleReanalyze(summary.conversationId)}
                  isReanalyzing={isReanalyzing}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ThreadSummaryPanel;
