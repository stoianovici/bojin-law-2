/**
 * Test Data Factories
 * Central export for all factory functions
 */

// User Factories
export {
  createUser,
  createPartner,
  createAssociate,
  createParalegal,
  createUsers,
} from './user.factory';

// Case Factories
export {
  createCase,
  createActiveCase,
  createOnHoldCase,
  createClosedCase,
  createArchivedCase,
  createCases,
  createCaseTeamMember,
  createCaseTeamMembers,
} from './case.factory';

// Document Factories
export {
  createDocument,
  createContract,
  createMotion,
  createLetter,
  createMemo,
  createPleading,
  createAIDocument,
  createDocuments,
  createDocumentVersion,
  createDocumentVersions,
} from './document.factory';

// Task Factories
export {
  createTask,
  createResearchTask,
  createDocumentCreationTask,
  createDocumentRetrievalTask,
  createCourtDateTask,
  createMeetingTask,
  createBusinessTripTask,
  createTasks,
} from './task.factory';

// Dashboard Factories
export {
  createKPIMetric,
  createKPIMetrics,
  createAISuggestion,
  createAIInsight,
  createAIAlert,
  createAIRecommendation,
  createAISuggestionsForRole,
  createAISuggestions,
} from './dashboard.factory';

// Dashboard Types
export type { KPIMetric, AISuggestion, KPIMetricOverrides, AISuggestionOverrides } from './dashboard.factory';

// Workspace Factories
export {
  createDocumentNode,
  createDocumentTree,
  createAISuggestion as createWorkspaceAISuggestion,
  createAISuggestions as createWorkspaceAISuggestions,
  createRecentActivity,
  createMockCaseWorkspace,
} from './workspace.factory';
