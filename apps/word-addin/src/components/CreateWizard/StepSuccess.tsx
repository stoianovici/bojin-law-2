/**
 * StepSuccess Component
 * Success state after document generation.
 *
 * Shows:
 * - Generation result confirmation
 * - Save to Platform button (case context only)
 * - "New document" reset button
 */

import type { WizardState, GenerationResult } from '.';
import { SaveToPlatformButton } from '../SaveToPlatformButton';

// ============================================================================
// Types
// ============================================================================

interface StepSuccessProps {
  state: WizardState;
  result: GenerationResult;
  onReset: () => void;
  onError: (error: string) => void;
  /** Called after successful save with document details for storing in Word properties */
  onSaveSuccess?: (result: {
    documentId: string;
    caseId: string;
    caseNumber: string;
    fileName: string;
  }) => void;
  animationClass?: string;
}

// ============================================================================
// Component
// ============================================================================

export function StepSuccess({
  state,
  result,
  onReset,
  onError,
  onSaveSuccess,
  animationClass = '',
}: StepSuccessProps) {
  return (
    <div className={`wizard-step step-success ${animationClass}`.trim()}>
      {/* Success Header */}
      <div className="success-header">
        <div className="success-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="16 10 10.5 15.5 8 13" />
          </svg>
        </div>
        <h2 className="success-title">Document generat</h2>
        <p className="success-subtitle">Conținutul a fost inserat în document</p>
      </div>

      {/* Stats */}
      <div className="success-stats">
        <div className="stat-item">
          <div className="stat-value">{result.tokensUsed.toLocaleString()}</div>
          <div className="stat-label">tokens</div>
        </div>
        <div className="stat-divider"></div>
        <div className="stat-item">
          <div className="stat-value">{formatDuration(result.processingTimeMs)}</div>
          <div className="stat-label">durată</div>
        </div>
      </div>

      {/* Document Info */}
      <div className="success-info">
        <div className="info-row">
          <span className="info-label">Titlu:</span>
          <span className="info-value">{result.title || state.documentName || 'Document nou'}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Tip:</span>
          <span className="info-value">{getCreateTypeLabel(state.createType)}</span>
        </div>
        {state.contextType !== 'internal' && (
          <div className="info-row">
            <span className="info-label">Context:</span>
            <span className="info-value">{state.contextType === 'case' ? 'Dosar' : 'Client'}</span>
          </div>
        )}
      </div>

      {/* Save to Platform - only for case context */}
      {state.contextType === 'case' && state.caseId && (
        <div className="success-save">
          <div className="save-prompt">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Salvați documentul în platformă pentru a-l păstra în dosarul clientului</span>
          </div>
          <SaveToPlatformButton
            caseId={state.caseId}
            caseNumber={state.caseNumber}
            documentName={state.documentName || result.title || 'Document generat'}
            generationMetadata={{
              tokensUsed: result.tokensUsed,
              processingTimeMs: result.processingTimeMs,
            }}
            onSuccess={(saveResult) => {
              onSaveSuccess?.({
                documentId: saveResult.documentId,
                caseId: state.caseId,
                caseNumber: state.caseNumber || saveResult.caseNumber || '',
                fileName: state.documentName || result.title || 'Document generat',
              });
            }}
            onError={(error: string) => onError(`Salvare eșuată: ${error}`)}
          />
        </div>
      )}

      {/* Actions */}
      <div className="success-actions">
        <button className="btn btn-primary" onClick={onReset} style={{ width: '100%' }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          Document nou
        </button>
      </div>

      {/* Tips */}
      <div className="success-tips">
        <div className="tips-title">Sfaturi</div>
        <ul className="tips-list">
          <li>Selectați text pentru a primi sugestii și îmbunătățiri</li>
          <li>Verificați și ajustați conținutul generat înainte de utilizare</li>
          <li>Salvați documentul în platformă pentru acces ulterior</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function getCreateTypeLabel(createType: string): string {
  const labels: Record<string, string> = {
    document: 'Document nou',
    template: 'Șablon',
    research: 'Cercetare juridică',
  };
  return labels[createType] || createType;
}
