/**
 * Batch Processor Initialization
 * OPS-XXX: Batch Processing Remediation
 *
 * Centralizes processor registration to avoid circular dependencies.
 * Import and call initializeBatchProcessors() during server startup.
 */

import { batchRunner } from './batch-runner.service';
import {
  searchIndexProcessor,
  morningBriefingsProcessor,
  caseHealthProcessor,
  threadSummariesProcessor,
  caseContextProcessor,
} from './processors';

/**
 * Register all batch processors with the runner.
 * Call this during server initialization.
 */
export function initializeBatchProcessors(): void {
  batchRunner.registerProcessor(searchIndexProcessor);
  batchRunner.registerProcessor(morningBriefingsProcessor);
  batchRunner.registerProcessor(caseHealthProcessor);
  batchRunner.registerProcessor(threadSummariesProcessor);
  batchRunner.registerProcessor(caseContextProcessor);

  console.log('[BatchInit] All batch processors registered');
}
