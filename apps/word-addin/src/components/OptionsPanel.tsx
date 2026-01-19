/**
 * OptionsPanel Component
 * Full-width slide-up panel for selecting action options.
 *
 * Replaces the cramped ActionPopover with a proper panel
 * that shows options as cards with icons and descriptions.
 */

import { useEffect, useRef, useCallback, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ActionOption {
  value: string;
  label: string;
  description?: string;
}

interface OptionsPanelProps {
  title: string;
  icon: ReactNode;
  options: ActionOption[];
  onSelect: (value: string) => void;
  onClose: () => void;
}

// ============================================================================
// Option Icons (based on option value)
// ============================================================================

function getOptionIcon(value: string): JSX.Element {
  const icons: Record<string, JSX.Element> = {
    // Explain options
    simple: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
    professional: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    academic: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
    // Precedent options
    iccj: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    curtiApel: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
      </svg>
    ),
    all: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    // Improve options
    clarity: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    formality: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    brevity: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
      </svg>
    ),
    precision: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
    // Continue options
    short: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="17" y1="10" x2="3" y2="10" />
        <line x1="21" y1="6" x2="3" y2="6" />
        <line x1="12" y1="14" x2="3" y2="14" />
      </svg>
    ),
    medium: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="21" y1="6" x2="3" y2="6" />
        <line x1="21" y1="10" x2="3" y2="10" />
        <line x1="21" y1="14" x2="3" y2="14" />
        <line x1="17" y1="18" x2="3" y2="18" />
      </svg>
    ),
    long: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="21" y1="6" x2="3" y2="6" />
        <line x1="21" y1="10" x2="3" y2="10" />
        <line x1="21" y1="14" x2="3" y2="14" />
        <line x1="21" y1="18" x2="3" y2="18" />
      </svg>
    ),
    // Alternatives options
    '2': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="8" height="18" rx="1" />
        <rect x="13" y="3" width="8" height="18" rx="1" />
      </svg>
    ),
    '3': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="6" height="18" rx="1" />
        <rect x="9" y="3" width="6" height="18" rx="1" />
        <rect x="16" y="3" width="6" height="18" rx="1" />
      </svg>
    ),
    '5': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  };

  return (
    icons[value] || (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
      </svg>
    )
  );
}

// ============================================================================
// Component
// ============================================================================

export function OptionsPanel({ title, icon, options, onSelect, onClose }: OptionsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelect = useCallback(
    (value: string) => {
      onSelect(value);
    },
    [onSelect]
  );

  return (
    <div className="options-panel" ref={panelRef}>
      {/* Header */}
      <div className="options-header">
        <div className="options-title">
          <span className="options-title-icon">{icon}</span>
          {title}
        </div>
        <button className="options-close" onClick={onClose} title="Închide">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Options */}
      <div className="options-content">
        <div className="options-grid">
          {options.map((option) => (
            <button
              key={option.value}
              className="option-card"
              onClick={() => handleSelect(option.value)}
            >
              <div className="option-icon">{getOptionIcon(option.value)}</div>
              <div className="option-text">
                <div className="option-label">{option.label}</div>
                {option.description && (
                  <div className="option-description">{option.description}</div>
                )}
              </div>
              <svg
                className="option-arrow"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
