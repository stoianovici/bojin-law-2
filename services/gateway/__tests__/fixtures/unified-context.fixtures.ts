/**
 * Test fixtures for Unified Context Service
 * Provides consistent test data for unit tests
 */

import { randomUUID } from 'crypto';

// ============================================================================
// IDs
// ============================================================================

export const TEST_IDS = {
  firm: 'firm-test-001',
  client: 'client-test-001',
  case: 'case-test-001',
  user: 'user-test-001',
  document1: 'doc-test-001',
  document2: 'doc-test-002',
  email1: 'email-test-001',
  thread1: 'thread-test-001',
  contextFile: 'ctx-file-001',
  correction1: 'correction-001',
};

// ============================================================================
// User Corrections
// ============================================================================

export const validUserCorrection = {
  id: TEST_IDS.correction1,
  sectionId: 'identity',
  fieldPath: 'name',
  correctionType: 'override' as const,
  originalValue: 'Old Name',
  correctedValue: 'New Name',
  reason: 'Name was incorrect',
  createdAt: '2025-01-15T10:00:00.000Z',
  createdBy: TEST_IDS.user,
  isActive: true,
};

export const invalidUserCorrection = {
  id: 'invalid-corr',
  // Missing required fields
  sectionId: 'identity',
};

export const partiallyValidCorrectionsArray = [
  validUserCorrection,
  invalidUserCorrection, // This one is invalid
  {
    ...validUserCorrection,
    id: 'correction-002',
    correctedValue: 'Another correction',
  },
];

// ============================================================================
// Client Data
// ============================================================================

export const mockClient = {
  id: TEST_IDS.client,
  firmId: TEST_IDS.firm,
  name: 'Test Company SRL',
  clientType: 'Company',
  companyType: 'SRL',
  cui: 'RO12345678',
  registrationNumber: 'J40/1234/2020',
  address: 'Str. Test 123, Bucharest',
  contactInfo: {
    phone: '+40721234567',
    email: 'contact@test.com',
  },
  administrators: JSON.stringify([
    { name: 'John Admin', role: 'Administrator', email: 'john@test.com' },
  ]),
  contacts: JSON.stringify([
    { name: 'Jane Contact', role: 'Contact', email: 'jane@test.com', isPrimary: true },
  ]),
  firm: { id: TEST_IDS.firm },
};

// ============================================================================
// Case Data
// ============================================================================

export const mockCase = {
  id: TEST_IDS.case,
  firmId: TEST_IDS.firm,
  caseNumber: 'D/2025/001',
  title: 'Test Case Title',
  type: 'civil',
  status: 'Active',
  description: 'Test case description',
  metadata: { court: 'Tribunal Bucharest' },
  value: { toNumber: () => 50000 },
  openedDate: new Date('2025-01-01T00:00:00.000Z'),
  closedDate: null,
  keywords: ['test', 'civil'],
  clientId: TEST_IDS.client,
  client: mockClient,
  actors: [
    {
      id: 'actor-001',
      name: 'Opposing Party',
      role: 'DEFENDANT',
      customRoleCode: null,
      organization: 'Other Company',
      email: 'opposing@other.com',
      emailDomains: ['other.com'],
      phone: '+40722222222',
      address: 'Another street',
      communicationNotes: 'Formal tone',
      preferredTone: 'formal',
    },
  ],
  teamMembers: [
    {
      userId: TEST_IDS.user,
      role: 'Lead',
      user: {
        id: TEST_IDS.user,
        firstName: 'Test',
        lastName: 'Lawyer',
        role: 'Partner',
      },
    },
  ],
  chapters: [{ phase: 'discovery', title: 'Discovery Phase' }],
};

// ============================================================================
// Context File Data
// ============================================================================

export const mockContextFile = {
  id: TEST_IDS.contextFile,
  firmId: TEST_IDS.firm,
  entityType: 'CLIENT' as const,
  clientId: TEST_IDS.client,
  caseId: null,
  identity: {
    entityType: 'CLIENT',
    id: TEST_IDS.client,
    name: 'Test Company SRL',
    type: 'company',
    cui: 'RO12345678',
  },
  people: { entityType: 'CLIENT', administrators: [], contacts: [] },
  documents: { items: [], totalCount: 0, hasMore: false },
  communications: {
    overview: '',
    threads: [],
    emails: [],
    totalThreads: 0,
    unreadCount: 0,
    urgentCount: 0,
    pendingActions: [],
  },
  userCorrections: [validUserCorrection],
  lastCorrectedBy: TEST_IDS.user,
  correctionsAppliedAt: new Date(),
  contentCritical: '## Client: Test Company',
  contentStandard: '## Client: Test Company\n\nDetails...',
  contentFull: '## Client: Test Company\n\nFull details...',
  tokensCritical: 50,
  tokensStandard: 150,
  tokensFull: 500,
  parentContextSnapshot: null,
  version: 1,
  schemaVersion: 1, // Current schema version to prevent regeneration
  generatedAt: new Date(),
  validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockExpiredContextFile = {
  ...mockContextFile,
  id: 'ctx-expired-001',
  schemaVersion: 0, // Outdated schema version to trigger regeneration
  validUntil: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  generatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
};

// Case context file mock
export const mockCaseContextFile = {
  ...mockContextFile,
  id: 'ctx-case-001',
  entityType: 'CASE' as const,
  clientId: null,
  caseId: TEST_IDS.case,
  identity: {
    entityType: 'CASE',
    id: TEST_IDS.case,
    caseNumber: 'D/2025/001',
    title: 'Test Case Title',
    type: 'civil',
    typeLabel: 'Civil',
    status: 'Active',
    statusLabel: 'Activ',
    openedDate: '2025-01-01',
  },
  people: { entityType: 'CASE', actors: [], team: [] },
  parentContextSnapshot: {
    entityType: 'CLIENT',
    id: TEST_IDS.client,
    name: 'Test Company SRL',
    type: 'company',
    people: { entityType: 'CLIENT', administrators: [], contacts: [] },
  },
};

// ============================================================================
// Context References
// ============================================================================

export const mockContextReferences = [
  {
    id: randomUUID(),
    contextFileId: TEST_IDS.contextFile,
    refId: 'DOC-abc12',
    refType: 'DOCUMENT',
    sourceId: TEST_IDS.document1,
    sourceType: 'Document',
    title: 'Contract.pdf',
    summary: 'Main contract document',
    sourceDate: new Date(),
    contextFile: {
      clientId: TEST_IDS.client,
      caseId: null,
      firmId: TEST_IDS.firm,
    },
  },
  {
    id: randomUUID(),
    contextFileId: TEST_IDS.contextFile,
    refId: 'EMAIL-xyz89',
    refType: 'EMAIL',
    sourceId: TEST_IDS.email1,
    sourceType: 'Email',
    title: 'Re: Important matter',
    summary: 'Email discussing important matter',
    sourceDate: new Date(),
    contextFile: {
      clientId: TEST_IDS.client,
      caseId: null,
      firmId: TEST_IDS.firm,
    },
  },
];

// ============================================================================
// Document Data
// ============================================================================

export const mockDocuments = [
  {
    id: TEST_IDS.document1,
    fileName: 'Contract.pdf',
    storagePath: '/storage/doc1.pdf',
    sharePointItemId: 'sp-item-001',
    createdAt: new Date(),
    fileType: 'application/pdf',
    extractedContent: 'Contract content...',
    userDescription: 'Main contract',
    extractionStatus: 'COMPLETED',
    sourceType: 'UPLOADED',
  },
  {
    id: TEST_IDS.document2,
    fileName: 'Invoice.pdf',
    storagePath: '/storage/doc2.pdf',
    sharePointItemId: null,
    createdAt: new Date(),
    fileType: 'application/pdf',
    extractedContent: null,
    userDescription: null,
    extractionStatus: 'NONE',
    sourceType: 'EMAIL_ATTACHMENT',
  },
];

// ============================================================================
// Email Data
// ============================================================================

export const mockEmails = [
  {
    id: TEST_IDS.email1,
    graphMessageId: 'graph-msg-001',
    subject: 'Re: Important matter',
    from: { emailAddress: { name: 'John Doe', address: 'john@example.com' } },
    receivedDateTime: new Date(),
    bodyPreview: 'Thank you for your message...',
    hasAttachments: false,
    importance: 'normal',
  },
];

// ============================================================================
// Thread Summary Data
// ============================================================================

export const mockThreadSummaries = [
  {
    id: TEST_IDS.thread1,
    conversationId: 'conv-001',
    messageCount: 5,
    participants: ['john@example.com', 'jane@example.com'],
    overview: 'Discussion about contract terms',
    keyPoints: ['Point 1', 'Point 2'],
    actionItems: ['Action 1'],
    sentiment: 'neutral',
    lastAnalyzedAt: new Date(),
  },
];

// ============================================================================
// Cross-Firm Reference (for security tests)
// ============================================================================

export const crossFirmReference = {
  ...mockContextReferences[0],
  contextFile: {
    ...mockContextReferences[0].contextFile,
    firmId: 'other-firm-id', // Different firm
  },
};
