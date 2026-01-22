/**
 * Main Task Pane Component
 * Two-mode interface based on document state:
 *
 * 1. Loading: Checking document properties
 * 2. Ready: CreateWizard for document generation
 *    - If document has platform metadata, preset context is provided
 *    - SelectionToolbar for quick actions on selected text
 *    - Expert mode toggle (Partner/BusinessOwner only)
 */

import { useState, useCallback, useEffect } from 'react';
import { CreateWizard } from '../components/CreateWizard';
import { SelectionToolbar } from '../components/SelectionToolbar';
import { ExpertToggle } from '../components/ExpertToggle';
import { DebugToggle } from '../components/DebugToggle';
import { useAuth } from '../services/auth';
import { useOfficeTheme } from '../services/theme';
import { useDocumentContext } from '../hooks/useDocumentContext';
import { ExpertModeProvider, useExpertMode } from '../hooks/useExpertMode';

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

  const { isAuthenticated, user, login, loading: authLoading, error: authError } = useAuth();
  const { mode: docMode, context: docContext, setContext } = useDocumentContext();
  const { isExpertMode, toggleExpertMode, canUseExpertMode, setUserRole } = useExpertMode();

  // Detect and apply Office theme (light/dark)
  useOfficeTheme();

  // Set user role based on email when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.email) {
      const email = user.email.toLowerCase();
      if (email === 'lucian.bojin@bojin-law.com') {
        setUserRole('Partner');
      } else {
        setUserRole('Associate');
      }
    }
  }, [isAuthenticated, user?.email, setUserRole]);

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

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="taskpane">
        {/* Debug Toggle - available even on login screen */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '8px 12px 0' }}>
          <DebugToggle />
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
        {/* Debug Toggle - dev only */}
        <DebugToggle />

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

      {/* Main Content */}
      <div className="taskpane-content">
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
      </div>

      {/* Selection Toolbar - appears when text is selected */}
      <SelectionToolbar onError={handleError} />

      {/* Footer */}
      <div className="taskpane-footer">
        {isExpertMode && <span style={{ color: '#f5c542', marginRight: 8 }}>👑</span>}
        {user?.email || 'Utilizator'} · Bojin AI
      </div>
    </div>
  );
}
