/**
 * ClarifyingQuestion Component
 * Displays an expert clarifying question with radio button options.
 * Used in contract analysis flow for expert mode Q&A.
 *
 * - Card-like appearance matching add-in theme
 * - Radio button options (2-4 per question)
 * - Optional skip functionality
 * - Loading state support
 * - All text in Romanian
 */

import { useState, CSSProperties } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface QuestionOption {
  id: string;
  label: string;
  description: string;
}

interface ClarifyingQuestionProps {
  /** The question text */
  question: string;
  /** Available answer options (2-4) */
  options: QuestionOption[];
  /** Called when user selects an answer */
  onAnswer: (optionId: string) => void;
  /** Called when user skips the question */
  onSkip?: () => void;
  /** Whether to show skip option */
  showSkip?: boolean;
  /** Loading state */
  isLoading?: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, CSSProperties> = {
  container: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  icon: {
    fontSize: '16px',
    lineHeight: 1,
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  questionText: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    lineHeight: 1.5,
    marginBottom: '16px',
  },
  optionsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginBottom: '16px',
  },
  optionLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  optionLabelSelected: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px',
    background: 'var(--bg-selected)',
    border: '1px solid var(--accent-primary)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  optionLabelDisabled: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: '6px',
    cursor: 'not-allowed',
    opacity: 0.6,
    transition: 'all 0.15s ease',
  },
  radioInput: {
    margin: 0,
    marginTop: '2px',
    flexShrink: 0,
    width: '16px',
    height: '16px',
    accentColor: 'var(--accent-primary)',
  },
  optionContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    flex: 1,
    minWidth: 0,
  },
  optionText: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    lineHeight: 1.4,
  },
  optionDescription: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    border: 'none',
    background: 'var(--accent-primary)',
    color: '#fff',
    width: '100%',
  },
  primaryButtonDisabled: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'not-allowed',
    transition: 'all 0.15s ease',
    border: 'none',
    background: 'var(--disabled-bg)',
    color: 'var(--disabled-text)',
    width: '100%',
  },
  skipButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
    background: 'none',
    border: 'none',
    color: 'var(--text-link)',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    width: '100%',
  },
  skipButtonDisabled: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
    background: 'none',
    border: 'none',
    color: 'var(--disabled-text)',
    fontSize: '13px',
    cursor: 'not-allowed',
    width: '100%',
  },
};

// ============================================================================
// Component
// ============================================================================

export function ClarifyingQuestion({
  question,
  options,
  onAnswer,
  onSkip,
  showSkip = true,
  isLoading = false,
}: ClarifyingQuestionProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selectedOption) {
      onAnswer(selectedOption);
    }
  };

  const getOptionStyle = (optionId: string): CSSProperties => {
    if (isLoading) {
      return styles.optionLabelDisabled;
    }
    if (selectedOption === optionId) {
      return styles.optionLabelSelected;
    }
    return styles.optionLabel;
  };

  return (
    <div style={styles.container} className="clarifying-question">
      {/* Header */}
      <div style={styles.header} className="question-header">
        <span style={styles.icon} role="img" aria-hidden="true">
          ❓
        </span>
        <span style={styles.label}>Întrebare</span>
      </div>

      {/* Question Text */}
      <p style={styles.questionText} className="question-text">
        {question}
      </p>

      {/* Options */}
      <div style={styles.optionsContainer} className="question-options">
        {options.map((option) => (
          <label
            key={option.id}
            style={getOptionStyle(option.id)}
            className={`question-option ${selectedOption === option.id ? 'selected' : ''}`}
          >
            <input
              type="radio"
              name="question-option"
              value={option.id}
              checked={selectedOption === option.id}
              onChange={() => setSelectedOption(option.id)}
              disabled={isLoading}
              style={styles.radioInput}
            />
            <div style={styles.optionContent} className="option-content">
              <span style={styles.optionText} className="option-label">
                {option.label}
              </span>
              {option.description && (
                <span style={styles.optionDescription} className="option-description">
                  {option.description}
                </span>
              )}
            </div>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div style={styles.actions} className="question-actions">
        <button
          style={!selectedOption || isLoading ? styles.primaryButtonDisabled : styles.primaryButton}
          onClick={handleSubmit}
          disabled={!selectedOption || isLoading}
          className="btn btn-primary"
        >
          {isLoading ? 'Se procesează...' : 'Continuă'}
        </button>

        {showSkip && onSkip && (
          <button
            style={isLoading ? styles.skipButtonDisabled : styles.skipButton}
            onClick={onSkip}
            disabled={isLoading}
            className="btn btn-link"
          >
            Folosește valorile implicite
          </button>
        )}
      </div>
    </div>
  );
}
