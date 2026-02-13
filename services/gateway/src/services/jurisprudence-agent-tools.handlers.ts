/**
 * Jurisprudence Agent Tool Handlers
 *
 * Main entry point for the jurisprudence research agent tools.
 * This module re-exports from specialized modules for cleaner organization.
 *
 * Architecture:
 * - jurisprudence-url-tracker.ts: Redis-backed URL tracking for provenance
 * - jurisprudence-circuit-breaker.ts: Circuit breaker for search resilience
 * - jurisprudence-rate-limit.ts: Per-user rate limiting
 * - jurisprudence-search-handler.ts: search_jurisprudence tool implementation
 * - jurisprudence-submit-handler.ts: submit_jurisprudence_notes tool implementation
 */

import { ToolHandler } from './ai-client.service';
import {
  JurisprudenceAgentContext,
  JurisprudenceResearchOutput,
  JurisprudenceProgressEvent,
} from './jurisprudence-agent.types';
import { RedisUrlTracker, TrackedUrl } from './jurisprudence-url-tracker';
import { createSearchJurisprudenceHandler } from './jurisprudence-search-handler';
import { createJurisprudenceSubmitHandler } from './jurisprudence-submit-handler';

// ============================================================================
// Re-exports
// ============================================================================

// Rate limiting
export { checkJurisprudenceRateLimit } from './jurisprudence-rate-limit';

// Circuit breaker (for testing)
export {
  isCircuitBreakerClosed,
  getCircuitOpenedAt,
  recordCircuitSuccess,
  recordCircuitFailure,
  CIRCUIT_BREAKER_CONFIG,
} from './jurisprudence-circuit-breaker';

// URL tracker (for testing)
export { RedisUrlTracker, TrackedUrl } from './jurisprudence-url-tracker';

// ============================================================================
// Types
// ============================================================================

export type JurisprudenceToolHandlers = {
  search_jurisprudence: ToolHandler;
  submit_jurisprudence_notes: ToolHandler;
};

// ============================================================================
// Main Factory
// ============================================================================

/**
 * Create all tool handlers for the jurisprudence agent.
 * Returns handlers and functions to get captured output and stats.
 *
 * URL tracking is Redis-backed to support multi-instance deployments.
 * Each research session (correlationId) has its own URL tracking namespace
 * with automatic TTL-based cleanup.
 */
export function createJurisprudenceToolHandlers(
  ctx: JurisprudenceAgentContext,
  onProgress?: (event: JurisprudenceProgressEvent) => void
): {
  handlers: JurisprudenceToolHandlers;
  getOutput: () => JurisprudenceResearchOutput | null;
  getSearchCount: () => number;
  getTrackedUrls: () => Map<string, TrackedUrl>;
} {
  let searchCount = 0;
  // Use Redis-backed URL tracker for multi-instance support
  const trackedUrls = new RedisUrlTracker(ctx.correlationId);

  const trackSearch = () => {
    searchCount++;
  };

  const submitHandler = createJurisprudenceSubmitHandler(trackedUrls, ctx.correlationId);

  return {
    handlers: {
      search_jurisprudence: createSearchJurisprudenceHandler(
        ctx,
        trackSearch,
        trackedUrls,
        onProgress
      ),
      submit_jurisprudence_notes: submitHandler.handler,
    },
    getOutput: submitHandler.getOutput,
    getSearchCount: () => searchCount,
    // Return local cache for compatibility (Redis has full set)
    getTrackedUrls: () => trackedUrls.asMap(),
  };
}
