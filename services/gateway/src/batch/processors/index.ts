/**
 * Batch Processors Index
 * OPS-236: Batch Job Runner Framework
 *
 * Exports all batch processors for registration with the BatchRunner.
 */

// Search Index Processor (OPS-237)
export { SearchIndexProcessor, searchIndexProcessor } from './search-index.processor';

// Morning Briefings Processor (OPS-238)
export {
  MorningBriefingsProcessor,
  morningBriefingsProcessor,
} from './morning-briefings.processor';

// Case Health Processor (OPS-239)
export { CaseHealthProcessor, caseHealthProcessor } from './case-health.processor';

// Thread Summaries Processor (OPS-240)
export { ThreadSummariesProcessor, threadSummariesProcessor } from './thread-summaries.processor';

// Case Context Processor (OPS-261)
export { CaseContextProcessor, caseContextProcessor } from './case-context.processor';

// Firm Briefings Processor (OPS-265)
export { FirmBriefingsProcessor, firmBriefingsProcessor } from './firm-briefings.processor';
