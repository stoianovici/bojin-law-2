/**
 * Comprehension Tools Module
 *
 * Barrel export for the Case Comprehension agent tools.
 * Provides read-only tools for deeply exploring case data.
 *
 * Usage:
 * ```typescript
 * import { COMPREHENSION_TOOLS, createComprehensionToolHandlers } from './comprehension-tools';
 *
 * const handlers = createComprehensionToolHandlers(firmId);
 *
 * await aiClient.chatWithTools(
 *   messages,
 *   context,
 *   {
 *     tools: COMPREHENSION_TOOLS,
 *     toolHandlers: handlers,
 *     maxToolRounds: 10,
 *   }
 * );
 * ```
 */

// Tool schemas
export {
  READ_CASE_IDENTITY_TOOL,
  READ_CASE_ACTORS_TOOL,
  READ_CASE_DOCUMENTS_TOOL,
  READ_CASE_EMAILS_TOOL,
  READ_CASE_TIMELINE_TOOL,
  READ_CASE_CONTEXT_TOOL,
  READ_CLIENT_CONTEXT_TOOL,
  READ_CASE_ACTIVITIES_TOOL,
  COMPREHENSION_TOOLS,
} from './comprehension-tools.schema';

// Handler factory
export { createComprehensionToolHandlers } from './comprehension-tools.handlers';

// Individual handlers (for testing)
export {
  handleReadCaseIdentity,
  handleReadCaseActors,
  handleReadCaseDocuments,
  handleReadCaseEmails,
  handleReadCaseTimeline,
  handleReadCaseContext,
  handleReadClientContext,
  handleReadCaseActivities,
} from './comprehension-tools.handlers';
