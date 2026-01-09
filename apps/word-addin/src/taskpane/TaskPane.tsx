/**
 * Main Task Pane Component
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Provides AI-powered suggestions, explanations, and text improvements
 * directly within Word.
 */

import { useState, useEffect, useCallback } from 'react';
import { SuggestionsTab } from '../components/SuggestionsTab';
import { ExplainTab } from '../components/ExplainTab';
import { ImproveTab } from '../components/ImproveTab';
import { DraftTab } from '../components/DraftTab';
import { useAuth } from '../services/auth';
import { getSelectedText } from '../services/word-api';

type TabType = 'suggestions' | 'explain' | 'improve' | 'draft';

export function TaskPane() {
  const [activeTab, setActiveTab] = useState<TabType>('draft');
  const [selectedText, setSelectedText] = useState<string>('');
  const [cursorContext, setCursorContext] = useState<string>('');
  const [_isLoading, _setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isAuthenticated, user, login, loading: authLoading } = useAuth();

  // Read URL params for mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') as TabType | null;
    if (mode && ['suggestions', 'explain', 'improve', 'draft'].includes(mode)) {
      setActiveTab(mode);
    }
  }, []);

  // Get selected text from document
  const refreshSelection = useCallback(async () => {
    try {
      const { selectedText: text, context } = await getSelectedText();
      setSelectedText(text);
      setCursorContext(context);
    } catch (err) {
      console.error('Failed to get selection:', err);
    }
  }, []);

  // Listen for selection changes
  useEffect(() => {
    refreshSelection();

    // Set up selection change handler
    const handler = async () => {
      await refreshSelection();
    };

    // Poll for selection changes (Word API doesn't have a selection change event)
    const interval = setInterval(handler, 2000);

    return () => clearInterval(interval);
  }, [refreshSelection]);

  // Show login screen if not authenticated
  if (authLoading) {
    return (
      <div className="taskpane">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="taskpane">
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
          <h1>Legal AI Assistant</h1>
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
          <p className="empty-state-text">
            Sign in to access AI-powered legal document assistance.
          </p>
        </div>

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
          Sign in with Microsoft
        </button>

        <div className="taskpane-footer">Bojin Law Legal Platform</div>
      </div>
    );
  }

  return (
    <div className="taskpane">
      <div className="taskpane-header">
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <h1>Legal AI Assistant</h1>
      </div>

      {/* Selection Context */}
      {selectedText && (
        <div className="selection-context">
          <div className="selection-label">Selected Text</div>
          <div className="selection-text">
            {selectedText.length > 200 ? selectedText.substring(0, 200) + '...' : selectedText}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'draft' ? 'active' : ''}`}
          onClick={() => setActiveTab('draft')}
        >
          Draft
        </button>
        <button
          className={`tab ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          Suggest
        </button>
        <button
          className={`tab ${activeTab === 'explain' ? 'active' : ''}`}
          onClick={() => setActiveTab('explain')}
        >
          Explain
        </button>
        <button
          className={`tab ${activeTab === 'improve' ? 'active' : ''}`}
          onClick={() => setActiveTab('improve')}
        >
          Improve
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          {error}
          <button
            onClick={() => setError(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'draft' && <DraftTab onError={setError} />}
      {activeTab === 'suggestions' && (
        <SuggestionsTab
          selectedText={selectedText}
          cursorContext={cursorContext}
          onError={setError}
        />
      )}
      {activeTab === 'explain' && <ExplainTab selectedText={selectedText} onError={setError} />}
      {activeTab === 'improve' && <ImproveTab selectedText={selectedText} onError={setError} />}

      {/* Footer */}
      <div className="taskpane-footer">Signed in as {user?.email || 'User'} · Bojin Law</div>
    </div>
  );
}
