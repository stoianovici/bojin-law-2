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
      <div className="p-6 text-center bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-100">
        <Brain className="h-12 w-12 mx-auto mb-3 text-purple-400" aria-hidden="true" />
        <h4 className="font-medium text-gray-800 mb-2">Rezumat AI al Comunicărilor</h4>
        <p className="text-sm text-gray-600 mb-4">
          Generează un rezumat complet al tuturor comunicărilor din acest dosar, incluzând
          cronologia evenimentelor și dezvoltările cheie.
        </p>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          <Brain className="h-4 w-4" />
          Generează Rezumat
        </button>
        {error && <p className="mt-3 text-sm text-red-600">Eroare: {error.message}</p>}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-8 text-center bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-100">
        <Loader2 className="h-10 w-10 mx-auto mb-4 text-purple-500 animate-spin" />
        <h4 className="font-medium text-gray-800 mb-2">Se analizează comunicările...</h4>
        <p className="text-sm text-gray-600">
          AI-ul analizează toate emailurile pentru a genera un rezumat complet. Aceasta poate dura
          câteva secunde.
        </p>
      </div>
    );
  }

  // Display summary
  if (!summary) return null;

  const significanceColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          <h4 className="font-semibold text-gray-800">Rezumat AI</h4>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {summary.emailCount} emailuri analizate
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          <span>Generat {formatDistanceToNow(new Date(summary.generatedAt))} în urmă</span>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="ml-2 p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
            title="Regenerează rezumatul"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Mail className="h-4 w-4 text-blue-500" />
          Rezumat Executiv
        </h5>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {summary.executiveSummary}
        </p>
      </div>

      {/* Current Status */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
        <h5 className="font-medium text-blue-800 text-sm mb-1 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Status Curent
        </h5>
        <p className="text-sm text-blue-700">{summary.currentStatus}</p>
      </div>

      {/* Key Developments */}
      {summary.keyDevelopments.length > 0 && (
        <div className="p-4 bg-white rounded-lg border border-gray-200">
          <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Dezvoltări Cheie
          </h5>
          <ul className="space-y-1.5">
            {summary.keyDevelopments.map((dev, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>{dev}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chronology (collapsible) */}
      {summary.chronology.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setIsChronologyExpanded(!isChronologyExpanded)}
            className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h5 className="font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-500" />
              Cronologie ({summary.chronology.length} evenimente)
            </h5>
            {isChronologyExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {isChronologyExpanded && (
            <div className="px-4 pb-4 border-t border-gray-100">
              <div className="mt-3 space-y-3">
                {summary.chronology.map((event, idx) => (
                  <div key={idx} className="flex gap-3 text-sm">
                    <div className="flex-shrink-0 w-20 text-gray-500 font-mono text-xs pt-0.5">
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
                      <p className="mt-1 text-gray-700">{event.summary}</p>
                      {event.parties.length > 0 && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          Părți: {event.parties.join(', ')}
                        </p>
                      )}
                      {event.emailId && onEmailClick && (
                        <button
                          onClick={() => onEmailClick(event.emailId)}
                          className="mt-1 text-xs text-blue-600 hover:underline"
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
        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
          <h5 className="font-medium text-orange-800 mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Probleme Nerezolvate
          </h5>
          <ul className="space-y-1.5">
            {summary.openIssues.map((issue, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-orange-700">
                <span className="text-orange-400">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Steps */}
      {summary.nextSteps.length > 0 && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
          <h5 className="font-medium text-green-800 mb-2 flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Pași Următori Recomandați
          </h5>
          <ul className="space-y-1.5">
            {summary.nextSteps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-green-700">
                <span className="font-medium text-green-600">{idx + 1}.</span>
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
