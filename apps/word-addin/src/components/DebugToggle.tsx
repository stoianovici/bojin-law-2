/**
 * Debug Toggle Component
 * Enables mock mode for testing document formatting without API calls.
 */

import { useState } from 'react';
import { setDebugMode, isDebugMode } from '../services/debug-mock';

export function DebugToggle() {
  const [enabled, setEnabled] = useState(isDebugMode());

  const handleToggle = () => {
    const newValue = !enabled;
    setDebugMode(newValue);
    setEnabled(newValue);
  };

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <button
      onClick={handleToggle}
      title={enabled ? 'Debug: ON (using mock data)' : 'Debug: OFF (using real API)'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        fontSize: '11px',
        fontWeight: 500,
        color: enabled ? '#fff' : '#666',
        backgroundColor: enabled ? '#e53935' : 'transparent',
        border: enabled ? '1px solid #c62828' : '1px solid #ccc',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
      {enabled ? 'MOCK' : 'Debug'}
    </button>
  );
}
