/**
 * Communication Intelligence Integration Tests
 * Story 5.2: Communication Intelligence Engine - Task 26
 *
 * Integration tests for intelligence extraction and thread analysis
 */

import { PrismaClient, ExtractionStatus, TaskPriority } from '@prisma/client';

// Test database client
let prisma: PrismaClient;

// Test data IDs
const TEST_USER_ID = 'test-user-comm-intel';
const TEST_FIRM_ID = 'test-firm-comm-intel';
const TEST_CASE_ID = 'test-case-comm-intel';

describe('Communication Intelligence Integration', () => {
  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    // Create test firm
    await prisma.firm.upsert({
      where: { id: TEST_FIRM_ID },
      create: {
        id: TEST_FIRM_ID,
        name: 'Test Firm for Intelligence',
      },
      update: {},
    });

    // Create test client first (required for case)
    const TEST_CLIENT_ID = 'test-client-comm-intel';
    await prisma.client.upsert({
      where: { id: TEST_CLIENT_ID },
      create: {
        id: TEST_CLIENT_ID,
        firmId: TEST_FIRM_ID,
        name: 'Test Client for Intelligence',
        contactInfo: { email: 'client@test.com' },
      },
      update: {},
    });

    // Create test user
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      create: {
        id: TEST_USER_ID,
        email: 'testuser@intelfirm.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'Associate',
        firmId: TEST_FIRM_ID,
        azureAdId: 'azure-ad-test-comm-intel',
      },
      update: {},
    });

    // Create test case
    await prisma.case.upsert({
      where: { id: TEST_CASE_ID },
      create: {
        id: TEST_CASE_ID,
        caseNumber: 'INTEL-2024-001',
        title: 'Intelligence Test Case',
        type: 'Litigation',
        status: 'Active',
        firmId: TEST_FIRM_ID,
        clientId: TEST_CLIENT_ID,
        description: 'Test case for communication intelligence integration tests',
        openedDate: new Date(),
      },
      update: {},
    });
  });

  afterAll(async () => {
    // Cleanup in correct order (respecting foreign keys)
    await prisma.extractedDeadline.deleteMany({
      where: { email: { userId: TEST_USER_ID } },
    });
    await prisma.extractedCommitment.deleteMany({
      where: { email: { userId: TEST_USER_ID } },
    });
    await prisma.extractedActionItem.deleteMany({
      where: { email: { userId: TEST_USER_ID } },
    });
    await prisma.extractedQuestion.deleteMany({
      where: { email: { userId: TEST_USER_ID } },
    });
    await prisma.email.deleteMany({
      where: { userId: TEST_USER_ID },
    });
    await prisma.task.deleteMany({
      where: { caseId: TEST_CASE_ID },
    });
    await prisma.case.deleteMany({
      where: { id: TEST_CASE_ID },
    });
    await prisma.client.deleteMany({
      where: { id: 'test-client-comm-intel' },
    });
    await prisma.user.delete({
      where: { id: TEST_USER_ID },
    });
    await prisma.firm.delete({
      where: { id: TEST_FIRM_ID },
    });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear extractions before each test
    await prisma.extractedDeadline.deleteMany({
      where: { email: { userId: TEST_USER_ID } },
    });
    await prisma.extractedCommitment.deleteMany({
      where: { email: { userId: TEST_USER_ID } },
    });
    await prisma.extractedActionItem.deleteMany({
      where: { email: { userId: TEST_USER_ID } },
    });
    await prisma.extractedQuestion.deleteMany({
      where: { email: { userId: TEST_USER_ID } },
    });
    await prisma.email.deleteMany({
      where: { userId: TEST_USER_ID },
    });
  });

  describe('Extracted Deadlines (AC: 1)', () => {
    it('should store extracted deadline with all fields', async () => {
      // Create test email
      const email = await prisma.email.create({
        data: {
          graphMessageId: 'graph-msg-deadline-1',
          conversationId: 'conv-deadline-1',
          subject: 'Filing Deadline Reminder',
          bodyPreview: 'Please file by December 20th',
          bodyContent: '<p>Please file the motion by December 20th, 2024.</p>',
          bodyContentType: 'html',
          from: { name: 'Partner', address: 'partner@lawfirm.com' },
          toRecipients: [{ name: 'Associate', address: 'associate@lawfirm.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'normal',
          isRead: false,
          userId: TEST_USER_ID,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      // Create extracted deadline
      const deadline = await prisma.extractedDeadline.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          description: 'File the motion',
          dueDate: new Date('2024-12-20'),
          confidence: 0.95,
          status: ExtractionStatus.Pending,
        },
      });

      expect(deadline.id).toBeDefined();
      expect(deadline.description).toBe('File the motion');
      expect(deadline.confidence).toBe(0.95);
      expect(deadline.status).toBe(ExtractionStatus.Pending);
    });

    it('should update deadline status on conversion', async () => {
      const email = await prisma.email.create({
        data: {
          graphMessageId: 'graph-msg-deadline-2',
          conversationId: 'conv-deadline-2',
          subject: 'Court Deadline',
          bodyPreview: 'Response due Friday',
          bodyContent: 'Response due Friday',
          bodyContentType: 'text',
          from: { name: 'Court', address: 'court@example.com' },
          toRecipients: [{ address: 'user@lawfirm.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'high',
          isRead: false,
          userId: TEST_USER_ID,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      const deadline = await prisma.extractedDeadline.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          description: 'Submit court response',
          dueDate: new Date('2024-12-22'),
          confidence: 0.9,
          status: ExtractionStatus.Pending,
        },
      });

      // Update to converted
      const updated = await prisma.extractedDeadline.update({
        where: { id: deadline.id },
        data: {
          status: ExtractionStatus.Converted,
          convertedTaskId: 'task-123',
        },
      });

      expect(updated.status).toBe(ExtractionStatus.Converted);
      expect(updated.convertedTaskId).toBe('task-123');
    });
  });

  describe('Extracted Commitments (AC: 1)', () => {
    it('should store extracted commitment with party information', async () => {
      const email = await prisma.email.create({
        data: {
          graphMessageId: 'graph-msg-commit-1',
          conversationId: 'conv-commit-1',
          subject: 'Re: Settlement Discussion',
          bodyPreview: 'We agree to provide documents',
          bodyContent: 'We commit to providing all discovery documents within 10 days.',
          bodyContentType: 'text',
          from: { name: 'Opposing Counsel', address: 'opposing@lawfirm.com' },
          toRecipients: [{ address: 'user@lawfirm.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'normal',
          isRead: false,
          userId: TEST_USER_ID,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      const commitment = await prisma.extractedCommitment.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          party: 'Opposing Counsel',
          commitmentText: 'Provide all discovery documents within 10 days',
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          confidence: 0.88,
          status: ExtractionStatus.Pending,
        },
      });

      expect(commitment.party).toBe('Opposing Counsel');
      expect(commitment.commitmentText).toContain('discovery documents');
      expect(commitment.confidence).toBe(0.88);
    });
  });

  describe('Extracted Action Items (AC: 4)', () => {
    it('should store action item with priority', async () => {
      const email = await prisma.email.create({
        data: {
          graphMessageId: 'graph-msg-action-1',
          conversationId: 'conv-action-1',
          subject: 'URGENT: Review Required',
          bodyPreview: 'Please review the contract',
          bodyContent: 'Please review the attached contract by EOD.',
          bodyContentType: 'text',
          from: { name: 'Senior Partner', address: 'partner@lawfirm.com' },
          toRecipients: [{ address: 'user@lawfirm.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'high',
          isRead: false,
          userId: TEST_USER_ID,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      const actionItem = await prisma.extractedActionItem.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          description: 'Review the attached contract',
          suggestedAssignee: 'Legal Team',
          priority: TaskPriority.Urgent,
          confidence: 0.92,
          status: ExtractionStatus.Pending,
        },
      });

      expect(actionItem.priority).toBe(TaskPriority.Urgent);
      expect(actionItem.suggestedAssignee).toBe('Legal Team');
    });

    it('should handle action item dismissal', async () => {
      const email = await prisma.email.create({
        data: {
          graphMessageId: 'graph-msg-action-2',
          conversationId: 'conv-action-2',
          subject: 'Follow up',
          bodyPreview: 'Can you check this?',
          bodyContent: 'Can you check this when you have time?',
          bodyContentType: 'text',
          from: { address: 'colleague@lawfirm.com' },
          toRecipients: [{ address: 'user@lawfirm.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'low',
          isRead: false,
          userId: TEST_USER_ID,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      const actionItem = await prisma.extractedActionItem.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          description: 'Check the mentioned item',
          priority: TaskPriority.Low,
          confidence: 0.6,
          status: ExtractionStatus.Pending,
        },
      });

      const dismissed = await prisma.extractedActionItem.update({
        where: { id: actionItem.id },
        data: {
          status: ExtractionStatus.Dismissed,
          dismissedAt: new Date(),
          dismissReason: 'Not relevant to current work',
        },
      });

      expect(dismissed.status).toBe(ExtractionStatus.Dismissed);
      expect(dismissed.dismissReason).toBe('Not relevant to current work');
    });
  });

  describe('Extracted Questions (AC: 1)', () => {
    it('should store questions requiring response', async () => {
      const email = await prisma.email.create({
        data: {
          graphMessageId: 'graph-msg-question-1',
          conversationId: 'conv-question-1',
          subject: 'Clarification Needed',
          bodyPreview: 'Can you confirm the terms?',
          bodyContent: 'Can you confirm the terms of the agreement? Also, when is the next meeting scheduled?',
          bodyContentType: 'text',
          from: { name: 'Client', address: 'client@company.com' },
          toRecipients: [{ address: 'user@lawfirm.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'normal',
          isRead: false,
          userId: TEST_USER_ID,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      const question1 = await prisma.extractedQuestion.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          questionText: 'Can you confirm the terms of the agreement?',
          confidence: 0.95,
          status: ExtractionStatus.Pending,
        },
      });

      const question2 = await prisma.extractedQuestion.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          questionText: 'When is the next meeting scheduled?',
          confidence: 0.9,
          status: ExtractionStatus.Pending,
        },
      });

      expect(question1.questionText).toContain('confirm the terms');
      expect(question2.questionText).toContain('next meeting');
    });
  });

  describe('Thread Analysis (AC: 3, 5)', () => {
    it('should group emails by conversation', async () => {
      const conversationId = 'conv-thread-test-1';

      // Create multiple emails in same thread
      await prisma.email.createMany({
        data: [
          {
            graphMessageId: 'thread-msg-1',
            conversationId,
            subject: 'Initial Discussion',
            bodyPreview: 'Let us discuss...',
            bodyContent: 'Let us discuss the terms.',
            bodyContentType: 'text',
            from: { name: 'Alice', address: 'alice@example.com' },
            toRecipients: [{ address: 'bob@example.com' }],
            ccRecipients: [],
            bccRecipients: [],
            receivedDateTime: new Date('2024-12-10T10:00:00Z'),
            sentDateTime: new Date('2024-12-10T09:59:00Z'),
            hasAttachments: false,
            importance: 'normal',
            isRead: false,
            userId: TEST_USER_ID,
            caseId: TEST_CASE_ID,
            firmId: TEST_FIRM_ID,
          },
          {
            graphMessageId: 'thread-msg-2',
            conversationId,
            subject: 'Re: Initial Discussion',
            bodyPreview: 'I agree...',
            bodyContent: 'I agree with your proposal.',
            bodyContentType: 'text',
            from: { name: 'Bob', address: 'bob@example.com' },
            toRecipients: [{ address: 'alice@example.com' }],
            ccRecipients: [],
            bccRecipients: [],
            receivedDateTime: new Date('2024-12-10T11:00:00Z'),
            sentDateTime: new Date('2024-12-10T10:59:00Z'),
            hasAttachments: false,
            importance: 'normal',
            isRead: false,
            userId: TEST_USER_ID,
            caseId: TEST_CASE_ID,
            firmId: TEST_FIRM_ID,
          },
          {
            graphMessageId: 'thread-msg-3',
            conversationId,
            subject: 'Re: Initial Discussion',
            bodyPreview: 'Great, let us proceed...',
            bodyContent: 'Great, let us proceed with the next steps.',
            bodyContentType: 'text',
            from: { name: 'Alice', address: 'alice@example.com' },
            toRecipients: [{ address: 'bob@example.com' }],
            ccRecipients: [],
            bccRecipients: [],
            receivedDateTime: new Date('2024-12-10T12:00:00Z'),
            sentDateTime: new Date('2024-12-10T11:59:00Z'),
            hasAttachments: false,
            importance: 'normal',
            isRead: false,
            userId: TEST_USER_ID,
            caseId: TEST_CASE_ID,
            firmId: TEST_FIRM_ID,
          },
        ],
      });

      // Query emails in thread
      const threadEmails = await prisma.email.findMany({
        where: { conversationId, userId: TEST_USER_ID },
        orderBy: { receivedDateTime: 'asc' },
      });

      expect(threadEmails).toHaveLength(3);
      expect(threadEmails[0].subject).toBe('Initial Discussion');
      expect(threadEmails[2].subject).toBe('Re: Initial Discussion');
    });

    it('should retrieve extractions for thread', async () => {
      const conversationId = 'conv-thread-extract-1';

      const email = await prisma.email.create({
        data: {
          graphMessageId: 'thread-extract-msg-1',
          conversationId,
          subject: 'Important Updates',
          bodyPreview: 'Several items to address',
          bodyContent: 'We need to file by Friday. Can you confirm receipt?',
          bodyContentType: 'text',
          from: { address: 'sender@example.com' },
          toRecipients: [{ address: 'user@lawfirm.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'high',
          isRead: false,
          userId: TEST_USER_ID,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      // Create multiple extraction types for same email
      await prisma.extractedDeadline.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          description: 'File by Friday',
          dueDate: new Date('2024-12-20'),
          confidence: 0.9,
          status: ExtractionStatus.Pending,
        },
      });

      await prisma.extractedQuestion.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          questionText: 'Can you confirm receipt?',
          confidence: 0.95,
          status: ExtractionStatus.Pending,
        },
      });

      // Query all extractions for the email
      const deadlines = await prisma.extractedDeadline.findMany({
        where: { emailId: email.id },
      });
      const questions = await prisma.extractedQuestion.findMany({
        where: { emailId: email.id },
      });

      expect(deadlines).toHaveLength(1);
      expect(questions).toHaveLength(1);
    });
  });

  describe('Confidence Scoring (AC: 6)', () => {
    it('should store confidence scores in valid range', async () => {
      const email = await prisma.email.create({
        data: {
          graphMessageId: 'graph-msg-confidence-1',
          conversationId: 'conv-confidence-1',
          subject: 'Test Confidence',
          bodyPreview: 'Testing...',
          bodyContent: 'Testing confidence scoring.',
          bodyContentType: 'text',
          from: { address: 'sender@example.com' },
          toRecipients: [{ address: 'user@lawfirm.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'normal',
          isRead: false,
          userId: TEST_USER_ID,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      const highConfidence = await prisma.extractedDeadline.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          description: 'High confidence item',
          dueDate: new Date('2024-12-25'),
          confidence: 0.95,
          status: ExtractionStatus.Pending,
        },
      });

      const mediumConfidence = await prisma.extractedActionItem.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          description: 'Medium confidence item',
          priority: TaskPriority.Medium,
          confidence: 0.7,
          status: ExtractionStatus.Pending,
        },
      });

      const lowConfidence = await prisma.extractedQuestion.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          questionText: 'Low confidence question',
          confidence: 0.45,
          status: ExtractionStatus.Pending,
        },
      });

      expect(highConfidence.confidence).toBeGreaterThanOrEqual(0.8);
      expect(mediumConfidence.confidence).toBeGreaterThanOrEqual(0.6);
      expect(mediumConfidence.confidence).toBeLessThan(0.8);
      expect(lowConfidence.confidence).toBeLessThan(0.5);
    });
  });

  describe('Case Assignment (AC: 7)', () => {
    it('should associate extractions with case', async () => {
      const email = await prisma.email.create({
        data: {
          graphMessageId: 'graph-msg-case-1',
          conversationId: 'conv-case-1',
          subject: 'Case Related Email',
          bodyPreview: 'Regarding our case...',
          bodyContent: 'Please review for the case.',
          bodyContentType: 'text',
          from: { address: 'client@example.com' },
          toRecipients: [{ address: 'user@lawfirm.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'normal',
          isRead: false,
          userId: TEST_USER_ID,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      const extraction = await prisma.extractedActionItem.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          description: 'Review documents',
          priority: TaskPriority.High,
          confidence: 0.85,
          status: ExtractionStatus.Pending,
        },
      });

      // Verify case association
      const withCase = await prisma.extractedActionItem.findUnique({
        where: { id: extraction.id },
        include: { case: true },
      });

      expect(withCase?.caseId).toBe(TEST_CASE_ID);
      expect(withCase?.case?.caseNumber).toBe('INTEL-2024-001');
    });

    it('should retrieve all extractions for a case', async () => {
      const email = await prisma.email.create({
        data: {
          graphMessageId: 'graph-msg-case-all-1',
          conversationId: 'conv-case-all-1',
          subject: 'Multiple Extractions',
          bodyPreview: 'Several items...',
          bodyContent: 'Multiple items for the case.',
          bodyContentType: 'text',
          from: { address: 'client@example.com' },
          toRecipients: [{ address: 'user@lawfirm.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'normal',
          isRead: false,
          userId: TEST_USER_ID,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      await prisma.extractedDeadline.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          description: 'Case deadline',
          dueDate: new Date('2024-12-30'),
          confidence: 0.9,
          status: ExtractionStatus.Pending,
        },
      });

      await prisma.extractedActionItem.create({
        data: {
          emailId: email.id,
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
          description: 'Case action',
          priority: TaskPriority.High,
          confidence: 0.85,
          status: ExtractionStatus.Pending,
        },
      });

      // Query all extractions for case
      const caseDeadlines = await prisma.extractedDeadline.findMany({
        where: { caseId: TEST_CASE_ID },
      });
      const caseActions = await prisma.extractedActionItem.findMany({
        where: { caseId: TEST_CASE_ID },
      });

      expect(caseDeadlines.length).toBeGreaterThanOrEqual(1);
      expect(caseActions.length).toBeGreaterThanOrEqual(1);
    });
  });
});
