/**
 * ExpertToggle Component
 * Toggle for enabling Expert Mode (Mod Expert) in the Word add-in.
 *
 * - Only visible to users with Partner/BusinessOwner roles
 * - Session-based toggle state
 * - Visual indicator with crown icon when active
 */

import { CSSProperties } from 'react';

// ============================================================================
// Types
// ============================================================================

interface ExpertToggleProps {
  /** Whether expert mode is currently enabled */
  isEnabled: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
  /** Whether the user can use expert mode (based on role) */
  canUse: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, CSSProperties> = {
  toggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '16px',
    border: '1px solid var(--border-default)',
    background: 'var(--bg-card)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    transition: 'all 0.15s ease',
  },
  toggleActive: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '16px',
    border: '1px solid #f5c542',
    background: 'linear-gradient(135deg, #fef9e7 0%, #fdf3cd 100%)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 600,
    color: '#8b6914',
    transition: 'all 0.15s ease',
    boxShadow: '0 1px 3px rgba(245, 197, 66, 0.3)',
  },
  toggleActiveDark: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '16px',
    border: '1px solid #f5c542',
    background: 'linear-gradient(135deg, #3d3418 0%, #4a3f1a 100%)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 600,
    color: '#f5c542',
    transition: 'all 0.15s ease',
    boxShadow: '0 1px 3px rgba(245, 197, 66, 0.2)',
  },
  icon: {
    fontSize: '12px',
    lineHeight: 1,
  },
  label: {
    whiteSpace: 'nowrap' as const,
  },
};

// ============================================================================
// Component
// ============================================================================

export function ExpertToggle({ isEnabled, onToggle, canUse }: ExpertToggleProps) {
  // Don't render if user cannot use expert mode
  if (!canUse) {
    return null;
  }

  // Determine if dark mode is active
  const isDarkMode =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark';

  // Get the appropriate style based on state
  const getToggleStyle = (): CSSProperties => {
    if (!isEnabled) {
      return styles.toggle;
    }
    return isDarkMode ? styles.toggleActiveDark : styles.toggleActive;
  };

  return (
    <button
      style={getToggleStyle()}
      onClick={onToggle}
      title={isEnabled ? 'Dezactivare Mod Expert' : 'Activare Mod Expert'}
      aria-pressed={isEnabled}
      aria-label={`Mod Expert: ${isEnabled ? 'ON' : 'OFF'}`}
    >
      <span style={styles.icon} role="img" aria-hidden="true">
        {isEnabled ? '👑' : '👤'}
      </span>
      <span style={styles.label}>Mod Expert: {isEnabled ? 'ON' : 'OFF'}</span>
    </button>
  );
}
