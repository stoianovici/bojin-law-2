/**
 * Main Task Pane Component
 * Two-mode interface based on document state:
 *
 * 1. Loading: Checking document properties
 * 2. Ready: CreateWizard for document generation or EditPanel for conversational editing
 *    - If document has platform metadata, preset context is provided
 *    - Expert mode toggle (Partner/BusinessOwner only)
 */

import { useState, useCallback, useEffect } from 'react';
import { CreateWizard } from '../components/CreateWizard';
import { ExpertToggle } from '../components/ExpertToggle';
import { DebugToggle } from '../components/DebugToggle';
import { FormatTestPanel } from '../components/FormatTestPanel';
import { FormatSandbox } from '../components/FormatSandbox';
import { EditPanel } from '../components/EditPanel';
import { useAuth } from '../services/auth';
import { useOfficeTheme } from '../services/theme';
import { useDocumentContext } from '../hooks/useDocumentContext';
import { ExpertModeProvider, useExpertMode } from '../hooks/useExpertMode';
import { isDebugMode } from '../services/debug-mock';
import { apiClient } from '../services/api-client';

// ============================================================================
// Sandbox Mode Detection
// ============================================================================

/**
 * Check if sandbox mode is enabled via URL param
 */
function isSandboxModeFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('sandbox') === 'true';
}

// ============================================================================
// Main Export - Wraps with ExpertModeProvider
// ============================================================================

export function TaskPane() {
  return (
    <ExpertModeProvider>
      <TaskPaneContent />
    </ExpertModeProvider>
  );
}

// ============================================================================
// Inner Component
// ============================================================================

function TaskPaneContent() {
  const [error, setError] = useState<string | null>(null);
  const [debugModeEnabled, setDebugModeEnabled] = useState(isDebugMode());
  const [sandboxMode, setSandboxMode] = useState(isSandboxModeFromUrl());
  const [mode, setMode] = useState<'draft' | 'edit'>('draft');

  const { isAuthenticated, user, login, loading: authLoading, error: authError } = useAuth();

  // Keyboard shortcut: Ctrl+Shift+S to toggle sandbox mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setSandboxMode((prev) => !prev);
        console.log('[TaskPane] Sandbox mode toggled via keyboard shortcut');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const { mode: docMode, context: docContext, setContext } = useDocumentContext();
  const { isExpertMode, toggleExpertMode, canUseExpertMode, setUserRole } = useExpertMode();

  // Track debug mode changes (DebugToggle updates global state)
  useEffect(() => {
    const checkDebugMode = () => setDebugModeEnabled(isDebugMode());
    // Check periodically since debug mode can be toggled
    const interval = setInterval(checkDebugMode, 500);
    return () => clearInterval(interval);
  }, []);

  // Detect and apply Office theme (light/dark)
  useOfficeTheme();

  // Fetch user role from backend when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      apiClient
        .getCurrentUser()
        .then((userData) => {
          // Set role from backend (Partner, Associate, BusinessOwner, etc.)
          setUserRole(userData.role);
        })
        .catch((err) => {
          console.warn('[TaskPane] Failed to fetch user role, defaulting to Associate:', err);
          setUserRole('Associate');
        });
    }
  }, [isAuthenticated, setUserRole]);

  // Handle errors with auto-dismiss
  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    // Auto-dismiss after 5 seconds
    setTimeout(() => setError(null), 5000);
  }, []);

  // Handle wizard completion (save document context for future)
  const handleWizardSaveSuccess = useCallback(
    (result: { documentId: string; caseId?: string; caseNumber?: string; fileName: string }) => {
      setContext({
        documentId: result.documentId,
        caseId: result.caseId,
        caseNumber: result.caseNumber,
        fileName: result.fileName,
      });
    },
    [setContext]
  );

  // Show loading screen (auth or document context loading)
  if (authLoading || docMode === 'loading') {
    return (
      <div className="taskpane">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span>Se încarcă...</span>
        </div>
      </div>
    );
  }

  // Floating sandbox button (always visible in dev mode)
  const showDevSandboxButton = !import.meta.env.PROD && !sandboxMode;

  // Show sandbox mode if enabled (no auth required for testing)
  if (sandboxMode) {
    return (
      <>
        <FormatSandbox />
        {/* Exit sandbox button */}
        <button
          onClick={() => setSandboxMode(false)}
          style={{
            position: 'fixed',
            top: 8,
            right: 8,
            zIndex: 1001,
            padding: '4px 10px',
            fontSize: 10,
            background: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          ✕ Exit Sandbox
        </button>
      </>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="taskpane">
        {/* Debug Toggle - available even on login screen */}
        <div
          style={{ display: 'flex', justifyContent: 'flex-start', padding: '8px 12px 0', gap: 8 }}
        >
          <DebugToggle />
          {debugModeEnabled && (
            <button
              onClick={() => setSandboxMode(true)}
              style={{
                padding: '4px 8px',
                fontSize: 10,
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              🧪 Sandbox
            </button>
          )}
        </div>

        <div className="taskpane-header">
          <svg
            className="icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <h1>Bojin AI</h1>
        </div>

        <div className="empty-state">
          <svg
            className="empty-state-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
          <p className="empty-state-text">Conectați-vă pentru a accesa asistentul juridic AI.</p>
        </div>

        {authError && (
          <div className="error-message" style={{ marginBottom: '16px' }}>
            {authError}
          </div>
        )}

        <button className="btn btn-primary" onClick={login} style={{ width: '100%' }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Conectare cu Microsoft
        </button>

        <div className="taskpane-footer">Bojin AI</div>

        {/* Floating Sandbox Button - always visible in dev mode */}
        {!import.meta.env.PROD && (
          <button
            onClick={() => setSandboxMode(true)}
            title="Open Format Sandbox (Ctrl+Shift+S)"
            style={{
              position: 'fixed',
              bottom: 60,
              right: 12,
              zIndex: 999,
              width: 40,
              height: 40,
              padding: 0,
              fontSize: 18,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            🧪
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="taskpane">
      {/* Header with toggles */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px 0',
          borderBottom: isExpertMode ? '2px solid #f5c542' : 'none',
        }}
      >
        {/* Debug Toggle + Sandbox - dev only */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <DebugToggle />
          {debugModeEnabled && (
            <button
              onClick={() => setSandboxMode(true)}
              style={{
                padding: '4px 8px',
                fontSize: 10,
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              🧪 Sandbox
            </button>
          )}
        </div>

        {/* Mode Toggle - Draft/Edit */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`mode-btn ${mode === 'draft' ? 'active' : ''}`}
            onClick={() => setMode('draft')}
          >
            Creează
          </button>
          <button
            className={`mode-btn ${mode === 'edit' ? 'active' : ''}`}
            onClick={() => setMode('edit')}
          >
            Editare
          </button>
        </div>

        {/* Expert Mode Toggle - shown for Partners/BusinessOwners */}
        {canUseExpertMode ? (
          <ExpertToggle
            isEnabled={isExpertMode}
            onToggle={toggleExpertMode}
            canUse={canUseExpertMode}
          />
        ) : (
          <div />
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="error-dismiss" aria-label="Închide">
            ✕
          </button>
        </div>
      )}

      {/* Format Test Panel - shown when debug mode is enabled */}
      {debugModeEnabled && (
        <div style={{ padding: '0 12px' }}>
          <FormatTestPanel onError={handleError} />
        </div>
      )}

      {/* Main Content */}
      <div className="taskpane-content">
        {mode === 'edit' ? (
          <EditPanel />
        ) : (
          <CreateWizard
            onError={handleError}
            presetContext={
              docContext
                ? {
                    caseId: docContext.caseId,
                    caseNumber: docContext.caseNumber,
                    clientId: docContext.clientId,
                    clientName: docContext.clientName,
                  }
                : undefined
            }
            onSaveSuccess={handleWizardSaveSuccess}
          />
        )}
      </div>

      {/* Footer */}
      <div className="taskpane-footer">
        {isExpertMode && <span style={{ color: '#f5c542', marginRight: 8 }}>👑</span>}
        {user?.email || 'Utilizator'} · Bojin AI
      </div>

      {/* Floating Sandbox Button - always visible in dev mode */}
      {showDevSandboxButton && (
        <button
          onClick={() => setSandboxMode(true)}
          title="Open Format Sandbox (Ctrl+Shift+S)"
          style={{
            position: 'fixed',
            bottom: 60,
            right: 12,
            zIndex: 999,
            width: 40,
            height: 40,
            padding: 0,
            fontSize: 18,
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          🧪
        </button>
      )}
    </div>
  );
}
