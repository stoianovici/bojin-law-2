/**
 * GeneratingProgress Component
 * Shows detailed progress during document/research generation.
 *
 * Displays:
 * - Phase timeline (Research → Writing → Complete)
 * - Current activity with context
 * - Search queries and results
 * - Streaming content preview
 */

import { useMemo } from 'react';
import type { CreateType } from '.';

// ============================================================================
// Types
// ============================================================================

interface ProgressEvent {
  type: string;
  tool?: string;
  input?: Record<string, unknown>;
  result?: string;
  text?: string;
  phase?: string;
}

interface GeneratingProgressProps {
  createType: CreateType;
  progressEvents: ProgressEvent[];
  streamingContent: string;
  animationClass?: string;
}

type Phase = 'research' | 'writing' | 'complete';

// ============================================================================
// Helper Functions
// ============================================================================

function getCurrentPhase(events: ProgressEvent[]): Phase {
  // Find the latest phase event
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === 'phase_start') {
      if (event.phase === 'writing' || event.phase === 'assembly') {
        return 'writing';
      }
      return 'research';
    }
    if (event.type === 'phase_complete' && event.phase === 'writing') {
      return 'complete';
    }
  }
  return 'research';
}

function getCurrentStatus(events: ProgressEvent[], streamingContent: string): string {
  if (streamingContent) {
    return 'Se redactează conținutul...';
  }

  // Find the latest meaningful event
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];

    if (event.type === 'writing_progress') {
      return event.text || 'Se redactează documentul...';
    }

    if (event.type === 'phase_start') {
      return event.text || 'Se procesează...';
    }

    if (event.type === 'tool_start') {
      const query = (event.input as { query?: string })?.query;
      if (query) {
        return `Căutare: ${query.substring(0, 50)}${query.length > 50 ? '...' : ''}`;
      }
      return 'Se caută informații...';
    }

    if (event.type === 'thinking' && event.text) {
      // Extract first meaningful sentence
      const text = event.text.trim();
      const firstSentence = text.split(/[.!?]\s/)[0];
      if (firstSentence && firstSentence.length < 80) {
        return firstSentence + (firstSentence.endsWith('.') ? '' : '...');
      }
      return text.substring(0, 60) + '...';
    }
  }

  return 'Se analizează contextul...';
}

function formatEventForDisplay(
  event: ProgressEvent
): { icon: string; text: string; type: string } | null {
  switch (event.type) {
    case 'tool_start': {
      const query = (event.input as { query?: string })?.query;
      return {
        icon: '🔍',
        text: query || 'Căutare web',
        type: 'search',
      };
    }
    case 'tool_end': {
      // Parse result to show count if available
      const result = event.result || '';
      const countMatch = result.match(/(\d+)\s*(results?|rezultate?|surse?)/i);
      if (countMatch) {
        return {
          icon: '✓',
          text: `${countMatch[1]} rezultate găsite`,
          type: 'done',
        };
      }
      return {
        icon: '✓',
        text: 'Rezultate găsite',
        type: 'done',
      };
    }
    case 'phase_start':
      return {
        icon: event.phase === 'research' ? '📚' : event.phase === 'writing' ? '✍️' : '📄',
        text: event.text || `Începe ${event.phase}`,
        type: 'phase',
      };
    case 'phase_complete':
      return {
        icon: '✅',
        text: event.text || `${event.phase} completă`,
        type: 'phase-done',
      };
    case 'section_progress':
      return {
        icon: '📝',
        text: event.text || 'Se redactează secțiunea...',
        type: 'section',
      };
    case 'writing_progress':
      return {
        icon: '✍️',
        text: event.text || 'Se redactează...',
        type: 'writing',
      };
    case 'thinking':
      // Skip thinking events in the event list - they're shown in status
      return null;
    default:
      return null;
  }
}

// ============================================================================
// Component
// ============================================================================

export function GeneratingProgress({
  createType,
  progressEvents,
  streamingContent,
  animationClass = '',
}: GeneratingProgressProps) {
  // Compute current phase and status
  const currentPhase = useMemo(() => getCurrentPhase(progressEvents), [progressEvents]);
  const currentStatus = useMemo(
    () => getCurrentStatus(progressEvents, streamingContent),
    [progressEvents, streamingContent]
  );

  // Format events for display (filter and transform)
  const displayEvents = useMemo(() => {
    const formatted: Array<{ icon: string; text: string; type: string; key: number }> = [];
    for (let i = 0; i < progressEvents.length; i++) {
      const event = progressEvents[i];
      const display = formatEventForDisplay(event);
      if (display) {
        formatted.push({ ...display, key: i });
      }
    }
    // Show last 6 events
    return formatted.slice(-6);
  }, [progressEvents]);

  // Count searches completed
  const searchCount = useMemo(
    () => progressEvents.filter((e) => e.type === 'tool_end').length,
    [progressEvents]
  );

  const isResearch = createType === 'research';

  return (
    <div className={`wizard-generating ${animationClass}`.trim()}>
      {/* Phase Timeline */}
      <div className="generating-phases">
        <div className={`phase-item ${currentPhase === 'research' ? 'active' : 'done'}`}>
          <div className="phase-dot">
            {currentPhase === 'research' ? (
              <span className="loading-spinner" style={{ width: 12, height: 12 }} />
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <span className="phase-label">Cercetare</span>
        </div>
        <div className="phase-line" />
        <div
          className={`phase-item ${
            currentPhase === 'writing' ? 'active' : currentPhase === 'complete' ? 'done' : ''
          }`}
        >
          <div className="phase-dot">
            {currentPhase === 'writing' ? (
              <span className="loading-spinner" style={{ width: 12, height: 12 }} />
            ) : currentPhase === 'complete' ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : null}
          </div>
          <span className="phase-label">Redactare</span>
        </div>
      </div>

      {/* Current Status */}
      <div className="generating-status">
        <span className="loading-spinner" style={{ width: 16, height: 16 }} />
        <span className="status-text">{currentStatus}</span>
      </div>

      {/* Search Stats (if any searches done) */}
      {searchCount > 0 && (
        <div className="generating-stats">
          <span className="stat-badge">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchCount} {searchCount === 1 ? 'căutare' : 'căutări'} efectuate
          </span>
        </div>
      )}

      {/* Activity Feed */}
      {displayEvents.length > 0 && (
        <div className="generating-activity">
          <div className="activity-label">Activitate recentă</div>
          <div className="activity-feed">
            {displayEvents.map((event) => (
              <div key={event.key} className={`activity-item activity-${event.type}`}>
                <span className="activity-icon">{event.icon}</span>
                <span className="activity-text">{event.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streaming Content Preview */}
      {streamingContent && (
        <div className="generating-preview">
          <div className="preview-label">
            {isResearch ? 'Notă de cercetare' : 'Document generat'}
          </div>
          <div className="preview-content">{streamingContent}</div>
        </div>
      )}

      {/* Placeholder when no content yet */}
      {!streamingContent && displayEvents.length === 0 && (
        <div className="generating-placeholder">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>Se pregătește generarea...</span>
        </div>
      )}
    </div>
  );
}
