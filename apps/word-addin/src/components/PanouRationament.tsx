/**
 * PanouRationament - Reasoning Panel Component
 * Displays AI thinking blocks in a collapsible panel.
 * Used in premium mode to show AI reasoning process.
 */

import { useState, CSSProperties, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

interface PanouRationamentProps {
  /** Array of thinking/reasoning text blocks */
  thinkingBlocks: string[];
  /** Initial expanded state (default: true) */
  defaultExpanded?: boolean;
  /** Optional title override */
  title?: string;
}

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, CSSProperties> = {
  panel: {
    background: 'var(--bg-secondary)',
    borderLeft: '3px solid var(--accent-primary)',
    borderRadius: '0 8px 8px 0',
    marginBottom: '12px',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: 'transparent',
    border: 'none',
    width: '100%',
    cursor: 'pointer',
    textAlign: 'left' as const,
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'background 0.15s ease',
  },
  headerHover: {
    background: 'var(--bg-hover)',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  titleIcon: {
    fontSize: '14px',
    lineHeight: 1,
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    background: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: 1,
    transition: 'transform 0.2s ease',
  },
  toggleExpanded: {
    transform: 'rotate(180deg)',
  },
  content: {
    padding: '0 12px 12px 12px',
    animation: 'fadeIn 0.2s ease-out',
  },
  block: {
    marginBottom: '8px',
  },
  blockLast: {
    marginBottom: 0,
  },
  list: {
    margin: 0,
    padding: '0 0 0 16px',
    listStyleType: 'disc',
  },
  listItem: {
    fontSize: '12px',
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
    marginBottom: '4px',
  },
  listItemLast: {
    marginBottom: 0,
  },
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Formats a thinking block into readable bullet points.
 * Splits by newlines and removes leading bullet characters.
 */
function formatThinkingBlock(text: string, blockIndex: number, totalBlocks: number): ReactNode {
  const lines = text.split('\n').filter((line) => line.trim());

  if (lines.length === 0) {
    return null;
  }

  const isLastBlock = blockIndex === totalBlocks - 1;

  return (
    <div style={isLastBlock ? styles.blockLast : styles.block}>
      <ul style={styles.list}>
        {lines.map((line, i) => {
          const isLastItem = i === lines.length - 1;
          // Remove common bullet prefixes (-, *, bullet character)
          const cleanedLine = line.replace(/^[-\u2022*]\s*/, '').trim();

          return (
            <li key={i} style={isLastItem ? styles.listItemLast : styles.listItem}>
              {cleanedLine}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function PanouRationament({
  thinkingBlocks,
  defaultExpanded = true,
  title = 'Rationament',
}: PanouRationamentProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isHovered, setIsHovered] = useState(false);

  // Return null if no thinking blocks provided
  if (!thinkingBlocks || thinkingBlocks.length === 0) {
    return null;
  }

  // Filter out empty blocks
  const validBlocks = thinkingBlocks.filter((block) => block && block.trim());
  if (validBlocks.length === 0) {
    return null;
  }

  const headerStyle: CSSProperties = {
    ...styles.header,
    ...(isHovered ? styles.headerHover : {}),
  };

  const toggleStyle: CSSProperties = {
    ...styles.toggle,
    ...(isExpanded ? styles.toggleExpanded : {}),
  };

  return (
    <div style={styles.panel} className="rationament-panel">
      <button
        style={headerStyle}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-expanded={isExpanded}
        aria-controls="rationament-content"
      >
        <span style={styles.title}>
          <span style={styles.titleIcon} role="img" aria-hidden="true">
            💭
          </span>
          {title}
        </span>
        <span style={toggleStyle} aria-hidden="true">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {isExpanded && (
        <div id="rationament-content" style={styles.content}>
          {validBlocks.map((block, index) => (
            <div key={index}>{formatThinkingBlock(block, index, validBlocks.length)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
