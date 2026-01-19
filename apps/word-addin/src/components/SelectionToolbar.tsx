/**
 * SelectionToolbar Component
 * Floating toolbar with 7 quick actions for selected text.
 *
 * Analyze actions: Explică, Verifică, Riscuri, Precedente
 * Transform actions: Îmbunătățește, Continuă, Alternative
 */

import { useState, useCallback } from 'react';
import { useSelection } from '../hooks/useSelection';
import { OptionsPanel, ActionOption } from './OptionsPanel';
import { ResultsPanel, ResultData } from './ResultsPanel';
import { apiClient } from '../services/api-client';

// ============================================================================
// Icon Component
// ============================================================================

type IconName = 'info' | 'check' | 'alert' | 'book' | 'sparkles' | 'arrow-right' | 'refresh';

function ActionIcon({ name }: { name: IconName }) {
  const icons: Record<IconName, JSX.Element> = {
    info: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    check: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    alert: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    book: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    sparkles: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    'arrow-right': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    ),
    refresh: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    ),
  };
  return icons[name] || null;
}

// ============================================================================
// Types
// ============================================================================

type ActionType =
  | 'explain'
  | 'verify'
  | 'risks'
  | 'precedents'
  | 'improve'
  | 'continue'
  | 'alternatives';

interface ActionConfig {
  type: ActionType;
  label: string;
  icon: string;
  category: 'analyze' | 'transform';
  options?: ActionOption[];
}

// ============================================================================
// Action Configurations
// ============================================================================

const ACTIONS: ActionConfig[] = [
  // Analyze actions
  {
    type: 'explain',
    label: 'Explică',
    icon: 'info',
    category: 'analyze',
    options: [
      { value: 'simple', label: 'Termeni simpli', description: 'Pentru client non-jurist' },
      { value: 'professional', label: 'Profesional', description: 'Pentru avocat' },
      { value: 'academic', label: 'Academic', description: 'Cu referințe doctrinare' },
    ],
  },
  {
    type: 'verify',
    label: 'Verifică',
    icon: 'check',
    category: 'analyze',
  },
  {
    type: 'risks',
    label: 'Riscuri',
    icon: 'alert',
    category: 'analyze',
  },
  {
    type: 'precedents',
    label: 'Precedente',
    icon: 'book',
    category: 'analyze',
    options: [
      { value: 'iccj', label: 'ÎCCJ', description: 'Înalta Curte de Casație și Justiție' },
      { value: 'curtiApel', label: 'Curți de Apel', description: 'Jurisprudență regională' },
      { value: 'all', label: 'Toate', description: 'Toate instanțele' },
    ],
  },
  // Transform actions
  {
    type: 'improve',
    label: 'Îmbunătățește',
    icon: 'sparkles',
    category: 'transform',
    options: [
      { value: 'clarity', label: 'Claritate', description: 'Mai ușor de înțeles' },
      { value: 'formality', label: 'Formalitate', description: 'Ton juridic profesional' },
      { value: 'brevity', label: 'Concizie', description: 'Mai scurt și la obiect' },
      { value: 'precision', label: 'Precizie', description: 'Terminologie exactă' },
    ],
  },
  {
    type: 'continue',
    label: 'Continuă',
    icon: 'arrow-right',
    category: 'transform',
    options: [
      { value: 'short', label: 'Scurt', description: '1-2 propoziții' },
      { value: 'medium', label: 'Mediu', description: 'Un paragraf' },
      { value: 'long', label: 'Lung', description: 'Mai multe paragrafe' },
    ],
  },
  {
    type: 'alternatives',
    label: 'Alternative',
    icon: 'refresh',
    category: 'transform',
    options: [
      { value: '2', label: '2 variante', description: 'Rapid' },
      { value: '3', label: '3 variante', description: 'Echilibrat' },
      { value: '5', label: '5 variante', description: 'Comprehensiv' },
    ],
  },
];

// ============================================================================
// Component
// ============================================================================

interface SelectionToolbarProps {
  onError: (error: string) => void;
}

export function SelectionToolbar({ onError }: SelectionToolbarProps) {
  const { hasSelection, selectedText, cursorContext } = useSelection();
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);

  // Handle action click
  const handleActionClick = useCallback((action: ActionConfig) => {
    if (action.options && action.options.length > 0) {
      // Open popover for options
      setActiveAction(action.type);
    } else {
      // Execute action immediately
      executeAction(action.type, null);
    }
  }, []);

  // Handle option select from popover
  const handleOptionSelect = useCallback((actionType: ActionType, optionValue: string) => {
    setActiveAction(null);
    executeAction(actionType, optionValue);
  }, []);

  // Close popover
  const handleClosePopover = useCallback(() => {
    setActiveAction(null);
  }, []);

  // Execute action
  const executeAction = useCallback(
    async (actionType: ActionType, option: string | null) => {
      if (!selectedText) return;

      setLoading(true);
      setResult(null);

      try {
        let resultData: ResultData;

        switch (actionType) {
          case 'explain': {
            const response = await apiClient.explainText({
              selectedText,
              customInstructions:
                option === 'simple'
                  ? 'Explică în termeni foarte simpli, evitând jargonul juridic'
                  : option === 'academic'
                    ? 'Include referințe doctrinare și explicații academice'
                    : undefined,
            });
            resultData = {
              type: 'explain',
              title: 'Explicație',
              content: response.explanation,
              metadata: {
                legalBasis: response.legalBasis,
                sourceReferences: response.sourceReferences,
              },
            };
            break;
          }

          case 'verify': {
            const response = await apiClient.explainText({
              selectedText,
              customInstructions:
                'Verifică corectitudinea juridică a acestui text. Identifică eventuale erori, inconsistențe sau afirmații nefondate.',
            });
            resultData = {
              type: 'verify',
              title: 'Verificare',
              content: response.explanation,
              metadata: {
                legalBasis: response.legalBasis,
              },
            };
            break;
          }

          case 'risks': {
            const response = await apiClient.explainText({
              selectedText,
              customInstructions:
                'Identifică toate riscurile juridice potențiale din acest text. Include riscuri contractuale, procedurale și de interpretare.',
            });
            resultData = {
              type: 'risks',
              title: 'Riscuri identificate',
              content: response.explanation,
            };
            break;
          }

          case 'precedents': {
            const response = await apiClient.getSuggestions({
              selectedText,
              cursorContext,
              suggestionType: 'precedent',
              customInstructions:
                option === 'iccj'
                  ? 'Caută doar hotărâri ÎCCJ'
                  : option === 'curtiApel'
                    ? 'Caută hotărâri de la Curțile de Apel'
                    : undefined,
            });
            resultData = {
              type: 'precedents',
              title: 'Precedente',
              content: response.suggestions.map((s) => s.content).join('\n\n'),
              suggestions: response.suggestions,
            };
            break;
          }

          case 'improve': {
            const response = await apiClient.improveText({
              selectedText,
              improvementType:
                (option as 'clarity' | 'formality' | 'brevity' | 'legal_precision') || 'clarity',
            });
            resultData = {
              type: 'improve',
              title: 'Text îmbunătățit',
              content: response.improved,
              original: response.original,
              metadata: {
                explanation: response.explanation,
              },
              canApply: true,
              ooxmlContent: response.ooxmlContent,
            };
            break;
          }

          case 'continue': {
            const response = await apiClient.getSuggestions({
              selectedText,
              cursorContext,
              suggestionType: 'completion',
              customInstructions:
                option === 'short'
                  ? 'Generează doar 1-2 propoziții'
                  : option === 'long'
                    ? 'Generează mai multe paragrafe detaliate'
                    : 'Generează un paragraf',
            });
            resultData = {
              type: 'continue',
              title: 'Continuare',
              content: response.suggestions[0]?.content || '',
              suggestions: response.suggestions,
              canApply: true,
            };
            break;
          }

          case 'alternatives': {
            const count = parseInt(option || '3', 10);
            const response = await apiClient.getSuggestions({
              selectedText,
              cursorContext,
              suggestionType: 'alternative',
              customInstructions: `Generează exact ${count} variante alternative`,
            });
            resultData = {
              type: 'alternatives',
              title: 'Alternative',
              content: '',
              suggestions: response.suggestions.slice(0, count),
            };
            break;
          }

          default:
            throw new Error('Acțiune necunoscută');
        }

        setResult(resultData);
      } catch (err) {
        console.error('[SelectionToolbar] Action error:', err);
        onError((err as Error)?.message || 'Acțiunea a eșuat');
      } finally {
        setLoading(false);
      }
    },
    [selectedText, cursorContext, onError]
  );

  // Clear result
  const handleDismiss = useCallback(() => {
    setResult(null);
  }, []);

  // Don't render if no selection
  if (!hasSelection && !result) {
    return null;
  }

  return (
    <>
      {/* Toolbar - hidden when options panel is open */}
      {hasSelection && !result && !activeAction && (
        <div className={`selection-toolbar ${loading ? 'loading' : ''}`}>
          <div className="toolbar-section">
            <div className="toolbar-section-label">Analizează</div>
            <div className="toolbar-actions">
              {ACTIONS.filter((a) => a.category === 'analyze').map((action) => (
                <div key={action.type} className="toolbar-action-wrapper">
                  <button
                    className={`toolbar-action ${activeAction === action.type ? 'active' : ''}`}
                    onClick={() => handleActionClick(action)}
                    disabled={loading}
                    title={action.label}
                  >
                    <span className="action-icon">
                      <ActionIcon name={action.icon as IconName} />
                    </span>
                    <span className="action-label">{action.label}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="toolbar-divider"></div>

          <div className="toolbar-section">
            <div className="toolbar-section-label">Transformă</div>
            <div className="toolbar-actions">
              {ACTIONS.filter((a) => a.category === 'transform').map((action) => (
                <div key={action.type} className="toolbar-action-wrapper">
                  <button
                    className={`toolbar-action ${activeAction === action.type ? 'active' : ''}`}
                    onClick={() => handleActionClick(action)}
                    disabled={loading}
                    title={action.label}
                  >
                    <span className="action-icon">
                      <ActionIcon name={action.icon as IconName} />
                    </span>
                    <span className="action-label">{action.label}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {loading && (
            <div className="toolbar-loading">
              <span className="loading-spinner" style={{ width: 14, height: 14 }}></span>
            </div>
          )}
        </div>
      )}

      {/* Options Panel - shown when an action with options is selected */}
      {activeAction &&
        (() => {
          const action = ACTIONS.find((a) => a.type === activeAction);
          if (!action?.options) return null;
          return (
            <OptionsPanel
              title={action.label}
              icon={<ActionIcon name={action.icon as IconName} />}
              options={action.options}
              onSelect={(value) => handleOptionSelect(activeAction, value)}
              onClose={handleClosePopover}
            />
          );
        })()}

      {/* Results Panel */}
      {result && <ResultsPanel result={result} onDismiss={handleDismiss} onError={onError} />}
    </>
  );
}
