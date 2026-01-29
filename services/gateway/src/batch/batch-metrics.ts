/**
 * Batch Processing Metrics
 * OPS-XXX: Batch Processing Remediation
 *
 * Simple metrics tracking for batch processing observability.
 * Uses in-memory counters that can be exposed via /metrics endpoint.
 *
 * Note: For production Prometheus integration, install prom-client
 * and update this file to use proper Prometheus metrics.
 */

// ============================================================================
// Simple Counter/Gauge Implementation
// ============================================================================

interface MetricValue {
  value: number;
  labels: Record<string, string>;
}

class SimpleCounter {
  private values: Map<string, number> = new Map();

  constructor(
    public readonly name: string,
    public readonly help: string
  ) {}

  inc(labels: Record<string, string>, value = 1): void {
    const key = JSON.stringify(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  getAll(): MetricValue[] {
    return Array.from(this.values.entries()).map(([key, value]) => ({
      value,
      labels: JSON.parse(key),
    }));
  }
}

class SimpleGauge {
  private values: Map<string, number> = new Map();

  constructor(
    public readonly name: string,
    public readonly help: string
  ) {}

  inc(labels: Record<string, string>, value = 1): void {
    const key = JSON.stringify(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  dec(labels: Record<string, string>, value = 1): void {
    const key = JSON.stringify(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current - value);
  }

  set(labels: Record<string, string>, value: number): void {
    const key = JSON.stringify(labels);
    this.values.set(key, value);
  }

  getAll(): MetricValue[] {
    return Array.from(this.values.entries()).map(([key, value]) => ({
      value,
      labels: JSON.parse(key),
    }));
  }
}

class SimpleHistogram {
  private buckets: number[];
  private counts: Map<string, number[]> = new Map();
  private sums: Map<string, number> = new Map();
  private totalCounts: Map<string, number> = new Map();

  constructor(
    public readonly name: string,
    public readonly help: string,
    buckets: number[]
  ) {
    this.buckets = buckets.sort((a, b) => a - b);
  }

  observe(labels: Record<string, string>, value: number): void {
    const key = JSON.stringify(labels);

    // Initialize if needed
    if (!this.counts.has(key)) {
      this.counts.set(key, new Array(this.buckets.length).fill(0));
      this.sums.set(key, 0);
      this.totalCounts.set(key, 0);
    }

    // Update counts
    const counts = this.counts.get(key)!;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        counts[i]++;
      }
    }

    this.sums.set(key, (this.sums.get(key) || 0) + value);
    this.totalCounts.set(key, (this.totalCounts.get(key) || 0) + 1);
  }
}

// ============================================================================
// Metrics Definitions
// ============================================================================

/**
 * Counter for total batch jobs processed.
 */
export const batchJobsTotal = new SimpleCounter('batch_jobs_total', 'Total batch jobs processed');

/**
 * Histogram for batch job duration.
 * Buckets include Infinity to properly capture timeouts (max 4h = 14400s).
 */
export const batchJobDurationSeconds = new SimpleHistogram(
  'batch_job_duration_seconds',
  'Batch job processing duration in seconds',
  [60, 300, 600, 1800, 3600, 7200, 14400, 21600, Infinity]
  //                                        ^ 6h   ^ catches timeouts beyond max
);

/**
 * Counter for total items processed by batch jobs.
 */
export const batchItemsProcessed = new SimpleCounter(
  'batch_items_processed_total',
  'Total items processed by batch jobs'
);

/**
 * Counter for total cost in EUR for batch processing.
 */
export const batchCostEur = new SimpleCounter(
  'batch_cost_eur_total',
  'Total cost in EUR for batch processing'
);

/**
 * Counter for total tokens used in batch processing.
 */
export const batchTokensTotal = new SimpleCounter(
  'batch_tokens_total',
  'Total tokens used in batch processing'
);

/**
 * Gauge for currently active batch jobs.
 */
export const batchActiveJobs = new SimpleGauge('batch_active_jobs', 'Currently active batch jobs');

/**
 * Histogram for batch result processing latency.
 */
export const batchResultProcessingSeconds = new SimpleHistogram(
  'batch_result_processing_seconds',
  'Time to process individual batch results in seconds',
  [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
);

// ============================================================================
// Metric Collection Helpers
// ============================================================================

/**
 * Record batch job completion metrics.
 */
export function recordBatchJobCompletion(params: {
  feature: string;
  mode: 'sync' | 'async_batch';
  status: 'completed' | 'partial' | 'failed' | 'skipped';
  durationSeconds: number;
  itemsSucceeded: number;
  itemsFailed: number;
  costEur: number;
  inputTokens: number;
  outputTokens: number;
}): void {
  const {
    feature,
    mode,
    status,
    durationSeconds,
    itemsSucceeded,
    itemsFailed,
    costEur,
    inputTokens,
    outputTokens,
  } = params;

  // Record job count
  batchJobsTotal.inc({ feature, status, mode });

  // Record duration
  batchJobDurationSeconds.observe({ feature, mode }, durationSeconds);

  // Record item counts
  if (itemsSucceeded > 0) {
    batchItemsProcessed.inc({ feature, status: 'succeeded' }, itemsSucceeded);
  }
  if (itemsFailed > 0) {
    batchItemsProcessed.inc({ feature, status: 'failed' }, itemsFailed);
  }

  // Record cost
  if (costEur > 0) {
    batchCostEur.inc({ feature }, costEur);
  }

  // Record tokens
  if (inputTokens > 0) {
    batchTokensTotal.inc({ feature, type: 'input' }, inputTokens);
  }
  if (outputTokens > 0) {
    batchTokensTotal.inc({ feature, type: 'output' }, outputTokens);
  }
}

/**
 * Record batch job start for active jobs tracking.
 */
export function recordBatchJobStart(feature: string): void {
  batchActiveJobs.inc({ feature });
}

/**
 * Record batch job end for active jobs tracking.
 */
export function recordBatchJobEnd(feature: string): void {
  batchActiveJobs.dec({ feature });
}

/**
 * Record result processing time for an individual item.
 */
export function recordResultProcessing(
  feature: string,
  entityType: string,
  durationSeconds: number
): void {
  batchResultProcessingSeconds.observe({ feature, entity_type: entityType }, durationSeconds);
}

// ============================================================================
// Prometheus Text Export
// ============================================================================

/**
 * Format labels as Prometheus label string.
 */
function formatLabels(labels: Record<string, string>): string {
  const parts = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
  return parts.length > 0 ? `{${parts.join(',')}}` : '';
}

/**
 * Export all metrics in Prometheus text format.
 * Can be served at /metrics endpoint for scraping.
 */
export function getMetricsText(): string {
  const lines: string[] = [];

  // Jobs total counter
  lines.push(`# HELP ${batchJobsTotal.name} ${batchJobsTotal.help}`);
  lines.push(`# TYPE ${batchJobsTotal.name} counter`);
  for (const { value, labels } of batchJobsTotal.getAll()) {
    lines.push(`${batchJobsTotal.name}${formatLabels(labels)} ${value}`);
  }
  lines.push('');

  // Items processed counter
  lines.push(`# HELP ${batchItemsProcessed.name} ${batchItemsProcessed.help}`);
  lines.push(`# TYPE ${batchItemsProcessed.name} counter`);
  for (const { value, labels } of batchItemsProcessed.getAll()) {
    lines.push(`${batchItemsProcessed.name}${formatLabels(labels)} ${value}`);
  }
  lines.push('');

  // Cost counter
  lines.push(`# HELP ${batchCostEur.name} ${batchCostEur.help}`);
  lines.push(`# TYPE ${batchCostEur.name} counter`);
  for (const { value, labels } of batchCostEur.getAll()) {
    lines.push(`${batchCostEur.name}${formatLabels(labels)} ${value}`);
  }
  lines.push('');

  // Tokens counter
  lines.push(`# HELP ${batchTokensTotal.name} ${batchTokensTotal.help}`);
  lines.push(`# TYPE ${batchTokensTotal.name} counter`);
  for (const { value, labels } of batchTokensTotal.getAll()) {
    lines.push(`${batchTokensTotal.name}${formatLabels(labels)} ${value}`);
  }
  lines.push('');

  // Active jobs gauge
  lines.push(`# HELP ${batchActiveJobs.name} ${batchActiveJobs.help}`);
  lines.push(`# TYPE ${batchActiveJobs.name} gauge`);
  for (const { value, labels } of batchActiveJobs.getAll()) {
    lines.push(`${batchActiveJobs.name}${formatLabels(labels)} ${value}`);
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Aggregated Metrics Object
// ============================================================================

/**
 * All batch metrics in a single object for easy access.
 */
export const batchMetrics = {
  jobsTotal: batchJobsTotal,
  jobDurationSeconds: batchJobDurationSeconds,
  itemsProcessed: batchItemsProcessed,
  costEur: batchCostEur,
  tokensTotal: batchTokensTotal,
  activeJobs: batchActiveJobs,
  resultProcessingSeconds: batchResultProcessingSeconds,

  // Helper functions
  recordJobCompletion: recordBatchJobCompletion,
  recordJobStart: recordBatchJobStart,
  recordJobEnd: recordBatchJobEnd,
  recordResultProcessing,

  // Export function
  getMetricsText,
};
