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
  generateEmployeeUtilization,
  generateAtRiskCases,
  generateHighValueCases,
  generateAIInsights,
  createSupervisedCasesWidget,
  createFirmCasesOverviewWidget,
  createFirmTasksOverviewWidget,
  createEmployeeWorkloadWidget,
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

// Document Editor Factories
export {
  createMockDocument,
  createMockAISuggestions,
  createMockSimilarDocuments,
  createMockTemplates,
  createMockComments,
  createMockVersions,
  createMockDocumentEditorState,
} from './document-editor.factory';

// Document Editor Types
export type {
  MockDocument,
  MockAISuggestion,
  MockSimilarDocument,
  MockTemplate,
  MockComment,
  MockVersionInfo,
  MockSemanticChange,
} from './document-editor.factory';

// Task Management Factories
export {
  createMockTask,
  createMockTasks,
  createMockTasksByType,
  createMockTasksByStatus,
  createMockWeekTasks,
  createMockTaskWithDiacritics,
} from './task-management.factory';

// Communication Hub Factories
export {
  createMockAttachment,
  createMockParticipant,
  createMockMessage,
  createMockExtractedDeadlines,
  createMockExtractedCommitments,
  createMockExtractedActionItems,
  createMockExtractedItems,
  createMockCommunicationThread,
  createMockCommunicationThreads,
  createMockAIDraftResponse,
} from './communication.factory';

// Time Tracking Factories
export {
  createMockTimeEntry,
  createMockTimeEntries,
  createMockActiveTimer,
  createMockTimeSummary,
  mockParseNaturalLanguage,
} from './time-tracking.factory';

// Reports & Analytics Factories
export {
  createMockReportMetadata,
  createMockReportData,
  createMockCasesReportData,
  createMockTimeReportData,
  createMockFinancialReportData,
  createMockTeamReportData,
  createMockClientReportData,
  createMockDocumentReportData,
  createMockCustomReport,
  createMockDrillDownData,
  createMockComparisonData,
} from './reports.factory';
