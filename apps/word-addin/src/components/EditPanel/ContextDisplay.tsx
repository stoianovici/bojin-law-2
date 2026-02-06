/**
 * ContextDisplay Component
 * Displays the current edit scope (selection or whole document).
 *
 * Shows:
 * - Truncated selected text (max 80 chars) when text is selected in Word
 * - "Întreg documentul" badge when no selection (whole document scope)
 * - Loading state while selection is being detected
 */

import { useSelection } from '../../hooks/useSelection';

export function ContextDisplay() {
  const { hasSelection, selectedText, isLoading } = useSelection();

  // Truncate long text to 80 characters
  const displayText = hasSelection
    ? selectedText.length > 80
      ? selectedText.substring(0, 80) + '...'
      : selectedText
    : null;

  return (
    <div className="edit-panel__context">
      <div className="selection-context">
        <span className="selection-label">{hasSelection ? 'Selecție:' : 'Domeniu:'}</span>
        <span className="selection-text">
          {isLoading ? (
            'Se încarcă...'
          ) : hasSelection ? (
            <span className="selection-quote">&ldquo;{displayText}&rdquo;</span>
          ) : (
            <span className="selection-badge">Întreg documentul</span>
          )}
        </span>
      </div>
    </div>
  );
}
