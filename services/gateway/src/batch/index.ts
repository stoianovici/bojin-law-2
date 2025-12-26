/**
 * Batch Processing Module
 * OPS-236: Batch Job Runner Framework
 *
 * Exports the batch processor interface and runner service.
 *
 * Usage:
 * ```typescript
 * import {
 *   BatchProcessor,
 *   BatchProcessorResult,
 *   BatchProcessorContext,
 *   batchRunner
 * } from './batch';
 *
 * // Register processors at startup
 * batchRunner.registerProcessor(new SearchIndexProcessor());
 * batchRunner.registerProcessor(new MorningBriefingsProcessor());
 *
 * // Start scheduler (reads cron from feature config)
 * await batchRunner.startScheduler();
 *
 * // Or run manually
 * const result = await batchRunner.runProcessor(firmId, 'search_index');
 * ```
 */

// Types and interfaces
export type {
  BatchProcessor,
  BatchProcessorResult,
  BatchProcessorContext,
  BatchProgressCallback,
} from './batch-processor.interface';

// Runner service
export { BatchRunnerService, batchRunner } from './batch-runner.service';
export type { BatchRunResult, SchedulerOptions } from './batch-runner.service';

// Processors
export {
  SearchIndexProcessor,
  searchIndexProcessor,
  MorningBriefingsProcessor,
  morningBriefingsProcessor,
  CaseHealthProcessor,
  caseHealthProcessor,
  ThreadSummariesProcessor,
  threadSummariesProcessor,
} from './processors';
