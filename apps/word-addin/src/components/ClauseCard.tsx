/**
 * ClauseCard Component
 * Displays a single analyzed contract clause with risk badge,
 * reasoning, alternatives, and action buttons.
 *
 * Features:
 * - Collapsible card with smooth animations
 * - Risk-based styling (high/medium/low)
 * - Alternative formulations with apply buttons
 * - Research legislation action
 * - Romanian UI labels
 */

import { CSSProperties, useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface Alternative {
  id: string;
  label: string; // 'Conservator' | 'Echilibrat' | 'Agresiv' or similar
  description: string;
  text: string;
}

export interface ClauseCardProps {
  /** Clause reference (e.g., "Art. 5.2") */
  clauseReference: string;
  /** The problematic clause text */
  clauseText: string;
  /** Risk level */
  riskLevel: 'high' | 'medium' | 'low';
  /** Explanation of why this clause is risky */
  reasoning: string;
  /** Alternative formulations */
  alternatives: Alternative[];
  /** CPC articles referenced */
  cpcArticles?: string[];
  /** Called when user clicks "Aplica" on an alternative */
  onApplyAlternative: (alternativeId: string, text: string) => void;
  /** Called when user clicks "Cerceteaza" */
  onResearch: () => void;
  /** Called when user clicks the clause to navigate to it in document */
  onNavigate?: () => void;
  /** Whether this card is in expanded detail view */
  isExpanded?: boolean;
  /** Toggle expanded state */
  onToggleExpand?: () => void;
}

// ============================================================================
// Risk Configuration
// ============================================================================

interface RiskBadgeConfig {
  emoji: string;
  label: string;
  color: string;
  borderColor: string;
  backgroundColor: string;
}

const RISK_CONFIG: Record<'high' | 'medium' | 'low', RiskBadgeConfig> = {
  high: {
    emoji: '',
    label: 'Risc ridicat',
    color: '#dc3545',
    borderColor: '#dc3545',
    backgroundColor: '#fde7e9',
  },
  medium: {
    emoji: '',
    label: 'Risc mediu',
    color: '#a36d00',
    borderColor: '#ffc107',
    backgroundColor: '#fff4ce',
  },
  low: {
    emoji: '',
    label: 'Risc scazut',
    color: '#28a745',
    borderColor: '#28a745',
    backgroundColor: '#dff6dd',
  },
};

const RISK_CONFIG_DARK: Record<'high' | 'medium' | 'low', RiskBadgeConfig> = {
  high: {
    emoji: '',
    label: 'Risc ridicat',
    color: '#ef9a9a',
    borderColor: '#f44336',
    backgroundColor: '#3a1e1e',
  },
  medium: {
    emoji: '',
    label: 'Risc mediu',
    color: '#ffcc02',
    borderColor: '#ffc107',
    backgroundColor: '#3d3418',
  },
  low: {
    emoji: '',
    label: 'Risc scazut',
    color: '#81c784',
    borderColor: '#4caf50',
    backgroundColor: '#1e3a1e',
  },
};

// ============================================================================
// Alternative Label Configuration
// ============================================================================

interface AlternativeLabelConfig {
  color: string;
  backgroundColor: string;
}

const ALT_LABEL_CONFIG: Record<string, AlternativeLabelConfig> = {
  conservator: {
    color: '#1565c0',
    backgroundColor: '#e3f2fd',
  },
  echilibrat: {
    color: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  agresiv: {
    color: '#ef6c00',
    backgroundColor: '#fff3e0',
  },
};

const ALT_LABEL_CONFIG_DARK: Record<string, AlternativeLabelConfig> = {
  conservator: {
    color: '#64b5f6',
    backgroundColor: '#0d2a42',
  },
  echilibrat: {
    color: '#81c784',
    backgroundColor: '#1b3320',
  },
  agresiv: {
    color: '#ffb74d',
    backgroundColor: '#3d2810',
  },
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (
  riskLevel: 'high' | 'medium' | 'low',
  isDarkMode: boolean,
  isExpanded: boolean
): Record<string, CSSProperties> => {
  const riskConfig = isDarkMode ? RISK_CONFIG_DARK[riskLevel] : RISK_CONFIG[riskLevel];

  return {
    card: {
      background: isDarkMode ? 'var(--bg-card)' : '#ffffff',
      border: `1px solid ${riskConfig.borderColor}`,
      borderRadius: '8px',
      marginBottom: '12px',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      borderLeftWidth: '4px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '12px 14px',
      cursor: 'pointer',
      transition: 'background 0.15s ease',
      background: isExpanded ? riskConfig.backgroundColor : 'transparent',
    },
    riskIndicator: {
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      backgroundColor: riskConfig.color,
      flexShrink: 0,
    },
    clauseRef: {
      fontWeight: 600,
      fontSize: '13px',
      color: isDarkMode ? 'var(--text-primary)' : '#323130',
      whiteSpace: 'nowrap' as const,
    },
    clausePreview: {
      flex: 1,
      fontSize: '12px',
      color: isDarkMode ? 'var(--text-secondary)' : '#605e5c',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    riskBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      borderRadius: '12px',
      fontSize: '10px',
      fontWeight: 600,
      backgroundColor: riskConfig.backgroundColor,
      color: riskConfig.color,
      whiteSpace: 'nowrap' as const,
    },
    expandIcon: {
      color: isDarkMode ? 'var(--text-tertiary)' : '#a19f9d',
      fontSize: '10px',
      transition: 'transform 0.2s ease',
      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
    },
    body: {
      padding: '0 14px 14px 14px',
      borderTop: `1px solid ${isDarkMode ? 'var(--border-default)' : '#edebe9'}`,
      animation: 'fadeIn 0.2s ease-out',
    },
    clauseTextSection: {
      marginTop: '12px',
    },
    clauseText: {
      margin: 0,
      padding: '12px',
      background: isDarkMode ? 'var(--bg-secondary)' : '#f3f2f1',
      borderRadius: '6px',
      borderLeft: `3px solid ${riskConfig.color}`,
      fontSize: '13px',
      lineHeight: '1.6',
      color: isDarkMode ? 'var(--text-primary)' : '#323130',
      fontStyle: 'italic',
      cursor: 'pointer',
    },
    sectionTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      margin: '16px 0 8px 0',
      fontSize: '12px',
      fontWeight: 600,
      color: isDarkMode ? 'var(--text-secondary)' : '#605e5c',
    },
    reasoning: {
      fontSize: '13px',
      lineHeight: '1.6',
      color: isDarkMode ? 'var(--text-primary)' : '#323130',
      margin: 0,
    },
    cpcArticles: {
      marginTop: '10px',
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '6px',
      alignItems: 'center',
    },
    cpcLabel: {
      fontSize: '11px',
      fontWeight: 500,
      color: isDarkMode ? 'var(--text-secondary)' : '#605e5c',
    },
    cpcTag: {
      display: 'inline-block',
      padding: '3px 8px',
      backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#f3f2f1',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 500,
      color: isDarkMode ? 'var(--text-primary)' : '#323130',
    },
    alternativesContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '10px',
    },
    alternative: {
      padding: '12px',
      backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#faf9f8',
      border: `1px solid ${isDarkMode ? 'var(--border-default)' : '#edebe9'}`,
      borderRadius: '6px',
    },
    altHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px',
    },
    altLabel: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
    },
    recommendedBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '10px',
      fontWeight: 500,
      backgroundColor: isDarkMode ? '#1b3320' : '#dff6dd',
      color: isDarkMode ? '#81c784' : '#107c10',
    },
    altDescription: {
      fontSize: '12px',
      color: isDarkMode ? 'var(--text-secondary)' : '#605e5c',
      margin: '0 0 8px 0',
      lineHeight: '1.5',
    },
    altText: {
      margin: 0,
      padding: '10px',
      backgroundColor: isDarkMode ? 'var(--bg-card)' : '#ffffff',
      border: `1px solid ${isDarkMode ? 'var(--border-default)' : '#edebe9'}`,
      borderRadius: '4px',
      fontSize: '12px',
      lineHeight: '1.5',
      color: isDarkMode ? 'var(--text-primary)' : '#323130',
      fontStyle: 'italic',
    },
    altActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: '10px',
    },
    btnPrimary: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      padding: '6px 14px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      border: 'none',
      backgroundColor: isDarkMode ? '#4fc3f7' : '#0078d4',
      color: '#ffffff',
    },
    btnOutline: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      padding: '8px 16px',
      borderRadius: '4px',
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      backgroundColor: isDarkMode ? 'var(--bg-card)' : '#ffffff',
      color: isDarkMode ? 'var(--text-primary)' : '#323130',
      border: `1px solid ${isDarkMode ? 'var(--border-strong)' : '#8a8886'}`,
    },
    clauseActions: {
      marginTop: '16px',
      paddingTop: '12px',
      borderTop: `1px solid ${isDarkMode ? 'var(--border-default)' : '#edebe9'}`,
    },
  };
};

// ============================================================================
// Component
// ============================================================================

export function ClauseCard({
  clauseReference,
  clauseText,
  riskLevel,
  reasoning,
  alternatives,
  cpcArticles,
  onApplyAlternative,
  onResearch,
  onNavigate,
  isExpanded: controlledExpanded,
  onToggleExpand,
}: ClauseCardProps) {
  // Internal expanded state (used when not controlled)
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Determine if controlled or uncontrolled
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  // Determine if dark mode is active
  const isDarkMode =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark';

  // Get styles based on current state
  const styles = createStyles(riskLevel, isDarkMode, isExpanded);
  const riskConfig = isDarkMode ? RISK_CONFIG_DARK[riskLevel] : RISK_CONFIG[riskLevel];
  const altLabelConfig = isDarkMode ? ALT_LABEL_CONFIG_DARK : ALT_LABEL_CONFIG;

  // Handle toggle
  const handleToggle = useCallback(() => {
    if (isControlled && onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  }, [isControlled, onToggleExpand]);

  // Handle apply alternative
  const handleApply = useCallback(
    (alt: Alternative) => {
      onApplyAlternative(alt.id, alt.text);
    },
    [onApplyAlternative]
  );

  // Get alternative label style
  const getAltLabelStyle = (label: string): CSSProperties => {
    const key = label.toLowerCase();
    const config = altLabelConfig[key] || altLabelConfig.echilibrat;
    return {
      ...styles.altLabel,
      backgroundColor: config.backgroundColor,
      color: config.color,
    };
  };

  return (
    <div style={styles.card} className={`clause-card risk-${riskLevel}`}>
      {/* Header */}
      <div
        style={styles.header}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <span style={styles.riskIndicator} aria-hidden="true" />
        <span style={styles.clauseRef}>{clauseReference}</span>
        {!isExpanded && (
          <span style={styles.clausePreview}>
            {clauseText.length > 50 ? `${clauseText.substring(0, 50)}...` : clauseText}
          </span>
        )}
        <span style={styles.riskBadge}>{riskConfig.label}</span>
        <span style={styles.expandIcon} aria-hidden="true">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={styles.body}>
          {/* Clause Text */}
          <div style={styles.clauseTextSection}>
            <blockquote
              style={styles.clauseText}
              onClick={onNavigate}
              title={onNavigate ? 'Click pentru a naviga la clauza' : undefined}
            >
              "{clauseText}"
            </blockquote>
          </div>

          {/* Reasoning */}
          <div>
            <h4 style={styles.sectionTitle}>
              <span role="img" aria-hidden="true">
                💭
              </span>{' '}
              Rationament
            </h4>
            <p style={styles.reasoning}>{reasoning}</p>
            {cpcArticles && cpcArticles.length > 0 && (
              <div style={styles.cpcArticles}>
                <span style={styles.cpcLabel}>Articole relevante:</span>
                {cpcArticles.map((article, index) => (
                  <span key={index} style={styles.cpcTag}>
                    {article}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Alternatives */}
          {alternatives.length > 0 && (
            <div>
              <h4 style={styles.sectionTitle}>
                <span role="img" aria-hidden="true">
                  📝
                </span>{' '}
                Alternative
              </h4>
              <div style={styles.alternativesContainer}>
                {alternatives.map((alt) => (
                  <div key={alt.id} style={styles.alternative}>
                    <div style={styles.altHeader}>
                      <span style={getAltLabelStyle(alt.label)}>{alt.label}</span>
                      {alt.label === 'Echilibrat' && (
                        <span style={styles.recommendedBadge}>recomandat</span>
                      )}
                    </div>
                    <p style={styles.altDescription}>{alt.description}</p>
                    <blockquote style={styles.altText}>"{alt.text}"</blockquote>
                    <div style={styles.altActions}>
                      <button
                        style={styles.btnPrimary}
                        onClick={() => handleApply(alt)}
                        onMouseOver={(e) => {
                          e.currentTarget.style.opacity = '0.9';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.opacity = '1';
                        }}
                      >
                        Aplica
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Research Button */}
          <div style={styles.clauseActions}>
            <button
              style={styles.btnOutline}
              onClick={onResearch}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-hover)' : '#f3f2f1';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-card)' : '#ffffff';
              }}
            >
              <span role="img" aria-hidden="true">
                🔍
              </span>{' '}
              Cerceteaza legislatie
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
