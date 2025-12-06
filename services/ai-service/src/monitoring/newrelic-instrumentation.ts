/**
 * New Relic Custom Instrumentation
 * Story 3.8: Document System Testing and Performance - Task 19
 *
 * Provides custom instrumentation helpers for tracking AI operations
 * and business metrics in New Relic APM.
 */

 
let newrelic: typeof import('newrelic') | null = null;

// Only load New Relic if enabled
if (process.env.NODE_ENV === 'production' || process.env.NEW_RELIC_ENABLED === 'true') {
  try {
    newrelic = require('newrelic');
  } catch (e) {
    console.warn('New Relic agent not available');
  }
}

/**
 * AI Operation attributes for custom instrumentation
 */
export interface AIOperationAttributes {
  model: string;
  provider: 'claude' | 'grok';
  operation: string;
  inputTokens: number;
  outputTokens: number;
  ttftMs: number;
  totalLatencyMs: number;
  cached: boolean;
  firmId: string;
  userId?: string;
  caseId?: string;
  success: boolean;
  errorType?: string;
}

/**
 * Document operation attributes
 */
export interface DocumentOperationAttributes {
  operation: 'upload' | 'download' | 'version' | 'compare' | 'search';
  documentId?: string;
  documentType?: string;
  fileSizeBytes?: number;
  durationMs: number;
  firmId: string;
  userId?: string;
  success: boolean;
}

/**
 * Record AI operation as a custom event and add attributes to current transaction
 */
export function recordAIOperation(attributes: AIOperationAttributes): void {
  if (!newrelic) return;

  // Add attributes to current transaction
  newrelic.addCustomAttributes({
    'ai.model': attributes.model,
    'ai.provider': attributes.provider,
    'ai.operation': attributes.operation,
    'ai.tokens.input': attributes.inputTokens,
    'ai.tokens.output': attributes.outputTokens,
    'ai.latency.ttft': attributes.ttftMs,
    'ai.latency.total': attributes.totalLatencyMs,
    'ai.cached': attributes.cached,
    'ai.success': attributes.success,
    'firm.id': attributes.firmId,
  });

  if (attributes.userId) {
    newrelic.addCustomAttributes({ 'user.id': attributes.userId });
  }

  if (attributes.errorType) {
    newrelic.addCustomAttributes({ 'ai.error.type': attributes.errorType });
  }

  // Record as custom event for dashboards
  newrelic.recordCustomEvent('AIOperation', {
    model: attributes.model,
    provider: attributes.provider,
    operation: attributes.operation,
    inputTokens: attributes.inputTokens,
    outputTokens: attributes.outputTokens,
    totalTokens: attributes.inputTokens + attributes.outputTokens,
    ttftMs: attributes.ttftMs,
    totalLatencyMs: attributes.totalLatencyMs,
    tokensPerSecond: attributes.outputTokens / (attributes.totalLatencyMs / 1000),
    cached: attributes.cached,
    firmId: attributes.firmId,
    userId: attributes.userId || 'unknown',
    caseId: attributes.caseId || 'none',
    success: attributes.success,
    errorType: attributes.errorType || 'none',
    timestamp: Date.now(),
  });
}

/**
 * Record document operation as a custom event
 */
export function recordDocumentOperation(attributes: DocumentOperationAttributes): void {
  if (!newrelic) return;

  newrelic.addCustomAttributes({
    'document.operation': attributes.operation,
    'document.duration': attributes.durationMs,
    'document.success': attributes.success,
    'firm.id': attributes.firmId,
  });

  if (attributes.documentId) {
    newrelic.addCustomAttributes({ 'document.id': attributes.documentId });
  }

  if (attributes.fileSizeBytes) {
    newrelic.addCustomAttributes({ 'document.size': attributes.fileSizeBytes });
  }

  newrelic.recordCustomEvent('DocumentOperation', {
    operation: attributes.operation,
    documentId: attributes.documentId || 'unknown',
    documentType: attributes.documentType || 'unknown',
    fileSizeBytes: attributes.fileSizeBytes || 0,
    durationMs: attributes.durationMs,
    firmId: attributes.firmId,
    userId: attributes.userId || 'unknown',
    success: attributes.success,
    timestamp: Date.now(),
  });
}

/**
 * Record a custom metric
 */
export function recordMetric(name: string, value: number): void {
  if (!newrelic) return;
  newrelic.recordMetric(`Custom/${name}`, value);
}

/**
 * Record AI provider failover event
 */
export function recordFailoverEvent(
  fromProvider: string,
  toProvider: string,
  reason: string,
  latencyMs: number
): void {
  if (!newrelic) return;

  newrelic.recordCustomEvent('AIProviderFailover', {
    fromProvider,
    toProvider,
    reason,
    latencyMs,
    timestamp: Date.now(),
  });

  // Also record as metric for alerting
  newrelic.recordMetric('Custom/AI/Failover', 1);
}

/**
 * Record circuit breaker state change
 */
export function recordCircuitBreakerStateChange(
  provider: string,
  previousState: string,
  newState: string,
  failureCount: number
): void {
  if (!newrelic) return;

  newrelic.recordCustomEvent('CircuitBreakerStateChange', {
    provider,
    previousState,
    newState,
    failureCount,
    timestamp: Date.now(),
  });

  // Record metric based on state
  if (newState === 'open') {
    newrelic.recordMetric(`Custom/CircuitBreaker/${provider}/Open`, 1);
  }
}

/**
 * Record token usage for billing/monitoring
 */
export function recordTokenUsage(
  firmId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costCents: number
): void {
  if (!newrelic) return;

  newrelic.recordCustomEvent('TokenUsage', {
    firmId,
    model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costCents,
    timestamp: Date.now(),
  });

  // Record cumulative metrics
  newrelic.recordMetric('Custom/Tokens/Total', inputTokens + outputTokens);
  newrelic.recordMetric('Custom/Cost/Cents', costCents);
}

/**
 * Record cache performance
 */
export function recordCacheMetric(cacheType: string, hit: boolean, latencyMs?: number): void {
  if (!newrelic) return;

  newrelic.recordCustomEvent('CacheOperation', {
    cacheType,
    hit,
    latencyMs: latencyMs || 0,
    timestamp: Date.now(),
  });

  newrelic.recordMetric(`Custom/Cache/${cacheType}/${hit ? 'Hit' : 'Miss'}`, 1);
}

/**
 * Start a custom segment for detailed tracing
 */
export function startSegment<T>(
  name: string,
  record: boolean,
  handler: () => Promise<T>
): Promise<T> {
  if (!newrelic) return handler();

  return newrelic.startSegment(name, record, handler);
}

/**
 * Wrap an async function for tracing
 */
export function instrumentAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  name: string,
  fn: T
): T {
  if (!newrelic) return fn;

  return ((...args: Parameters<T>) =>
    newrelic!.startSegment(name, true, () => fn(...args))) as T;
}

/**
 * Add custom span attributes
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  if (!newrelic) return;

  const span = newrelic.getTransaction();
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      newrelic!.addCustomAttribute(key, value);
    });
  }
}

/**
 * Notice an error to New Relic
 */
export function noticeError(
  error: Error,
  customAttributes?: Record<string, string | number | boolean>
): void {
  if (!newrelic) return;
  newrelic.noticeError(error, customAttributes);
}

/**
 * Set the transaction name
 */
export function setTransactionName(name: string): void {
  if (!newrelic) return;
  newrelic.setTransactionName(name);
}

/**
 * Ignore the current transaction (for health checks, etc.)
 */
export function ignoreTransaction(): void {
  if (!newrelic) return;
  newrelic.setIgnoreTransaction(true);
}

/**
 * Create a New Relic background transaction
 */
export function startBackgroundTransaction<T>(
  name: string,
  group: string,
  handler: () => Promise<T>
): Promise<T> {
  if (!newrelic) return handler();

  return new Promise((resolve, reject) => {
    newrelic!.startBackgroundTransaction(name, group, async () => {
      try {
        const result = await handler();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        newrelic!.endTransaction();
      }
    });
  });
}

export default {
  recordAIOperation,
  recordDocumentOperation,
  recordMetric,
  recordFailoverEvent,
  recordCircuitBreakerStateChange,
  recordTokenUsage,
  recordCacheMetric,
  startSegment,
  instrumentAsync,
  addSpanAttributes,
  noticeError,
  setTransactionName,
  ignoreTransaction,
  startBackgroundTransaction,
};
