/**
 * GeneratingProgress Component
 * Shows a stream of thoughts during document/research generation.
 *
 * Displays progress with visual hierarchy inspired by Claude Code:
 * - Thinking: Gray italic text (accumulated into coherent blocks)
 * - Tool calls: Blue monospace with actual query
 * - Results: Green success text
 * - Phases: Subtle separators
 *
 * Key feature: Accumulates consecutive thinking chunks into single blocks
 * to avoid mid-word breaks from streaming.
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

/** Typed thought item for visual hierarchy */
interface ThoughtItem {
  text: string;
  type: 'thinking' | 'tool' | 'result' | 'phase';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clean thinking text by removing JSON blocks and other noise.
 * Returns null if the text shouldn't be shown.
 */
function cleanThinkingText(text: string): string | null {
  if (!text) return null;

  let cleaned = text.trim();

  // Remove JSON code blocks
  cleaned = cleaned.replace(/```json[\s\S]*?```/g, '').trim();
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '').trim();

  // Skip if it's pure JSON
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) return null;

  // Skip keepalive/progress messages (these are repetitive and not useful)
  // Use broad matching to catch all variations
  if (cleaned.toLowerCase().includes('redactează document')) return null;
  if (cleaned.toLowerCase().includes('se scrie')) return null;
  if (cleaned.toLowerCase().includes('se redactează')) return null;
  if (cleaned.toLowerCase().includes('analiză') && cleaned.toLowerCase().includes('desfășurare'))
    return null;

  // Skip very short or empty after cleaning
  if (cleaned.length < 3) return null;

  return cleaned;
}

/**
 * Process progress events into displayable items.
 * Key feature: Accumulates consecutive thinking events into single blocks
 * to produce coherent text without mid-word breaks.
 */
function processEvents(events: ProgressEvent[]): ThoughtItem[] {
  const items: ThoughtItem[] = [];
  let thinkingBuffer = '';

  const flushThinking = () => {
    if (thinkingBuffer.trim()) {
      items.push({ text: thinkingBuffer.trim(), type: 'thinking' });
      thinkingBuffer = '';
    }
  };

  for (const event of events) {
    switch (event.type) {
      case 'thinking': {
        // Accumulate thinking into buffer (handles chunked streaming)
        const cleaned = cleanThinkingText(event.text || '');
        if (cleaned) {
          // Add space between chunks if buffer doesn't end with space
          // and cleaned doesn't start with punctuation
          if (thinkingBuffer && !thinkingBuffer.endsWith(' ') && !/^[.,;:!?)]/.test(cleaned)) {
            thinkingBuffer += ' ';
          }
          thinkingBuffer += cleaned;
        }
        break;
      }

      case 'search': {
        // Backend sends 'search' events for tool calls
        // Contains query in text like "Căutare: query..." or "Rezultate găsite..."
        const text = event.text || '';
        if (text.startsWith('Căutare:')) {
          // This is a search start - show the query
          flushThinking();
          const query = text.replace('Căutare:', '').trim();
          const newText = `🔍 ${query}`;
          // Deduplicate consecutive identical tool calls
          const lastItem = items[items.length - 1];
          if (!lastItem || lastItem.type !== 'tool' || lastItem.text !== newText) {
            items.push({ text: newText, type: 'tool' });
          }
        } else if (text.includes('Rezultate') || text.includes('căutări')) {
          // This is a search result - deduplicate consecutive identical
          const newText = `✓ ${text}`;
          const lastItem = items[items.length - 1];
          if (!lastItem || lastItem.type !== 'result' || lastItem.text !== newText) {
            items.push({ text: newText, type: 'result' });
          }
        }
        break;
      }

      case 'writing': {
        // Writing phase - show as phase marker (deduplicate consecutive identical)
        flushThinking();
        if (event.text) {
          const lastItem = items[items.length - 1];
          // Only add if different from last phase
          if (!lastItem || lastItem.type !== 'phase' || lastItem.text !== event.text) {
            items.push({ text: event.text, type: 'phase' });
          }
        }
        break;
      }

      case 'tool_start': {
        // Legacy: direct tool_start events
        flushThinking();
        const query = (event.input as { query?: string })?.query;
        items.push({
          text: query ? `🔍 ${query}` : '🔍 Căutare...',
          type: 'tool',
        });
        break;
      }

      case 'tool_end': {
        // Legacy: direct tool_end events - deduplicate
        const result = event.result || '';
        const countMatch = result.match(/(\d+)\s*(results?|rezultate?|surse?)/i);
        const newText = countMatch ? `✓ ${countMatch[1]} rezultate` : '✓ Rezultate găsite';
        const lastItem = items[items.length - 1];
        if (!lastItem || lastItem.type !== 'result' || lastItem.text !== newText) {
          items.push({ text: newText, type: 'result' });
        }
        break;
      }

      case 'phase_start': {
        // Phase start - deduplicate consecutive identical
        flushThinking();
        if (event.text) {
          const lastItem = items[items.length - 1];
          if (!lastItem || lastItem.type !== 'phase' || lastItem.text !== event.text) {
            items.push({ text: event.text, type: 'phase' });
          }
        }
        break;
      }

      case 'phase_complete': {
        flushThinking();
        if (event.text) {
          items.push({ text: `✓ ${event.text}`, type: 'result' });
        }
        break;
      }

      case 'writing_progress':
      case 'section_progress': {
        // These are progress updates during writing - show as thinking
        const cleaned = cleanThinkingText(event.text || '');
        if (cleaned) {
          if (thinkingBuffer && !thinkingBuffer.endsWith(' ') && !/^[.,;:!?)]/.test(cleaned)) {
            thinkingBuffer += ' ';
          }
          thinkingBuffer += cleaned;
        }
        break;
      }
    }
  }

  // Flush any remaining thinking
  flushThinking();

  return items;
}

/**
 * Get CSS class for thought item based on its type.
 */
function getThoughtClass(type: ThoughtItem['type']): string {
  switch (type) {
    case 'thinking':
      return 'thought-item thought-thinking';
    case 'tool':
      return 'thought-item thought-tool';
    case 'result':
      return 'thought-item thought-result';
    case 'phase':
      return 'thought-item thought-phase';
    default:
      return 'thought-item';
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

  // Process events with thinking accumulation
  const thoughtStream = useMemo(() => processEvents(progressEvents), [progressEvents]);

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

      {/* Thought stream with visual hierarchy */}
      <div className="thought-stream" ref={streamRef}>
        {thoughtStream.map((item, index) => (
          <div key={index} className={getThoughtClass(item.type)}>
            {item.text}
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
