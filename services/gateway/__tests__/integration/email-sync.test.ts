/**
 * Email Sync Integration Tests
 * Story 5.1: Email Integration and Synchronization
 *
 * Integration tests for email sync, categorization, and threading
 */

import { PrismaClient } from '@prisma/client';

// Test database client
let prisma: PrismaClient;

// Test data
const TEST_USER_ID = 'test-user-email-sync';
const TEST_FIRM_ID = 'test-firm-email-sync';

describe('Email Sync Integration', () => {
  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    // Create test user and firm
    await prisma.firm.upsert({
      where: { id: TEST_FIRM_ID },
      create: {
        id: TEST_FIRM_ID,
        name: 'Test Firm for Email',
        email: 'test@emailfirm.com',
        subscriptionTier: 'Professional',
      },
      update: {},
    });

    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      create: {
        id: TEST_USER_ID,
        email: 'testuser@emailfirm.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'Associate',
        firmId: TEST_FIRM_ID,
      },
      update: {},
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.email.deleteMany({
      where: { userId: TEST_USER_ID },
    });
    await prisma.emailSyncState.deleteMany({
      where: { userId: TEST_USER_ID },
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
    // Clear emails before each test
    await prisma.email.deleteMany({
      where: { userId: TEST_USER_ID },
    });
  });

  describe('Email Storage', () => {
    it('should store email with correct fields', async () => {
      const email = await prisma.email.create({
        data: {
          graphMessageId: 'graph-msg-test-1',
          conversationId: 'conv-test-1',
          subject: 'Test Subject',
          bodyPreview: 'Test preview',
          bodyContent: 'Full test content',
          bodyContentType: 'text',
          from: { name: 'Sender', address: 'sender@test.com' },
          toRecipients: [{ name: 'Recipient', address: 'recipient@test.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'normal',
          isRead: false,
          userId: TEST_USER_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      expect(email.id).toBeDefined();
      expect(email.graphMessageId).toBe('graph-msg-test-1');
      expect(email.subject).toBe('Test Subject');
    });

    it('should enforce unique graphMessageId', async () => {
      await prisma.email.create({
        data: {
          graphMessageId: 'unique-msg-test',
          conversationId: 'conv-unique',
          subject: 'First Email',
          bodyPreview: 'Preview',
          bodyContent: 'Content',
          bodyContentType: 'text',
          from: { address: 'sender@test.com' },
          toRecipients: [{ address: 'recipient@test.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'normal',
          isRead: false,
          userId: TEST_USER_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      await expect(
        prisma.email.create({
          data: {
            graphMessageId: 'unique-msg-test', // Same ID
            conversationId: 'conv-unique-2',
            subject: 'Second Email',
            bodyPreview: 'Preview',
            bodyContent: 'Content',
            bodyContentType: 'text',
            from: { address: 'sender@test.com' },
            toRecipients: [{ address: 'recipient@test.com' }],
            ccRecipients: [],
            bccRecipients: [],
            receivedDateTime: new Date(),
            sentDateTime: new Date(),
            hasAttachments: false,
            importance: 'normal',
            isRead: false,
            userId: TEST_USER_ID,
            firmId: TEST_FIRM_ID,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Email Threading', () => {
    it('should group emails by conversationId', async () => {
      // Create multiple emails in same conversation
      await prisma.email.createMany({
        data: [
          {
            graphMessageId: 'thread-msg-1',
            conversationId: 'test-thread-conv',
            subject: 'Thread Subject',
            bodyPreview: 'First message',
            bodyContent: 'Content 1',
            bodyContentType: 'text',
            from: { address: 'sender@test.com' },
            toRecipients: [{ address: 'recipient@test.com' }],
            ccRecipients: [],
            bccRecipients: [],
            receivedDateTime: new Date('2024-01-01T10:00:00Z'),
            sentDateTime: new Date('2024-01-01T10:00:00Z'),
            hasAttachments: false,
            importance: 'normal',
            isRead: true,
            userId: TEST_USER_ID,
            firmId: TEST_FIRM_ID,
          },
          {
            graphMessageId: 'thread-msg-2',
            conversationId: 'test-thread-conv',
            subject: 'Re: Thread Subject',
            bodyPreview: 'Reply message',
            bodyContent: 'Content 2',
            bodyContentType: 'text',
            from: { address: 'recipient@test.com' },
            toRecipients: [{ address: 'sender@test.com' }],
            ccRecipients: [],
            bccRecipients: [],
            receivedDateTime: new Date('2024-01-01T11:00:00Z'),
            sentDateTime: new Date('2024-01-01T11:00:00Z'),
            hasAttachments: false,
            importance: 'normal',
            isRead: false,
            userId: TEST_USER_ID,
            firmId: TEST_FIRM_ID,
          },
        ],
      });

      // Query by conversation
      const threadEmails = await prisma.email.findMany({
        where: {
          userId: TEST_USER_ID,
          conversationId: 'test-thread-conv',
        },
        orderBy: { receivedDateTime: 'asc' },
      });

      expect(threadEmails).toHaveLength(2);
      expect(threadEmails[0].subject).toBe('Thread Subject');
      expect(threadEmails[1].subject).toBe('Re: Thread Subject');
    });
  });

  describe('Email Sync State', () => {
    it('should store and retrieve sync state', async () => {
      await prisma.emailSyncState.upsert({
        where: { userId: TEST_USER_ID },
        create: {
          userId: TEST_USER_ID,
          syncStatus: 'synced',
          deltaToken: 'test-delta-token',
          lastSyncAt: new Date(),
        },
        update: {
          syncStatus: 'synced',
          deltaToken: 'test-delta-token',
          lastSyncAt: new Date(),
        },
      });

      const state = await prisma.emailSyncState.findUnique({
        where: { userId: TEST_USER_ID },
      });

      expect(state).toBeDefined();
      expect(state?.syncStatus).toBe('synced');
      expect(state?.deltaToken).toBe('test-delta-token');
    });
  });

  describe('Email Case Assignment', () => {
    it('should assign email to case', async () => {
      // Create a test case
      const testCase = await prisma.case.create({
        data: {
          id: 'test-case-for-email',
          caseNumber: 'CASE-EMAIL-001',
          title: 'Test Case for Email',
          status: 'Active',
          firmId: TEST_FIRM_ID,
        },
      });

      // Create email
      const email = await prisma.email.create({
        data: {
          graphMessageId: 'assign-msg-1',
          conversationId: 'assign-conv-1',
          subject: 'Email to assign',
          bodyPreview: 'Preview',
          bodyContent: 'Content',
          bodyContentType: 'text',
          from: { address: 'sender@test.com' },
          toRecipients: [{ address: 'recipient@test.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'normal',
          isRead: false,
          userId: TEST_USER_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      // Assign to case
      const updated = await prisma.email.update({
        where: { id: email.id },
        data: { caseId: testCase.id },
      });

      expect(updated.caseId).toBe(testCase.id);

      // Cleanup
      await prisma.email.delete({ where: { id: email.id } });
      await prisma.case.delete({ where: { id: testCase.id } });
    });
  });

  describe('Email Attachments', () => {
    it('should create email attachment record', async () => {
      const email = await prisma.email.create({
        data: {
          graphMessageId: 'attach-msg-1',
          conversationId: 'attach-conv-1',
          subject: 'Email with attachment',
          bodyPreview: 'Preview',
          bodyContent: 'Content',
          bodyContentType: 'text',
          from: { address: 'sender@test.com' },
          toRecipients: [{ address: 'recipient@test.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: true,
          importance: 'normal',
          isRead: false,
          userId: TEST_USER_ID,
          firmId: TEST_FIRM_ID,
        },
      });

      const attachment = await prisma.emailAttachment.create({
        data: {
          emailId: email.id,
          graphAttachmentId: 'graph-attach-1',
          name: 'document.pdf',
          contentType: 'application/pdf',
          size: 102400,
        },
      });

      expect(attachment.id).toBeDefined();
      expect(attachment.name).toBe('document.pdf');

      // Verify relation
      const emailWithAttachments = await prisma.email.findUnique({
        where: { id: email.id },
        include: { attachments: true },
      });

      expect(emailWithAttachments?.attachments).toHaveLength(1);
    });
  });
});
