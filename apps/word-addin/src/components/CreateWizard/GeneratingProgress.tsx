/**
 * GeneratingProgress Component
 * Shows a stream of thoughts during document/research generation.
 *
 * Displays a single scrollable area with all progress text as it arrives
 * from the API stream.
 */

import { useMemo, useRef, useEffect } from 'react';

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
  progressEvents: ProgressEvent[];
  streamingContent: string;
  animationClass?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract displayable text from a progress event.
 * Returns null if the event shouldn't be shown.
 */
function getEventText(event: ProgressEvent): string | null {
  switch (event.type) {
    case 'thinking': {
      if (!event.text) return null;
      let text = event.text.trim();
      // Remove JSON code blocks
      text = text.replace(/```json[\s\S]*?```/g, '').trim();
      text = text.replace(/```[\s\S]*?```/g, '').trim();
      // Skip if it's pure JSON
      if (text.startsWith('{') || text.startsWith('[')) return null;
      // Skip very short or empty after cleaning
      if (text.length < 5) return null;
      // Truncate very long thoughts to keep UI clean
      if (text.length > 300) {
        text = text.substring(0, 297) + '...';
      }
      return text;
    }
    case 'tool_start': {
      const query = (event.input as { query?: string })?.query;
      if (query) {
        return `🔍 Căutare: ${query}`;
      }
      return '🔍 Se caută informații...';
    }
    case 'tool_end': {
      const result = event.result || '';
      const countMatch = result.match(/(\d+)\s*(results?|rezultate?|surse?)/i);
      if (countMatch) {
        return `✓ ${countMatch[1]} rezultate găsite`;
      }
      return '✓ Rezultate găsite';
    }
    case 'phase_start':
      return event.text || null;
    case 'phase_complete':
      return event.text || null;
    case 'writing_progress':
      return event.text || null;
    case 'section_progress':
      return event.text || null;
    default:
      return null;
  }
}

// ============================================================================
// Component
// ============================================================================

export function GeneratingProgress({
  progressEvents,
  streamingContent,
  animationClass = '',
}: GeneratingProgressProps) {
  const streamRef = useRef<HTMLDivElement>(null);

  // Build the stream of thoughts from progress events
  const thoughtStream = useMemo(() => {
    const thoughts: string[] = [];
    for (const event of progressEvents) {
      const text = getEventText(event);
      if (text) {
        thoughts.push(text);
      }
    }
    return thoughts;
  }, [progressEvents]);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [thoughtStream, streamingContent]);

  const hasContent = thoughtStream.length > 0 || streamingContent;

  return (
    <div className={`wizard-generating ${animationClass}`.trim()}>
      {/* Loading indicator */}
      <div className="generating-header">
        <span className="loading-spinner" style={{ width: 16, height: 16 }} />
        <span className="generating-title">Se generează...</span>
      </div>

      {/* Thought stream */}
      <div className="thought-stream" ref={streamRef}>
        {thoughtStream.map((thought, index) => (
          <div key={index} className="thought-item">
            {thought}
          </div>
        ))}
        {streamingContent && <div className="thought-item thought-content">{streamingContent}</div>}
        {!hasContent && (
          <div className="thought-item thought-placeholder">Se analizează contextul...</div>
        )}
      </div>
    </div>
  );
}
