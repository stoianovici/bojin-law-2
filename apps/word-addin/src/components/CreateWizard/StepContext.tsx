/**
 * StepContext Component
 * Step 1 of the Create Wizard - Context selection.
 *
 * User selects:
 * 1. Context type (Dosar/Client/Intern)
 * 2. Case or Client (if applicable)
 * 3. Creation type (Document nou/Șablon/Cercetare)
 */

import type { ReactNode } from 'react';
import type { WizardState, CreateType, ActiveCase, ActiveClient } from '.';

// ============================================================================
// Types
// ============================================================================

interface PresetContext {
  caseId?: string;
  caseNumber?: string;
  clientId?: string;
  clientName?: string;
}

interface StepContextProps {
  state: WizardState;
  cases: ActiveCase[];
  clients: ActiveClient[];
  loadingData: boolean;
  autoDetectedCase: string | null;
  presetContext?: PresetContext;
  onUpdate: (updates: Partial<WizardState>) => void;
  onRefresh: () => void;
  onNext: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function StepContext({
  state,
  cases,
  clients,
  loadingData,
  autoDetectedCase,
  presetContext,
  onUpdate,
  onRefresh,
  onNext,
}: StepContextProps) {
  // Validate context selection - always valid if preset context is provided
  const isContextValid = () => {
    if (presetContext) return true; // Context already set
    if (state.contextType === 'case') return !!state.caseId;
    if (state.contextType === 'client') return !!state.clientId;
    return true; // 'internal' always valid
  };

  const canProceed = isContextValid();

  return (
    <div className="wizard-step step-context">
      {/* Preset Context Badge - shown when editing from platform */}
      {presetContext && (
        <div className="preset-context-badge">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {presetContext.caseId ? (
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            ) : (
              <>
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </>
            )}
          </svg>
          <span>
            {presetContext.caseNumber
              ? `Dosar ${presetContext.caseNumber}`
              : presetContext.clientName || 'Document existent'}
          </span>
        </div>
      )}

      {/* Context Type Section - hidden when preset context is provided */}
      {!presetContext && (
        <div className="wizard-section">
          <div
            className="section-title"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              Context
            </div>
            <button
              onClick={onRefresh}
              disabled={loadingData}
              className="refresh-button"
              title="Reîmprospătare liste"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ animation: loadingData ? 'spin 1s linear infinite' : 'none' }}
              >
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </button>
          </div>

          {/* Context Type Toggle */}
          <div className="context-type-toggle">
            <button
              onClick={() => onUpdate({ contextType: 'case' })}
              className={`context-type-btn ${state.contextType === 'case' ? 'active' : ''}`}
            >
              Dosar
            </button>
            <button
              onClick={() => onUpdate({ contextType: 'client' })}
              className={`context-type-btn ${state.contextType === 'client' ? 'active' : ''}`}
            >
              Client
            </button>
            <button
              onClick={() => onUpdate({ contextType: 'internal' })}
              className={`context-type-btn ${state.contextType === 'internal' ? 'active' : ''}`}
            >
              Intern
            </button>
          </div>

          {/* Case/Client Selector */}
          <div className="context-selector">
            {loadingData ? (
              <div className="loading-text">Se încarcă...</div>
            ) : state.contextType === 'case' ? (
              <>
                {cases.length > 0 ? (
                  <select
                    className="input-field"
                    value={state.caseId}
                    onChange={(e) => {
                      const selectedCase = cases.find((c) => c.id === e.target.value);
                      onUpdate({
                        caseId: e.target.value,
                        caseNumber: selectedCase?.caseNumber || '',
                      });
                    }}
                  >
                    <option value="">Selectați dosarul</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseNumber} - {c.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="input-field"
                    placeholder="ID dosar (ex: abc123...)"
                    value={state.caseId}
                    onChange={(e) => onUpdate({ caseId: e.target.value, caseNumber: '' })}
                  />
                )}
                {autoDetectedCase && (
                  <div className="auto-detected-hint">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="hint-icon"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Dosar detectat automat: {autoDetectedCase}
                  </div>
                )}
              </>
            ) : state.contextType === 'client' ? (
              <>
                {clients.length > 0 ? (
                  <select
                    className="input-field"
                    value={state.clientId}
                    onChange={(e) => onUpdate({ clientId: e.target.value })}
                  >
                    <option value="">Selectați clientul</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type === 'Individual' ? 'PF' : 'PJ'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="input-field"
                    placeholder="ID client (ex: abc123...)"
                    value={state.clientId}
                    onChange={(e) => onUpdate({ clientId: e.target.value })}
                  />
                )}
              </>
            ) : (
              <div className="internal-hint">
                Document intern - fără context specific de dosar sau client
              </div>
            )}
          </div>
        </div>
      )}

      {/* Creation Type Section */}
      <div className="wizard-section">
        <div className="section-title">
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
          Tip conținut
        </div>

        <div className="create-type-cards">
          <CreateTypeCard
            type="document"
            title="Document nou"
            description="Generează un document juridic de la zero"
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            }
            selected={state.createType === 'document'}
            onSelect={() => {
              if (canProceed) {
                onUpdate({ createType: 'document' });
                onNext();
              }
            }}
          />
          <CreateTypeCard
            type="template"
            title="Șablon"
            description="Completează un șablon predefinit"
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            }
            selected={state.createType === 'template'}
            onSelect={() => {
              if (canProceed) {
                onUpdate({ createType: 'template' });
                onNext();
              }
            }}
            badge="În curând"
          />
          <CreateTypeCard
            type="research"
            title="Cercetare"
            description="Cercetare juridică aprofundată"
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            }
            selected={state.createType === 'research'}
            onSelect={() => {
              if (canProceed) {
                onUpdate({ createType: 'research' });
                onNext();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface CreateTypeCardProps {
  type: CreateType;
  title: string;
  description: string;
  icon: ReactNode;
  selected: boolean;
  onSelect: () => void;
  badge?: string;
}

function CreateTypeCard({
  title,
  description,
  icon,
  selected,
  onSelect,
  badge,
}: CreateTypeCardProps) {
  return (
    <div
      className={`create-type-card ${selected ? 'selected' : ''} ${badge ? 'disabled' : ''}`}
      onClick={badge ? undefined : onSelect}
    >
      <div className="card-icon">{icon}</div>
      <div className="card-content">
        <div className="card-title">
          {title}
          {badge && <span className="card-badge">{badge}</span>}
        </div>
        <div className="card-description">{description}</div>
      </div>
    </div>
  );
}
