/**
 * ContractAnalysisPanel Component
 * Main panel showing contract analysis results.
 * Displays summary, clarifying questions, and clause list.
 *
 * Features:
 * - Summary statistics with risk breakdown
 * - Expert clarifying questions flow
 * - Expandable clause cards with alternatives
 * - AI reasoning panel (thinking blocks)
 * - Romanian UI labels
 */

import { useState, CSSProperties } from 'react';
import { ClauseCard } from './ClauseCard';
import { ClarifyingQuestion } from './ClarifyingQuestion';
import { PanouRationament } from './PanouRationament';

// ============================================================================
// Types
// ============================================================================

export interface ClauseAnalysis {
  id: string;
  clauseReference: string;
  clauseText: string;
  riskLevel: 'high' | 'medium' | 'low';
  reasoning: string;
  alternatives: Array<{
    id: string;
    label: string; // 'Conservator' | 'Echilibrat' | 'Agresiv' or similar
    description: string;
    text: string;
  }>;
  cpcArticles: string[];
}

export interface ClarifyingQuestionData {
  id: string;
  question: string;
  options: Array<{ id: string; label: string; description: string }>;
}

export interface ContractAnalysisSummary {
  totalClauses: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
}

interface ContractAnalysisPanelProps {
  /** Analysis results */
  clauses: ClauseAnalysis[];
  /** Optional clarifying questions to answer first */
  clarifyingQuestions?: ClarifyingQuestionData[];
  /** Summary statistics */
  summary: ContractAnalysisSummary;
  /** AI thinking blocks for reasoning panel */
  thinkingBlocks?: string[];
  /** Called when user applies an alternative */
  onApplyAlternative: (clauseId: string, alternativeId: string, text: string) => void;
  /** Called when user wants to research a clause */
  onResearchClause: (clause: ClauseAnalysis) => void;
  /** Called when user navigates to a clause in document */
  onNavigateToClause: (clauseText: string) => void;
  /** Called when user answers a clarifying question */
  onAnswerQuestion?: (questionId: string, answerId: string) => void;
  /** Called when user wants to go back */
  onBack: () => void;
  /** Called when user is done with analysis */
  onDone: () => void;
}

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-default)',
    background: 'var(--bg-card)',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    background: 'none',
    border: '1px solid var(--border-default)',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    transition: 'all 0.15s ease',
  },
  headerTitle: {
    flex: 1,
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  summary: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    background: 'var(--bg-card)',
    borderBottom: '1px solid var(--border-default)',
  },
  summaryTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  statLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginLeft: '6px',
  },
  riskCounts: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  riskBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '14px',
    fontSize: '12px',
    fontWeight: 500,
  },
  riskBadgeHigh: {
    background: 'var(--status-error-bg)',
    color: 'var(--status-error-text)',
  },
  riskBadgeMedium: {
    background: 'var(--status-warning-bg)',
    color: 'var(--status-warning-text)',
  },
  riskBadgeLow: {
    background: 'var(--status-success-bg)',
    color: 'var(--status-success-text)',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  questionsSection: {
    marginBottom: '16px',
  },
  clausesHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  clausesTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  clausesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  noIssues: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    textAlign: 'center' as const,
    background: 'var(--bg-card)',
    borderRadius: '8px',
    border: '1px solid var(--border-default)',
  },
  noIssuesIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  noIssuesText: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border-default)',
    background: 'var(--bg-card)',
  },
  doneButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '10px 16px',
    background: 'var(--accent-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  rationamentSection: {
    marginBottom: '16px',
  },
};

// ============================================================================
// Component
// ============================================================================

export function ContractAnalysisPanel({
  clauses,
  clarifyingQuestions,
  summary,
  thinkingBlocks,
  onApplyAlternative,
  onResearchClause,
  onNavigateToClause,
  onAnswerQuestion,
  onBack,
  onDone,
}: ContractAnalysisPanelProps) {
  // Track which clause is expanded (auto-expand first high-risk clause)
  const [expandedClauseId, setExpandedClauseId] = useState<string | null>(
    clauses.find((c) => c.riskLevel === 'high')?.id || clauses[0]?.id || null
  );

  // Track clarifying question progress
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isAnsweringQuestions, setIsAnsweringQuestions] = useState(
    clarifyingQuestions && clarifyingQuestions.length > 0
  );

  // Handle question answer
  const handleQuestionAnswer = (answerId: string) => {
    if (!clarifyingQuestions) return;

    const question = clarifyingQuestions[currentQuestionIndex];
    onAnswerQuestion?.(question.id, answerId);

    if (currentQuestionIndex < clarifyingQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setIsAnsweringQuestions(false);
    }
  };

  // Handle skip question
  const handleSkipQuestion = () => {
    if (currentQuestionIndex < (clarifyingQuestions?.length || 0) - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setIsAnsweringQuestions(false);
    }
  };

  // Handle clause expand/collapse
  const handleToggleClause = (clauseId: string) => {
    setExpandedClauseId(expandedClauseId === clauseId ? null : clauseId);
  };

  return (
    <div style={styles.panel} className="contract-analysis-panel">
      {/* Header */}
      <div style={styles.header}>
        <button
          style={styles.backButton}
          onClick={onBack}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)';
            e.currentTarget.style.borderColor = 'var(--border-strong)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Inapoi
        </button>
        <h2 style={styles.headerTitle}>Analiza Contract</h2>
      </div>

      {/* Summary */}
      <div style={styles.summary}>
        <div style={styles.summaryTop}>
          <div>
            <span style={styles.statValue}>{summary.totalClauses}</span>
            <span style={styles.statLabel}>clauze analizate</span>
          </div>
        </div>
        <div style={styles.riskCounts}>
          {summary.highRisk > 0 && (
            <span style={{ ...styles.riskBadge, ...styles.riskBadgeHigh }}>
              <RiskIndicator level="high" />
              {summary.highRisk} risc ridicat
            </span>
          )}
          {summary.mediumRisk > 0 && (
            <span style={{ ...styles.riskBadge, ...styles.riskBadgeMedium }}>
              <RiskIndicator level="medium" />
              {summary.mediumRisk} risc mediu
            </span>
          )}
          {summary.lowRisk > 0 && (
            <span style={{ ...styles.riskBadge, ...styles.riskBadgeLow }}>
              <RiskIndicator level="low" />
              {summary.lowRisk} ok
            </span>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={styles.content}>
        {/* AI Reasoning (if available) */}
        {thinkingBlocks && thinkingBlocks.length > 0 && (
          <div style={styles.rationamentSection}>
            <PanouRationament thinkingBlocks={thinkingBlocks} defaultExpanded={false} />
          </div>
        )}

        {/* Clarifying Questions (if pending) */}
        {isAnsweringQuestions &&
          clarifyingQuestions &&
          clarifyingQuestions[currentQuestionIndex] && (
            <div style={styles.questionsSection}>
              <ClarifyingQuestion
                question={clarifyingQuestions[currentQuestionIndex].question}
                options={clarifyingQuestions[currentQuestionIndex].options}
                onAnswer={handleQuestionAnswer}
                onSkip={handleSkipQuestion}
                showSkip={true}
              />
            </div>
          )}

        {/* Clause List */}
        {!isAnsweringQuestions && (
          <>
            <div style={styles.clausesHeader}>
              <h3 style={styles.clausesTitle}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Probleme gasite
              </h3>
            </div>

            <div style={styles.clausesList}>
              {clauses.map((clause) => (
                <ClauseCard
                  key={clause.id}
                  clauseReference={clause.clauseReference}
                  clauseText={clause.clauseText}
                  riskLevel={clause.riskLevel}
                  reasoning={clause.reasoning}
                  alternatives={clause.alternatives}
                  cpcArticles={clause.cpcArticles}
                  isExpanded={expandedClauseId === clause.id}
                  onToggleExpand={() => handleToggleClause(clause.id)}
                  onApplyAlternative={(altId, text) => onApplyAlternative(clause.id, altId, text)}
                  onResearch={() => onResearchClause(clause)}
                  onNavigate={() => onNavigateToClause(clause.clauseText)}
                />
              ))}
            </div>

            {clauses.length === 0 && (
              <div style={styles.noIssues}>
                <span style={styles.noIssuesIcon} role="img" aria-label="success">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--status-success-text)"
                    strokeWidth="2"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </span>
                <p style={styles.noIssuesText}>Nu au fost gasite clauze problematice.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer with Done button */}
      {!isAnsweringQuestions && (
        <div style={styles.footer}>
          <button
            style={styles.doneButton}
            onClick={onDone}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--accent-hover)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--accent-primary)';
            }}
          >
            Finalizare
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Risk indicator dot matching ClauseCard colors
 */
function RiskIndicator({ level }: { level: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'var(--status-error-text)',
    medium: 'var(--status-warning-text)',
    low: 'var(--status-success-text)',
  };

  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: colors[level],
      }}
    />
  );
}
