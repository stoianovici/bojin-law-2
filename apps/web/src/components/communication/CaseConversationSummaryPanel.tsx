'use client';

/**
 * Case Conversation Summary Panel
 * OPS-026: AI Thread Summary Agent for Communications
 *
 * Displays an AI-generated summary of ALL communications for a case.
 * The summary includes:
 * - Executive summary
 * - Chronological timeline of key events
 * - Key developments
 * - Current status
 * - Open issues
 * - Suggested next steps
 */

import { useState, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { formatDistanceToNow } from 'date-fns';
import {
  Brain,
  RefreshCw,
  Loader2,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Lightbulb,
  Mail,
} from 'lucide-react';

// ============================================================================
// GraphQL
// ============================================================================

const GENERATE_CASE_CONVERSATION_SUMMARY = gql`
  mutation GenerateCaseConversationSummary($caseId: ID!) {
    generateCaseConversationSummary(caseId: $caseId) {
      caseId
      executiveSummary
      chronology {
        date
        summary
        significance
        parties
        emailId
      }
      keyDevelopments
      currentStatus
      openIssues
      nextSteps
      lastEmailDate
      emailCount
      generatedAt
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface ChronologyEvent {
  date: string;
  summary: string;
  significance: 'high' | 'medium' | 'low';
  parties: string[];
  emailId: string;
}

interface CaseConversationSummary {
  caseId: string;
  executiveSummary: string;
  chronology: ChronologyEvent[];
  keyDevelopments: string[];
  currentStatus: string;
  openIssues: string[];
  nextSteps: string[];
  lastEmailDate: string | null;
  emailCount: number;
  generatedAt: string;
}

interface CaseConversationSummaryPanelProps {
  caseId: string;
  onEmailClick?: (emailId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function CaseConversationSummaryPanel({
  caseId,
  onEmailClick,
}: CaseConversationSummaryPanelProps) {
  const [summary, setSummary] = useState<CaseConversationSummary | null>(null);
  const [isChronologyExpanded, setIsChronologyExpanded] = useState(false);

  const [generateSummary, { loading, error }] = useMutation<{
    generateCaseConversationSummary: CaseConversationSummary;
  }>(GENERATE_CASE_CONVERSATION_SUMMARY, {
    onCompleted: (data) => {
      setSummary(data.generateCaseConversationSummary);
    },
  });

  const handleGenerate = useCallback(() => {
    generateSummary({ variables: { caseId } });
  }, [generateSummary, caseId]);

  // No summary yet - show generate button
  if (!summary && !loading) {
    return (
      <div className="p-6 text-center bg-gradient-to-br from-linear-accent/10 to-linear-bg-tertiary rounded-lg border border-linear-accent/20">
        <Brain className="h-12 w-12 mx-auto mb-3 text-linear-accent" aria-hidden="true" />
        <h4 className="font-medium text-linear-text-primary mb-2">Rezumat AI al Comunicărilor</h4>
        <p className="text-sm text-linear-text-secondary mb-4">
          Generează un rezumat complet al tuturor comunicărilor din acest dosar, incluzând
          cronologia evenimentelor și dezvoltările cheie.
        </p>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-linear-accent text-white rounded-lg hover:bg-linear-accent-hover transition-colors disabled:opacity-50"
        >
          <Brain className="h-4 w-4" />
          Generează Rezumat
        </button>
        {error && <p className="mt-3 text-sm text-linear-error">Eroare: {error.message}</p>}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-8 text-center bg-gradient-to-br from-linear-accent/10 to-linear-bg-tertiary rounded-lg border border-linear-accent/20">
        <Loader2 className="h-10 w-10 mx-auto mb-4 text-linear-accent animate-spin" />
        <h4 className="font-medium text-linear-text-primary mb-2">Se analizează comunicările...</h4>
        <p className="text-sm text-linear-text-secondary">
          AI-ul analizează toate emailurile pentru a genera un rezumat complet. Aceasta poate dura
          câteva secunde.
        </p>
      </div>
    );
  }

  // Display summary
  if (!summary) return null;

  const significanceColors = {
    high: 'bg-linear-error/15 text-linear-error border-linear-error/30',
    medium: 'bg-linear-warning/15 text-linear-warning border-linear-warning/30',
    low: 'bg-linear-bg-tertiary text-linear-text-secondary border-linear-border-subtle',
  };

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-linear-accent" />
          <h4 className="font-semibold text-linear-text-primary">Rezumat AI</h4>
          <span className="text-xs text-linear-text-tertiary bg-linear-bg-tertiary px-2 py-0.5 rounded">
            {summary.emailCount} emailuri analizate
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-linear-text-tertiary">
          <Clock className="h-3 w-3" />
          <span>Generat {formatDistanceToNow(new Date(summary.generatedAt))} în urmă</span>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="ml-2 p-1.5 text-linear-text-tertiary hover:text-linear-accent hover:bg-linear-accent/10 rounded transition-colors"
            title="Regenerează rezumatul"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="p-4 bg-linear-bg-secondary rounded-lg border border-linear-border-subtle">
        <h5 className="font-medium text-linear-text-secondary mb-2 flex items-center gap-2">
          <Mail className="h-4 w-4 text-linear-accent" />
          Rezumat Executiv
        </h5>
        <p className="text-sm text-linear-text-secondary leading-relaxed whitespace-pre-wrap">
          {summary.executiveSummary}
        </p>
      </div>

      {/* Current Status */}
      <div className="p-3 bg-linear-accent/10 rounded-lg border border-linear-accent/20">
        <h5 className="font-medium text-linear-accent text-sm mb-1 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Status Curent
        </h5>
        <p className="text-sm text-linear-accent">{summary.currentStatus}</p>
      </div>

      {/* Key Developments */}
      {summary.keyDevelopments.length > 0 && (
        <div className="p-4 bg-linear-bg-secondary rounded-lg border border-linear-border-subtle">
          <h5 className="font-medium text-linear-text-secondary mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-linear-warning" />
            Dezvoltări Cheie
          </h5>
          <ul className="space-y-1.5">
            {summary.keyDevelopments.map((dev, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-linear-text-secondary">
                <ArrowRight className="h-4 w-4 text-linear-text-muted flex-shrink-0 mt-0.5" />
                <span>{dev}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chronology (collapsible) */}
      {summary.chronology.length > 0 && (
        <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle overflow-hidden">
          <button
            onClick={() => setIsChronologyExpanded(!isChronologyExpanded)}
            className="w-full p-4 text-left flex items-center justify-between hover:bg-linear-bg-hover transition-colors"
          >
            <h5 className="font-medium text-linear-text-secondary flex items-center gap-2">
              <Calendar className="h-4 w-4 text-linear-success" />
              Cronologie ({summary.chronology.length} evenimente)
            </h5>
            {isChronologyExpanded ? (
              <ChevronUp className="h-4 w-4 text-linear-text-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-linear-text-muted" />
            )}
          </button>
          {isChronologyExpanded && (
            <div className="px-4 pb-4 border-t border-linear-border-subtle/50">
              <div className="mt-3 space-y-3">
                {summary.chronology.map((event, idx) => (
                  <div key={idx} className="flex gap-3 text-sm">
                    <div className="flex-shrink-0 w-20 text-linear-text-tertiary font-mono text-xs pt-0.5">
                      {event.date}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-xs rounded border ${significanceColors[event.significance]}`}
                        >
                          {event.significance === 'high'
                            ? 'Important'
                            : event.significance === 'medium'
                              ? 'Notabil'
                              : 'Rutină'}
                        </span>
                      </div>
                      <p className="mt-1 text-linear-text-secondary">{event.summary}</p>
                      {event.parties.length > 0 && (
                        <p className="mt-0.5 text-xs text-linear-text-tertiary">
                          Părți: {event.parties.join(', ')}
                        </p>
                      )}
                      {event.emailId && onEmailClick && (
                        <button
                          onClick={() => onEmailClick(event.emailId)}
                          className="mt-1 text-xs text-linear-accent hover:underline"
                        >
                          Vezi email →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Open Issues */}
      {summary.openIssues.length > 0 && (
        <div className="p-4 bg-linear-warning/10 rounded-lg border border-linear-warning/20">
          <h5 className="font-medium text-linear-warning mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Probleme Nerezolvate
          </h5>
          <ul className="space-y-1.5">
            {summary.openIssues.map((issue, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-linear-warning">
                <span className="text-linear-warning">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Steps */}
      {summary.nextSteps.length > 0 && (
        <div className="p-4 bg-linear-success/10 rounded-lg border border-linear-success/20">
          <h5 className="font-medium text-linear-success mb-2 flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Pași Următori Recomandați
          </h5>
          <ul className="space-y-1.5">
            {summary.nextSteps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-linear-success">
                <span className="font-medium text-linear-success">{idx + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default CaseConversationSummaryPanel;
