/**
 * Task Analytics Test Fixtures
 * Story 4.7: Task Analytics and Optimization
 *
 * Provides test data for:
 * - Completion time analytics (AC: 1)
 * - Overdue analysis (AC: 2)
 * - Velocity trends (AC: 3)
 * - Pattern detection (AC: 4)
 * - Delegation analytics (AC: 5)
 * - ROI calculations (AC: 6)
 */

import { TaskStatus, TaskTypeEnum, TaskPriority, DelegationStatus, CaseType } from '@prisma/client';

// Test identifiers
export const TEST_FIRM_ID = 'firm-test-001';
export const TEST_USER_IDS = {
  partner: 'user-partner-001',
  associate: 'user-associate-002',
  paralegal: 'user-paralegal-003',
  junior: 'user-junior-004',
};
export const TEST_CASE_IDS = {
  case1: 'case-test-001',
  case2: 'case-test-002',
  case3: 'case-test-003',
};

// Date helpers
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

// ============================================================================
// User Fixtures
// ============================================================================

export const mockUsers = [
  {
    id: TEST_USER_IDS.partner,
    firstName: 'John',
    lastName: 'Partner',
    role: 'Partner',
    email: 'john.partner@test.com',
  },
  {
    id: TEST_USER_IDS.associate,
    firstName: 'Jane',
    lastName: 'Associate',
    role: 'Associate',
    email: 'jane.associate@test.com',
  },
  {
    id: TEST_USER_IDS.paralegal,
    firstName: 'Bob',
    lastName: 'Paralegal',
    role: 'Paralegal',
    email: 'bob.paralegal@test.com',
  },
  {
    id: TEST_USER_IDS.junior,
    firstName: 'Alice',
    lastName: 'Junior',
    role: 'JuniorAssociate',
    email: 'alice.junior@test.com',
  },
];

// ============================================================================
// Case Fixtures
// ============================================================================

export const mockCases = [
  {
    id: TEST_CASE_IDS.case1,
    title: 'Smith v. Jones Contract Dispute',
    type: CaseType.Contract,
    firmId: TEST_FIRM_ID,
  },
  {
    id: TEST_CASE_IDS.case2,
    title: 'Estate of Williams',
    type: CaseType.Litigation,
    firmId: TEST_FIRM_ID,
  },
  {
    id: TEST_CASE_IDS.case3,
    title: 'Acme Corp Merger',
    type: CaseType.Contract,
    firmId: TEST_FIRM_ID,
  },
];

// ============================================================================
// Completion Time Analytics Fixtures (AC: 1)
// ============================================================================

export const completedTasksFixtures = [
  // Research tasks - avg ~24 hours completion
  {
    id: 'task-completed-001',
    firmId: TEST_FIRM_ID,
    caseId: TEST_CASE_IDS.case1,
    type: TaskTypeEnum.Research,
    status: TaskStatus.Completed,
    title: 'Research case precedents',
    assignedTo: TEST_USER_IDS.associate,
    createdAt: daysAgo(10),
    completedAt: daysAgo(9), // 24 hours to complete
    assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
  },
  {
    id: 'task-completed-002',
    firmId: TEST_FIRM_ID,
    caseId: TEST_CASE_IDS.case1,
    type: TaskTypeEnum.Research,
    status: TaskStatus.Completed,
    title: 'Research regulatory requirements',
    assignedTo: TEST_USER_IDS.paralegal,
    createdAt: daysAgo(8),
    completedAt: daysAgo(7), // 24 hours
    assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
  },
  // Document tasks - avg ~48 hours completion
  {
    id: 'task-completed-003',
    firmId: TEST_FIRM_ID,
    caseId: TEST_CASE_IDS.case2,
    type: TaskTypeEnum.DocumentCreation,
    status: TaskStatus.Completed,
    title: 'Draft contract',
    assignedTo: TEST_USER_IDS.associate,
    createdAt: daysAgo(7),
    completedAt: daysAgo(5), // 48 hours
    assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
  },
  {
    id: 'task-completed-004',
    firmId: TEST_FIRM_ID,
    caseId: TEST_CASE_IDS.case2,
    type: TaskTypeEnum.DocumentCreation,
    status: TaskStatus.Completed,
    title: 'Prepare motion',
    assignedTo: TEST_USER_IDS.partner,
    createdAt: daysAgo(6),
    completedAt: daysAgo(4), // 48 hours
    assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
  },
  // Meeting tasks - avg ~2 hours
  {
    id: 'task-completed-005',
    firmId: TEST_FIRM_ID,
    caseId: TEST_CASE_IDS.case3,
    type: TaskTypeEnum.Meeting,
    status: TaskStatus.Completed,
    title: 'Client meeting',
    assignedTo: TEST_USER_IDS.partner,
    createdAt: hoursAgo(4),
    completedAt: hoursAgo(2), // 2 hours
    assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
  },
];

export const emptyCompletionFixture: typeof completedTasksFixtures = [];

export const singleTaskCompletionFixture = [completedTasksFixtures[0]];

// ============================================================================
// Overdue Analysis Fixtures (AC: 2)
// ============================================================================

export const overdueTasksFixtures = [
  // Critical: On critical path, 7 days overdue, high priority
  {
    id: 'task-overdue-001',
    firmId: TEST_FIRM_ID,
    caseId: TEST_CASE_IDS.case1,
    type: TaskTypeEnum.CourtDate,
    status: TaskStatus.InProgress,
    title: 'Prepare for hearing',
    assignedTo: TEST_USER_IDS.associate,
    dueDate: daysAgo(7),
    priority: TaskPriority.High,
    isCriticalPath: true,
    predecessors: [],
    successors: [{ successorId: 'task-blocked-001' }],
    assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
    case: mockCases.find((c) => c.id === TEST_CASE_IDS.case1),
  },
  // High impact: Blocking 2 other tasks
  {
    id: 'task-overdue-002',
    firmId: TEST_FIRM_ID,
    caseId: TEST_CASE_IDS.case1,
    type: TaskTypeEnum.Research,
    status: TaskStatus.Pending,
    title: 'Legal research for motion',
    assignedTo: TEST_USER_IDS.paralegal,
    dueDate: daysAgo(3),
    priority: TaskPriority.Medium,
    isCriticalPath: false,
    predecessors: [],
    successors: [{ successorId: 'task-blocked-002' }, { successorId: 'task-blocked-003' }],
    assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
    case: mockCases.find((c) => c.id === TEST_CASE_IDS.case1),
  },
  // User overload: Same user has multiple overdue
  {
    id: 'task-overdue-003',
    firmId: TEST_FIRM_ID,
    caseId: TEST_CASE_IDS.case2,
    type: TaskTypeEnum.DocumentRetrieval,
    status: TaskStatus.InProgress,
    title: 'Retrieve client documents',
    assignedTo: TEST_USER_IDS.paralegal, // Same user
    dueDate: daysAgo(2),
    priority: TaskPriority.Low,
    isCriticalPath: false,
    predecessors: [],
    successors: [],
    assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
    case: mockCases.find((c) => c.id === TEST_CASE_IDS.case2),
  },
  {
    id: 'task-overdue-004',
    firmId: TEST_FIRM_ID,
    caseId: TEST_CASE_IDS.case2,
    type: TaskTypeEnum.Research,
    status: TaskStatus.InProgress,
    title: 'Research tax implications',
    assignedTo: TEST_USER_IDS.paralegal, // Same user - overloaded
    dueDate: daysAgo(1),
    priority: TaskPriority.Medium,
    isCriticalPath: false,
    predecessors: [{ predecessorId: 'task-overdue-001' }], // Blocked by another overdue
    successors: [],
    assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
    case: mockCases.find((c) => c.id === TEST_CASE_IDS.case2),
  },
  // Case complexity: Multiple overdue on same case
  {
    id: 'task-overdue-005',
    firmId: TEST_FIRM_ID,
    caseId: TEST_CASE_IDS.case2, // Same case
    type: TaskTypeEnum.Meeting,
    status: TaskStatus.Pending,
    title: 'Follow-up meeting',
    assignedTo: TEST_USER_IDS.junior,
    dueDate: daysAgo(5),
    priority: TaskPriority.Low,
    isCriticalPath: false,
    predecessors: [],
    successors: [],
    assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.junior),
    case: mockCases.find((c) => c.id === TEST_CASE_IDS.case2),
  },
];

// ============================================================================
// Velocity Trends Fixtures (AC: 3)
// ============================================================================

export const velocityTasksFixtures = {
  // Current period (last 30 days)
  currentPeriod: [
    // Week 1: 10 created, 8 completed
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `task-vel-cur-created-w1-${i}`,
      firmId: TEST_FIRM_ID,
      assignedTo: TEST_USER_IDS.associate,
      createdAt: daysAgo(28 - i),
      completedAt: i < 8 ? daysAgo(27 - i) : null,
      status: i < 8 ? TaskStatus.Completed : TaskStatus.InProgress,
    })),
    // Week 2: 12 created, 10 completed
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `task-vel-cur-created-w2-${i}`,
      firmId: TEST_FIRM_ID,
      assignedTo: TEST_USER_IDS.paralegal,
      createdAt: daysAgo(21 - i),
      completedAt: i < 10 ? daysAgo(20 - i) : null,
      status: i < 10 ? TaskStatus.Completed : TaskStatus.InProgress,
    })),
    // Week 3: 15 created, 14 completed (improving)
    ...Array.from({ length: 15 }, (_, i) => ({
      id: `task-vel-cur-created-w3-${i}`,
      firmId: TEST_FIRM_ID,
      assignedTo: TEST_USER_IDS.junior,
      createdAt: daysAgo(14 - i),
      completedAt: i < 14 ? daysAgo(13 - i) : null,
      status: i < 14 ? TaskStatus.Completed : TaskStatus.InProgress,
    })),
    // Week 4: 18 created, 16 completed
    ...Array.from({ length: 18 }, (_, i) => ({
      id: `task-vel-cur-created-w4-${i}`,
      firmId: TEST_FIRM_ID,
      assignedTo: TEST_USER_IDS.partner,
      createdAt: daysAgo(7 - Math.floor(i / 3)),
      completedAt: i < 16 ? daysAgo(6 - Math.floor(i / 3)) : null,
      status: i < 16 ? TaskStatus.Completed : TaskStatus.InProgress,
    })),
  ],
  // Previous period (31-60 days ago) - lower velocity
  previousPeriod: Array.from({ length: 30 }, (_, i) => ({
    id: `task-vel-prev-${i}`,
    firmId: TEST_FIRM_ID,
    assignedTo: Object.values(TEST_USER_IDS)[i % 4],
    createdAt: daysAgo(60 - i),
    completedAt: i < 20 ? daysAgo(59 - i) : null, // Only 20 completed (67%)
    status: i < 20 ? TaskStatus.Completed : TaskStatus.InProgress,
  })),
};

// ============================================================================
// Pattern Detection Fixtures (AC: 4)
// ============================================================================

// Tasks that frequently occur together on the same case
export const patternDetectionFixtures = [
  // Pattern 1: Research + DocumentCreation (occurs 5 times together)
  ...[1, 2, 3, 4, 5].flatMap((i) => [
    {
      id: `task-pattern-research-${i}`,
      firmId: TEST_FIRM_ID,
      caseId: `case-pattern-${i}`,
      type: TaskTypeEnum.Research,
      assignedTo: TEST_USER_IDS.associate,
      createdAt: daysAgo(90 - i * 10),
      case: { type: CaseType.Contract },
      assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
    },
    {
      id: `task-pattern-doc-${i}`,
      firmId: TEST_FIRM_ID,
      caseId: `case-pattern-${i}`, // Same case
      type: TaskTypeEnum.DocumentCreation,
      assignedTo: TEST_USER_IDS.associate,
      createdAt: daysAgo(90 - i * 10 + 0.5), // Created within hours of research
      case: { type: CaseType.Contract },
      assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
    },
  ]),
  // Pattern 2: Sequence: Research -> Meeting (occurs 4 times)
  ...[1, 2, 3, 4].flatMap((i) => [
    {
      id: `task-seq-research-${i}`,
      firmId: TEST_FIRM_ID,
      caseId: `case-seq-${i}`,
      type: TaskTypeEnum.Research,
      assignedTo: TEST_USER_IDS.paralegal,
      createdAt: daysAgo(80 - i * 15),
      case: { type: CaseType.Litigation },
      assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
    },
    {
      id: `task-seq-meeting-${i}`,
      firmId: TEST_FIRM_ID,
      caseId: `case-seq-${i}`,
      type: TaskTypeEnum.Meeting,
      assignedTo: TEST_USER_IDS.partner,
      createdAt: daysAgo(80 - i * 15 - 2), // Created 2 days after research
      case: { type: CaseType.Litigation },
      assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
    },
  ]),
];

// ============================================================================
// Delegation Analytics Fixtures (AC: 5)
// ============================================================================

export const delegationFixtures = [
  // Successful delegations from Partner to Associate
  {
    id: 'delegation-001',
    delegatedBy: TEST_USER_IDS.partner,
    delegatedTo: TEST_USER_IDS.associate,
    status: DelegationStatus.Accepted,
    sourceTask: {
      type: TaskTypeEnum.Research,
      status: TaskStatus.Completed,
      dueDate: daysAgo(10),
      completedAt: daysAgo(11), // Completed on time
    },
    delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
    delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
  },
  {
    id: 'delegation-002',
    delegatedBy: TEST_USER_IDS.partner,
    delegatedTo: TEST_USER_IDS.associate,
    status: DelegationStatus.Accepted,
    sourceTask: {
      type: TaskTypeEnum.DocumentCreation,
      status: TaskStatus.Completed,
      dueDate: daysAgo(8),
      completedAt: daysAgo(9), // Completed on time
    },
    delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
    delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
  },
  // Struggling paralegal - late on Research tasks
  {
    id: 'delegation-003',
    delegatedBy: TEST_USER_IDS.associate,
    delegatedTo: TEST_USER_IDS.paralegal,
    status: DelegationStatus.Accepted,
    sourceTask: {
      type: TaskTypeEnum.Research,
      status: TaskStatus.Completed,
      dueDate: daysAgo(7),
      completedAt: daysAgo(4), // 3 days late
    },
    delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
    delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
  },
  {
    id: 'delegation-004',
    delegatedBy: TEST_USER_IDS.associate,
    delegatedTo: TEST_USER_IDS.paralegal,
    status: DelegationStatus.Accepted,
    sourceTask: {
      type: TaskTypeEnum.Research,
      status: TaskStatus.Completed,
      dueDate: daysAgo(5),
      completedAt: daysAgo(2), // 3 days late
    },
    delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
    delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
  },
  // Paralegal good at DocumentRetrieval
  {
    id: 'delegation-005',
    delegatedBy: TEST_USER_IDS.associate,
    delegatedTo: TEST_USER_IDS.paralegal,
    status: DelegationStatus.Accepted,
    sourceTask: {
      type: TaskTypeEnum.DocumentRetrieval,
      status: TaskStatus.Completed,
      dueDate: daysAgo(6),
      completedAt: daysAgo(7), // Completed early
    },
    delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
    delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
  },
  {
    id: 'delegation-006',
    delegatedBy: TEST_USER_IDS.partner,
    delegatedTo: TEST_USER_IDS.paralegal,
    status: DelegationStatus.Accepted,
    sourceTask: {
      type: TaskTypeEnum.DocumentRetrieval,
      status: TaskStatus.Completed,
      dueDate: daysAgo(4),
      completedAt: daysAgo(5), // Completed early
    },
    delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
    delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
  },
];

// ============================================================================
// ROI Calculator Fixtures (AC: 6)
// ============================================================================

export const roiFixtures = {
  // Template tasks
  templateTasks: Array.from({ length: 20 }, (_, i) => ({
    id: `task-template-${i}`,
    firmId: TEST_FIRM_ID,
    createdAt: daysAgo(30 - i),
    templateStepId: `template-step-${i % 5}`,
    parseHistoryId: null,
  })),
  // NLP-created tasks
  nlpTasks: Array.from({ length: 15 }, (_, i) => ({
    id: `task-nlp-${i}`,
    firmId: TEST_FIRM_ID,
    createdAt: daysAgo(30 - i),
    templateStepId: null,
    parseHistoryId: `parse-history-${i}`,
  })),
  // Manual tasks
  manualTasks: Array.from({ length: 10 }, (_, i) => ({
    id: `task-manual-${i}`,
    firmId: TEST_FIRM_ID,
    createdAt: daysAgo(30 - i),
    templateStepId: null,
    parseHistoryId: null,
  })),
  // Task dependencies (for auto-trigger count)
  dependencies: Array.from({ length: 8 }, (_, i) => ({
    id: `dependency-${i}`,
    predecessorId: `task-completed-${i}`,
    successorId: `task-unblocked-${i}`,
    predecessor: {
      firmId: TEST_FIRM_ID,
      completedAt: daysAgo(30 - i * 3),
    },
  })),
  // Task history for reassignments
  taskHistory: Array.from({ length: 5 }, (_, i) => ({
    id: `history-${i}`,
    taskId: `task-reassigned-${i}`,
    action: 'AssigneeChanged',
    createdAt: daysAgo(30 - i * 5),
    task: { firmId: TEST_FIRM_ID },
  })),
  // Firm with hourly rates
  firm: {
    id: TEST_FIRM_ID,
    defaultRates: {
      Partner: 500,
      Associate: 300,
      Paralegal: 150,
    },
  },
};

// ============================================================================
// Analytics Filter Fixtures
// ============================================================================

export const defaultFilters = {
  firmId: TEST_FIRM_ID,
  dateRange: {
    start: daysAgo(30),
    end: now,
  },
};

export const quarterFilters = {
  firmId: TEST_FIRM_ID,
  dateRange: {
    start: daysAgo(90),
    end: now,
  },
};

export const userFilteredFilters = {
  ...defaultFilters,
  userIds: [TEST_USER_IDS.associate, TEST_USER_IDS.paralegal],
};

export const taskTypeFilteredFilters = {
  ...defaultFilters,
  taskTypes: [TaskTypeEnum.Research, TaskTypeEnum.DocumentCreation],
};
