/**
 * TemplateForm Component
 * Form displayed after template selection in the wizard.
 *
 * Shows:
 * - Selected template info (name, description, CPC articles)
 * - Context preview with party labels from the template
 * - Instructions textarea for additional AI context
 * - Generate button
 */

import { useState } from 'react';
import type { WizardState } from '.';

// ============================================================================
// Types
// ============================================================================

// Imported from gateway service - replicated here for client-side use
type FormCategory = 'A' | 'B' | 'C';

interface CourtFilingTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  formCategory: FormCategory;
  cpcArticles: string[];
  partyLabels: {
    party1: string;
    party2: string;
    party3?: string;
  };
  requiredSections: string[];
  keywords: string[];
}

interface TemplateFormProps {
  template: CourtFilingTemplate;
  state: WizardState; // Contains caseId, clientId, contextType
  onBack: () => void; // Go back to template selection
  onGenerate: (instructions: string) => void;
  animationClass?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getFormCategoryLabel(formCategory: FormCategory): string {
  const labels: Record<FormCategory, string> = {
    A: 'Formular A',
    B: 'Formular B',
    C: 'Formular C',
  };
  return labels[formCategory];
}

function getFormCategoryTooltip(formCategory: FormCategory): string {
  const tooltips: Record<FormCategory, string> = {
    A: 'Art. 194 CPC - Cerere de chemare in judecata',
    B: 'Art. 205 CPC - Intampinare',
    C: 'Art. 148 CPC - Cerere generala',
  };
  return tooltips[formCategory];
}

// ============================================================================
// Component
// ============================================================================

export function TemplateForm({
  template,
  state: _state,
  onBack,
  onGenerate,
  animationClass = '',
}: TemplateFormProps) {
  const [instructions, setInstructions] = useState('');
  const [party1Value, setParty1Value] = useState('');
  const [party2Value, setParty2Value] = useState('');
  const [party3Value, setParty3Value] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    if (loading) return;
    setLoading(true);

    // Build full instructions with party info
    const partyInfo: string[] = [];
    if (party1Value.trim()) {
      partyInfo.push(`${template.partyLabels.party1}: ${party1Value.trim()}`);
    }
    if (party2Value.trim()) {
      partyInfo.push(`${template.partyLabels.party2}: ${party2Value.trim()}`);
    }
    if (template.partyLabels.party3 && party3Value.trim()) {
      partyInfo.push(`${template.partyLabels.party3}: ${party3Value.trim()}`);
    }

    const fullInstructions =
      partyInfo.length > 0
        ? `Parti:\n${partyInfo.join('\n')}\n\n${instructions.trim()}`
        : instructions.trim();

    onGenerate(fullInstructions);
  };

  return (
    <div className={`wizard-step step-template-form ${animationClass}`.trim()}>
      {/* Template Header - Compact */}
      <div className="template-form-header compact">
        <div className="template-form-title-row">
          <h3 className="template-form-name">{template.name}</h3>
          <span
            className={`form-category-badge form-category-${template.formCategory.toLowerCase()}`}
            title={getFormCategoryTooltip(template.formCategory)}
          >
            {getFormCategoryLabel(template.formCategory)}
          </span>
        </div>
        <div className="template-form-articles">
          {template.cpcArticles.map((article) => (
            <span key={article} className="cpc-article-tag">
              {article}
            </span>
          ))}
        </div>
      </div>

      {/* Parties Section */}
      <div className="wizard-section template-parties-section">
        <div className="section-title">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          Parti procesuale
          <span className="optional-label">(optional)</span>
        </div>
        <div className="template-party-inputs">
          <div className="party-input-row">
            <label className="party-label">{template.partyLabels.party1}:</label>
            <input
              type="text"
              className="input-field party-input"
              placeholder="Nume parte..."
              value={party1Value}
              onChange={(e) => setParty1Value(e.target.value)}
            />
          </div>
          <div className="party-input-row">
            <label className="party-label">{template.partyLabels.party2}:</label>
            <input
              type="text"
              className="input-field party-input"
              placeholder="Nume parte..."
              value={party2Value}
              onChange={(e) => setParty2Value(e.target.value)}
            />
          </div>
          {template.partyLabels.party3 && (
            <div className="party-input-row">
              <label className="party-label">{template.partyLabels.party3}:</label>
              <input
                type="text"
                className="input-field party-input"
                placeholder="Nume parte..."
                value={party3Value}
                onChange={(e) => setParty3Value(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Instructions Section - Expanded */}
      <div className="wizard-section template-instructions-section expanded">
        <div className="section-title">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Instructiuni suplimentare
          <span className="optional-label">(optional)</span>
        </div>
        <textarea
          className="input-field textarea expanded"
          placeholder="Ex: Adauga argumente despre incalcarea art. 6 din conventie..."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      {/* Navigation */}
      <div className="wizard-nav">
        <button className="btn btn-secondary" onClick={onBack}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ marginRight: 8 }}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Inapoi
        </button>
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={loading}
          style={{ flex: 1 }}
        >
          {loading ? (
            <>
              <span className="loading-spinner" style={{ width: 16, height: 16, margin: 0 }}></span>
              Se genereaza...
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Genereaza document
            </>
          )}
        </button>
      </div>
    </div>
  );
}
