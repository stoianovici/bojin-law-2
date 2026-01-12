/**
 * Manual mock for @legal-platform/database
 * Used in Jest tests to mock database and Redis functionality
 */

// ============================================================================
// Prisma Enums (matching schema.prisma)
// ============================================================================

export const TaskStatus = {
  Pending: 'Pending',
  InProgress: 'InProgress',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
} as const;

export const TaskPriority = {
  Low: 'Low',
  Medium: 'Medium',
  High: 'High',
  Urgent: 'Urgent',
} as const;

export const DependencyType = {
  FinishToStart: 'FinishToStart',
  StartToStart: 'StartToStart',
  FinishToFinish: 'FinishToFinish',
  StartToFinish: 'StartToFinish',
} as const;

export const CaseStatus = {
  Active: 'Active',
  OnHold: 'OnHold',
  Closed: 'Closed',
  Archived: 'Archived',
  PendingApproval: 'PendingApproval',
} as const;

export const CaseType = {
  Litigation: 'Litigation',
  Contract: 'Contract',
  Advisory: 'Advisory',
  Criminal: 'Criminal',
  Other: 'Other',
} as const;

export const NotificationType = {
  CasePendingApproval: 'CasePendingApproval',
  CaseApproved: 'CaseApproved',
  CaseRejected: 'CaseRejected',
  DocumentReviewRequested: 'DocumentReviewRequested',
  DocumentReviewAssigned: 'DocumentReviewAssigned',
  DocumentApproved: 'DocumentApproved',
  DocumentRejected: 'DocumentRejected',
  DocumentRevisionRequested: 'DocumentRevisionRequested',
  DocumentCommentAdded: 'DocumentCommentAdded',
  DocumentCommentMentioned: 'DocumentCommentMentioned',
  DelegationRequested: 'DelegationRequested',
  DelegationAccepted: 'DelegationAccepted',
  DelegationDeclined: 'DelegationDeclined',
  TaskDeadlineReminder: 'TaskDeadlineReminder',
  TaskOverdue: 'TaskOverdue',
  DependencyBlocked: 'DependencyBlocked',
  DependencyUnblocked: 'DependencyUnblocked',
  TaskCommentAdded: 'TaskCommentAdded',
  TaskCommentMentioned: 'TaskCommentMentioned',
  TaskCommentReplied: 'TaskCommentReplied',
  TaskStatusUpdated: 'TaskStatusUpdated',
  SubtaskCreated: 'SubtaskCreated',
  TaskAttachmentAdded: 'TaskAttachmentAdded',
  MorningBriefingReady: 'MorningBriefingReady',
  AISuggestionCreated: 'AISuggestionCreated',
  BulkCommunicationCompleted: 'BulkCommunicationCompleted',
  CommunicationExportReady: 'CommunicationExportReady',
  EmailMadePublic: 'EmailMadePublic',
} as const;

export const DocumentStatus = {
  DRAFT: 'DRAFT',
  FINAL: 'FINAL',
  ARCHIVED: 'ARCHIVED',
  IN_REVIEW: 'IN_REVIEW',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  PENDING: 'PENDING',
} as const;

export const UserRole = {
  Partner: 'Partner',
  Associate: 'Associate',
  AssociateJr: 'AssociateJr',
  Paralegal: 'Paralegal',
  BusinessOwner: 'BusinessOwner',
} as const;

export const AvailabilityType = {
  OutOfOffice: 'OutOfOffice',
  ReducedHours: 'ReducedHours',
  Vacation: 'Vacation',
} as const;

// ============================================================================
// Mock Types
// ============================================================================

// Type helper for mocked model - makes TypeScript recognize mock methods
type MockedModel = {
  findUnique: jest.Mock;
  findUniqueOrThrow: jest.Mock;
  findFirst: jest.Mock;
  findFirstOrThrow: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  groupBy: jest.Mock;
};

export const sessionManager = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
} as any;

export const cacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  stats: jest.fn(),
};

export const redis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  ping: jest.fn(),
  keys: jest.fn(),
  mget: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hgetall: jest.fn(),
  sadd: jest.fn(),
  smembers: jest.fn(),
  srem: jest.fn(),
};

// Helper to create a model mock with all common Prisma methods
const createModelMock = (): MockedModel => ({
  findUnique: jest.fn(),
  findUniqueOrThrow: jest.fn(),
  findFirst: jest.fn(),
  findFirstOrThrow: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  groupBy: jest.fn(),
});

export const prisma = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn((fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn))),
  $queryRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
  $executeRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  // User & Auth
  user: createModelMock(),
  userPreferences: createModelMock(),
  userAvailability: createModelMock(),
  userSkill: createModelMock(),
  userWorkloadSettings: createModelMock(),
  userActivityEvent: createModelMock(),
  userActionPattern: createModelMock(),
  userDailyContext: createModelMock(),
  userAudit: createModelMock(),
  userAuditLog: createModelMock(),
  // Firm
  firm: createModelMock(),
  firmAuditLog: createModelMock(),
  // Case
  case: createModelMock(),
  caseTeam: createModelMock(),
  caseAuditLog: createModelMock(),
  caseActor: createModelMock(),
  caseApproval: createModelMock(),
  caseRateHistory: createModelMock(),
  caseChapter: createModelMock(),
  caseChapterEvent: createModelMock(),
  caseSummary: createModelMock(),
  caseDocument: createModelMock(),
  caseNote: createModelMock(),
  caseActivityEntry: createModelMock(),
  caseSubscription: createModelMock(),
  caseTypeConfig: createModelMock(),
  caseBriefing: createModelMock(),
  caseHealthScore: createModelMock(),
  // Client
  client: createModelMock(),
  actorTypeConfig: createModelMock(),
  // Email
  email: createModelMock(),
  emailThread: createModelMock(),
  emailAttachment: createModelMock(),
  emailDraft: createModelMock(),
  emailCaseLink: createModelMock(),
  emailSyncState: createModelMock(),
  emailClassificationLog: createModelMock(),
  sentEmailDraft: createModelMock(),
  pendingClassification: createModelMock(),
  historicalEmailSyncJob: createModelMock(),
  globalEmailSource: createModelMock(),
  threadSummary: createModelMock(),
  // Document
  document: createModelMock(),
  documentFolder: createModelMock(),
  documentAuditLog: createModelMock(),
  documentVersion: createModelMock(),
  documentComment: createModelMock(),
  documentReview: createModelMock(),
  documentLock: createModelMock(),
  documentPattern: createModelMock(),
  documentEditSession: createModelMock(),
  documentDraftMetrics: createModelMock(),
  documentCompletenessCheck: createModelMock(),
  documentStructurePreference: createModelMock(),
  // Task
  task: createModelMock(),
  taskComment: createModelMock(),
  taskDependency: createModelMock(),
  taskTemplate: createModelMock(),
  taskTemplateStep: createModelMock(),
  taskTemplateUsage: createModelMock(),
  taskDelegation: createModelMock(),
  taskHistory: createModelMock(),
  taskAttachment: createModelMock(),
  taskAttendee: createModelMock(),
  taskDocumentLink: createModelMock(),
  taskAnalyticsSnapshot: createModelMock(),
  taskParseHistory: createModelMock(),
  taskParsePattern: createModelMock(),
  taskPatternAnalysis: createModelMock(),
  taskCreationPattern: createModelMock(),
  // AI
  aiConversation: createModelMock(),
  aiConversationMessage: createModelMock(),
  aITokenUsage: createModelMock(),
  aIUsageLog: createModelMock(),
  aIMessage: createModelMock(),
  aIBatchJobRun: createModelMock(),
  aIBudgetSettings: createModelMock(),
  aIFeatureConfig: createModelMock(),
  aIModelConfig: createModelMock(),
  aIReviewConcern: createModelMock(),
  aISuggestion: createModelMock(),
  // Search
  searchQuery: createModelMock(),
  searchResult: createModelMock(),
  searchHistory: createModelMock(),
  // Suggestions & Extracted
  attachmentSuggestion: createModelMock(),
  responseSuggestion: createModelMock(),
  suggestionFeedback: createModelMock(),
  extractedActionItem: createModelMock(),
  extractedCommitment: createModelMock(),
  extractedDeadline: createModelMock(),
  extractedQuestion: createModelMock(),
  // Mapa
  mapa: createModelMock(),
  mapaDocument: createModelMock(),
  mapaSlot: createModelMock(),
  mapaTemplate: createModelMock(),
  // Communication
  communicationIntelligence: createModelMock(),
  communicationTemplate: createModelMock(),
  communicationEntry: createModelMock(),
  communicationAttachment: createModelMock(),
  communicationExport: createModelMock(),
  bulkCommunication: createModelMock(),
  bulkCommunicationLog: createModelMock(),
  // Financial
  retainer: createModelMock(),
  retainerTimeEntry: createModelMock(),
  retainerPeriodUsage: createModelMock(),
  timeEntry: createModelMock(),
  financialReport: createModelMock(),
  invoice: createModelMock(),
  invoiceItem: createModelMock(),
  payment: createModelMock(),
  subscription: createModelMock(),
  billingCycle: createModelMock(),
  // Calendar & Events
  calendarEvent: createModelMock(),
  calendarEventResponse: createModelMock(),
  onlineEvent: createModelMock(),
  // Notification
  notification: createModelMock(),
  inAppNotification: createModelMock(),
  pushSubscription: createModelMock(),
  digestQueue: createModelMock(),
  // Graph & Webhooks
  graphSubscription: createModelMock(),
  // Reviews
  reviewComment: createModelMock(),
  reviewCommentReply: createModelMock(),
  reviewHistory: createModelMock(),
  batchReview: createModelMock(),
  // Personal
  personalSnippet: createModelMock(),
  personalThread: createModelMock(),
  personalContact: createModelMock(),
  writingStyleProfile: createModelMock(),
  // Briefing & Context
  morningBriefing: createModelMock(),
  contextProfile: createModelMock(),
  // Templates
  templateLibrary: createModelMock(),
  templateStepDependency: createModelMock(),
  wordContentTemplate: createModelMock(),
  wordTemplateUsage: createModelMock(),
  // Analytics & Metrics
  performanceMetric: createModelMock(),
  riskIndicator: createModelMock(),
  automationROIMetrics: createModelMock(),
  delegationAnalytics: createModelMock(),
  delegationHandoff: createModelMock(),
  responseTimePattern: createModelMock(),
  // Versioning
  semanticChange: createModelMock(),
  versionComparisonCache: createModelMock(),
  draftRefinement: createModelMock(),
  draftEditHistory: createModelMock(),
  // Chat
  teamChatMessage: createModelMock(),
};

export const checkDatabaseHealth = jest.fn();
export const checkRedisHealth = jest.fn();

export const databaseConfig = {
  url: 'mock-database-url',
  maxConnections: 10,
};

export const getRedisConfig = jest.fn(() => ({
  host: 'localhost',
  port: 6379,
}));
