/**
 * StepContract - Contract Analysis Wizard Step
 * Extracts document content and initiates contract analysis.
 * Only available in expert mode.
 */

import { useState, useEffect } from 'react';
import { getDocumentContent } from '../../services/word-api';
import { apiClient } from '../../services/api-client';
import type { WizardState } from './index';

// ============================================================================
// Types
// ============================================================================

interface StepContractProps {
  state: WizardState;
  onBack: () => void;
  onAnalysisComplete: (result: ContractAnalysisResult) => void;
  onError: (error: string) => void;
  animationClass?: string;
}

export interface ContractAnalysisResult {
  clauses: Array<{
    id: string;
    clauseReference: string;
    clauseText: string;
    riskLevel: 'high' | 'medium' | 'low';
    reasoning: string;
    alternatives: Array<{
      id: string;
      label: string;
      description: string;
      text: string;
    }>;
    cpcArticles: string[];
  }>;
  clarifyingQuestions?: Array<{
    id: string;
    question: string;
    options: Array<{ id: string; label: string; description: string }>;
  }>;
  summary: {
    totalClauses: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
  thinkingBlocks?: string[];
  processingTimeMs: number;
}

type AnalysisStatus = 'extracting' | 'analyzing' | 'error';

// ============================================================================
// Component
// ============================================================================

export function StepContract({
  state,
  onBack,
  onAnalysisComplete,
  onError,
  animationClass = '',
}: StepContractProps) {
  const [status, setStatus] = useState<AnalysisStatus>('extracting');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Se extrage conținutul documentului...');

  useEffect(() => {
    let isCancelled = false;

    async function runAnalysis() {
      try {
        // Step 1: Extract document content
        setStatus('extracting');
        setProgress(10);
        setStatusMessage('Se extrage conținutul documentului...');

        const content = await getDocumentContent(50000); // Get up to 50k chars

        if (isCancelled) return;

        if (!content || content.trim().length < 100) {
          onError('Documentul este prea scurt pentru analiză. Deschideți un contract valid.');
          return;
        }

        // Step 2: Send for analysis
        setStatus('analyzing');
        setProgress(30);
        setStatusMessage('Se analizează contractul cu AI Expert...');

        // Simulate progress during analysis
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) return prev;
            return prev + Math.random() * 10;
          });
        }, 2000);

        const result = await apiClient.analyzeContract({
          documentContent: content,
          caseId: state.caseId || undefined,
          clientId: state.clientId || undefined,
          premiumMode: true,
        });

        clearInterval(progressInterval);

        if (isCancelled) return;

        setProgress(100);
        setStatusMessage('Analiză completă!');

        // Small delay to show completion message
        setTimeout(() => {
          if (!isCancelled) {
            onAnalysisComplete(result);
          }
        }, 500);
      } catch (err) {
        if (isCancelled) return;

        setStatus('error');
        console.error('[StepContract] Analysis failed:', err);
        onError(err instanceof Error ? err.message : 'Eroare la analiza contractului');
      }
    }

    runAnalysis();

    return () => {
      isCancelled = true;
    };
  }, []); // Run once on mount

  return (
    <div className={`wizard-step step-contract ${animationClass}`.trim()}>
      {/* Header with Back Button */}
      <div className="contract-analysis-header">
        <button className="btn btn-secondary btn-back" onClick={onBack}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Înapoi
        </button>
        <h2 className="contract-analysis-title">Analiză Contract</h2>
      </div>

      {/* Analysis Progress */}
      <div className="analysis-progress-container">
        <div className="analysis-progress-icon">
          {status === 'error' ? (
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : (
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={status === 'analyzing' ? 'analyzing-icon' : ''}
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          )}
        </div>

        <div className="analysis-progress-bar-container">
          <div className="analysis-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <p className="analysis-progress-message">{statusMessage}</p>

        {status === 'analyzing' && (
          <p className="analysis-progress-hint">Analiza detaliată poate dura câteva minute...</p>
        )}

        {status === 'extracting' && (
          <div className="analysis-steps">
            <div className="analysis-step active">
              <div className="step-dot" />
              <span>Extragere conținut</span>
            </div>
            <div className="analysis-step">
              <div className="step-dot" />
              <span>Analiză AI</span>
            </div>
            <div className="analysis-step">
              <div className="step-dot" />
              <span>Identificare riscuri</span>
            </div>
          </div>
        )}

        {status === 'analyzing' && (
          <div className="analysis-steps">
            <div className="analysis-step done">
              <div className="step-dot" />
              <span>Extragere conținut</span>
            </div>
            <div className="analysis-step active">
              <div className="step-dot" />
              <span>Analiză AI</span>
            </div>
            <div className="analysis-step">
              <div className="step-dot" />
              <span>Identificare riscuri</span>
            </div>
          </div>
        )}
      </div>

      {/* CSS for this component - scoped styles */}
      <style>{`
        .step-contract {
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex: 1;
          min-height: 0;
        }

        .contract-analysis-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .contract-analysis-header .btn-back {
          padding: 6px 12px;
          font-size: 12px;
        }

        .contract-analysis-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .analysis-progress-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          border-radius: 8px;
          text-align: center;
        }

        .analysis-progress-icon {
          margin-bottom: 24px;
          color: var(--accent-primary);
        }

        .analysis-progress-icon svg.analyzing-icon {
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.05);
          }
        }

        .analysis-progress-bar-container {
          width: 100%;
          max-width: 280px;
          height: 6px;
          background: var(--bg-secondary);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .analysis-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-primary), var(--accent-hover));
          border-radius: 3px;
          transition: width 0.5s ease-out;
        }

        .analysis-progress-message {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          margin: 0 0 8px 0;
        }

        .analysis-progress-hint {
          font-size: 12px;
          color: var(--text-tertiary);
          margin: 0;
        }

        .analysis-steps {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-top: 24px;
        }

        .analysis-step {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-tertiary);
        }

        .analysis-step.active {
          color: var(--accent-primary);
        }

        .analysis-step.done {
          color: var(--status-success-text);
        }

        .step-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--border-default);
        }

        .analysis-step.active .step-dot {
          background: var(--accent-primary);
          animation: dotPulse 1.5s ease-in-out infinite;
        }

        .analysis-step.done .step-dot {
          background: var(--status-success-text);
        }

        @keyframes dotPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(0, 120, 212, 0.4);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(0, 120, 212, 0);
          }
        }
      `}</style>
    </div>
  );
}
