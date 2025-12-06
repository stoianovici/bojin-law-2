/**
 * Communication Hub Integration Tests
 * Story 5.5: Multi-Channel Communication Hub - Task 38
 *
 * Integration tests for unified timeline, templates, bulk communications, and exports
 */

import {
  PrismaClient,
  CommunicationChannel,
  CommunicationDirection,
  PrivacyLevel,
  TemplateCategory,
  BulkCommunicationStatus,
  BulkRecipientType,
  ExportFormat,
  ExportStatus,
} from '@prisma/client';

// Test database client
let prisma: PrismaClient;

// Test data IDs
const TEST_USER_ID = 'test-user-comm-hub';
const TEST_USER_ID_2 = 'test-user-comm-hub-2';
const TEST_FIRM_ID = 'test-firm-comm-hub';
const TEST_CASE_ID = 'test-case-comm-hub';
const TEST_CLIENT_ID = 'test-client-comm-hub';

describe('Communication Hub Integration', () => {
  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    // Create test firm
    await prisma.firm.upsert({
      where: { id: TEST_FIRM_ID },
      create: {
        id: TEST_FIRM_ID,
        name: 'Test Firm for Communication Hub',
      },
      update: {},
    });

    // Create test client
    await prisma.client.upsert({
      where: { id: TEST_CLIENT_ID },
      create: {
        id: TEST_CLIENT_ID,
        firmId: TEST_FIRM_ID,
        name: 'Test Client',
        contactInfo: { email: 'client@test.com' },
      },
      update: {},
    });

    // Create test users
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      create: {
        id: TEST_USER_ID,
        email: 'partner@hubfirm.com',
        firstName: 'Partner',
        lastName: 'User',
        role: 'Partner',
        firmId: TEST_FIRM_ID,
        azureAdId: 'azure-ad-partner-hub',
      },
      update: {},
    });

    await prisma.user.upsert({
      where: { id: TEST_USER_ID_2 },
      create: {
        id: TEST_USER_ID_2,
        email: 'paralegal@hubfirm.com',
        firstName: 'Paralegal',
        lastName: 'User',
        role: 'Paralegal',
        firmId: TEST_FIRM_ID,
        azureAdId: 'azure-ad-paralegal-hub',
      },
      update: {},
    });

    // Create test case
    await prisma.case.upsert({
      where: { id: TEST_CASE_ID },
      create: {
        id: TEST_CASE_ID,
        caseNumber: 'HUB-2024-001',
        title: 'Communication Hub Test Case',
        type: 'Litigation',
        status: 'Active',
        firmId: TEST_FIRM_ID,
        clientId: TEST_CLIENT_ID,
        description: 'Test case for communication hub integration tests',
        openedDate: new Date(),
      },
      update: {},
    });
  });

  afterAll(async () => {
    // Cleanup in correct order (respecting foreign keys)
    await prisma.communicationAttachment.deleteMany({
      where: { communicationEntry: { firmId: TEST_FIRM_ID } },
    });
    await prisma.communicationEntry.deleteMany({
      where: { firmId: TEST_FIRM_ID },
    });
    await prisma.bulkCommunicationLog.deleteMany({
      where: { bulkCommunication: { firmId: TEST_FIRM_ID } },
    });
    await prisma.bulkCommunication.deleteMany({
      where: { firmId: TEST_FIRM_ID },
    });
    await prisma.communicationTemplate.deleteMany({
      where: { firmId: TEST_FIRM_ID },
    });
    await prisma.communicationExport.deleteMany({
      where: { firmId: TEST_FIRM_ID },
    });
    await prisma.case.deleteMany({
      where: { id: TEST_CASE_ID },
    });
    await prisma.client.deleteMany({
      where: { id: TEST_CLIENT_ID },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_USER_ID, TEST_USER_ID_2] } },
    });
    await prisma.firm.deleteMany({
      where: { id: TEST_FIRM_ID },
    });
    await prisma.$disconnect();
  });

  // ============================================================================
  // Communication Entry CRUD Tests
  // ============================================================================

  describe('Communication Entry CRUD', () => {
    let testEntryId: string;

    it('should create a communication entry', async () => {
      const entry = await prisma.communicationEntry.create({
        data: {
          firmId: TEST_FIRM_ID,
          caseId: TEST_CASE_ID,
          channelType: CommunicationChannel.Email,
          direction: CommunicationDirection.Inbound,
          subject: 'Test Email Subject',
          body: 'This is a test email body content.',
          senderId: TEST_USER_ID,
          senderName: 'Partner User',
          senderEmail: 'partner@hubfirm.com',
          recipients: [{ name: 'Client', email: 'client@test.com', type: 'to' }],
          hasAttachments: false,
          isPrivate: false,
          privacyLevel: PrivacyLevel.Normal,
          allowedViewers: [],
          sentAt: new Date(),
        },
      });

      testEntryId = entry.id;
      expect(entry.id).toBeDefined();
      expect(entry.channelType).toBe(CommunicationChannel.Email);
      expect(entry.direction).toBe(CommunicationDirection.Inbound);
    });

    it('should read communication entry', async () => {
      const entry = await prisma.communicationEntry.findUnique({
        where: { id: testEntryId },
      });

      expect(entry).not.toBeNull();
      expect(entry?.subject).toBe('Test Email Subject');
    });

    it('should update communication entry privacy', async () => {
      const updated = await prisma.communicationEntry.update({
        where: { id: testEntryId },
        data: {
          privacyLevel: PrivacyLevel.Confidential,
          isPrivate: true,
          allowedViewers: [TEST_USER_ID_2],
        },
      });

      expect(updated.privacyLevel).toBe(PrivacyLevel.Confidential);
      expect(updated.isPrivate).toBe(true);
      expect(updated.allowedViewers).toContain(TEST_USER_ID_2);
    });

    it('should filter entries by privacy level', async () => {
      // Create a PartnerOnly entry
      await prisma.communicationEntry.create({
        data: {
          firmId: TEST_FIRM_ID,
          caseId: TEST_CASE_ID,
          channelType: CommunicationChannel.InternalNote,
          direction: CommunicationDirection.Internal,
          body: 'Partner only note',
          senderId: TEST_USER_ID,
          senderName: 'Partner User',
          recipients: [],
          hasAttachments: false,
          isPrivate: true,
          privacyLevel: PrivacyLevel.PartnerOnly,
          allowedViewers: [],
          sentAt: new Date(),
        },
      });

      // Query for Normal entries only
      const normalEntries = await prisma.communicationEntry.findMany({
        where: {
          caseId: TEST_CASE_ID,
          privacyLevel: PrivacyLevel.Normal,
        },
      });

      // All results should have Normal privacy
      expect(normalEntries.every((e) => e.privacyLevel === PrivacyLevel.Normal)).toBe(true);
    });

    it('should query entries by date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const entries = await prisma.communicationEntry.findMany({
        where: {
          caseId: TEST_CASE_ID,
          sentAt: {
            gte: yesterday,
            lte: tomorrow,
          },
        },
      });

      expect(entries.length).toBeGreaterThan(0);
    });

    it('should create internal note', async () => {
      const note = await prisma.communicationEntry.create({
        data: {
          firmId: TEST_FIRM_ID,
          caseId: TEST_CASE_ID,
          channelType: CommunicationChannel.InternalNote,
          direction: CommunicationDirection.Internal,
          body: 'This is an internal note for the case.',
          senderId: TEST_USER_ID,
          senderName: 'Partner User',
          recipients: [],
          hasAttachments: false,
          isPrivate: false,
          privacyLevel: PrivacyLevel.Normal,
          allowedViewers: [],
          sentAt: new Date(),
        },
      });

      expect(note.channelType).toBe(CommunicationChannel.InternalNote);
      expect(note.direction).toBe(CommunicationDirection.Internal);
    });
  });

  // ============================================================================
  // Communication Template Tests
  // ============================================================================

  describe('Communication Templates', () => {
    let testTemplateId: string;

    it('should create a communication template', async () => {
      const template = await prisma.communicationTemplate.create({
        data: {
          firmId: TEST_FIRM_ID,
          name: 'Case Status Update',
          description: 'Template for notifying clients of case status changes',
          category: TemplateCategory.ClientUpdate,
          channelType: CommunicationChannel.Email,
          subject: 'Update on Case {{caseNumber}}',
          body: 'Dear {{clientName}},\n\nWe wanted to update you on the status of your case {{caseNumber}}.\n\n{{updateContent}}\n\nBest regards,\n{{firmName}}',
          variables: [
            { name: 'clientName', description: 'Client name', required: true },
            { name: 'caseNumber', description: 'Case number', required: true },
            { name: 'updateContent', description: 'Update details', required: true },
            { name: 'firmName', description: 'Law firm name', required: false, defaultValue: 'Our Law Firm' },
          ],
          isActive: true,
          isGlobal: false,
          createdBy: TEST_USER_ID,
          usageCount: 0,
        },
      });

      testTemplateId = template.id;
      expect(template.id).toBeDefined();
      expect(template.name).toBe('Case Status Update');
      expect(template.isActive).toBe(true);
    });

    it('should find templates by category', async () => {
      const templates = await prisma.communicationTemplate.findMany({
        where: {
          firmId: TEST_FIRM_ID,
          category: TemplateCategory.ClientUpdate,
          isActive: true,
        },
      });

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every((t) => t.category === TemplateCategory.ClientUpdate)).toBe(true);
    });

    it('should find templates by channel type', async () => {
      const templates = await prisma.communicationTemplate.findMany({
        where: {
          firmId: TEST_FIRM_ID,
          channelType: CommunicationChannel.Email,
          isActive: true,
        },
      });

      expect(templates.length).toBeGreaterThan(0);
    });

    it('should update template usage count', async () => {
      const updated = await prisma.communicationTemplate.update({
        where: { id: testTemplateId },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      expect(updated.usageCount).toBe(1);
      expect(updated.lastUsedAt).not.toBeNull();
    });

    it('should soft delete template', async () => {
      const deleted = await prisma.communicationTemplate.update({
        where: { id: testTemplateId },
        data: { isActive: false },
      });

      expect(deleted.isActive).toBe(false);

      // Should not appear in active templates query
      const activeTemplates = await prisma.communicationTemplate.findMany({
        where: {
          firmId: TEST_FIRM_ID,
          isActive: true,
        },
      });

      expect(activeTemplates.find((t) => t.id === testTemplateId)).toBeUndefined();
    });
  });

  // ============================================================================
  // Bulk Communication Tests
  // ============================================================================

  describe('Bulk Communications', () => {
    let testBulkCommId: string;

    it('should create a bulk communication in draft status', async () => {
      const bulkComm = await prisma.bulkCommunication.create({
        data: {
          firmId: TEST_FIRM_ID,
          caseId: TEST_CASE_ID,
          subject: 'Important Update for All Clients',
          body: 'Dear Clients, this is an important update.',
          channelType: CommunicationChannel.Email,
          recipientType: BulkRecipientType.CaseClients,
          recipientFilter: {},
          recipients: [],
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 0,
          status: BulkCommunicationStatus.Draft,
          createdBy: TEST_USER_ID,
        },
      });

      testBulkCommId = bulkComm.id;
      expect(bulkComm.id).toBeDefined();
      expect(bulkComm.status).toBe(BulkCommunicationStatus.Draft);
    });

    it('should update bulk communication with resolved recipients', async () => {
      const recipients = [
        { id: 'r1', name: 'Client 1', email: 'client1@example.com', source: 'case_client' },
        { id: 'r2', name: 'Client 2', email: 'client2@example.com', source: 'case_client' },
      ];

      const updated = await prisma.bulkCommunication.update({
        where: { id: testBulkCommId },
        data: {
          recipients: recipients as any,
          totalRecipients: recipients.length,
        },
      });

      expect(updated.totalRecipients).toBe(2);
    });

    it('should create bulk communication logs', async () => {
      await prisma.bulkCommunicationLog.createMany({
        data: [
          {
            bulkCommunicationId: testBulkCommId,
            recipientId: 'r1',
            recipientEmail: 'client1@example.com',
            recipientName: 'Client 1',
            status: 'pending',
          },
          {
            bulkCommunicationId: testBulkCommId,
            recipientId: 'r2',
            recipientEmail: 'client2@example.com',
            recipientName: 'Client 2',
            status: 'pending',
          },
        ],
      });

      const logs = await prisma.bulkCommunicationLog.findMany({
        where: { bulkCommunicationId: testBulkCommId },
      });

      expect(logs.length).toBe(2);
    });

    it('should schedule bulk communication', async () => {
      const scheduledFor = new Date();
      scheduledFor.setHours(scheduledFor.getHours() + 2);

      const scheduled = await prisma.bulkCommunication.update({
        where: { id: testBulkCommId },
        data: {
          status: BulkCommunicationStatus.Scheduled,
          scheduledFor,
        },
      });

      expect(scheduled.status).toBe(BulkCommunicationStatus.Scheduled);
      expect(scheduled.scheduledFor).not.toBeNull();
    });

    it('should update log status on send', async () => {
      const log = await prisma.bulkCommunicationLog.findFirst({
        where: { bulkCommunicationId: testBulkCommId },
      });

      if (log) {
        const updated = await prisma.bulkCommunicationLog.update({
          where: { id: log.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
          },
        });

        expect(updated.status).toBe('sent');
        expect(updated.sentAt).not.toBeNull();
      }
    });

    it('should track send counts', async () => {
      const updated = await prisma.bulkCommunication.update({
        where: { id: testBulkCommId },
        data: {
          sentCount: 1,
          status: BulkCommunicationStatus.InProgress,
          startedAt: new Date(),
        },
      });

      expect(updated.sentCount).toBe(1);
      expect(updated.status).toBe(BulkCommunicationStatus.InProgress);
    });

    it('should complete bulk communication', async () => {
      const completed = await prisma.bulkCommunication.update({
        where: { id: testBulkCommId },
        data: {
          sentCount: 2,
          failedCount: 0,
          status: BulkCommunicationStatus.Completed,
          completedAt: new Date(),
        },
      });

      expect(completed.status).toBe(BulkCommunicationStatus.Completed);
      expect(completed.completedAt).not.toBeNull();
    });
  });

  // ============================================================================
  // Communication Export Tests
  // ============================================================================

  describe('Communication Exports', () => {
    let testExportId: string;

    it('should create a communication export', async () => {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const exportRecord = await prisma.communicationExport.create({
        data: {
          firmId: TEST_FIRM_ID,
          caseId: TEST_CASE_ID,
          exportedBy: TEST_USER_ID,
          format: ExportFormat.JSON,
          channelTypes: [CommunicationChannel.Email, CommunicationChannel.InternalNote],
          includeAttachments: false,
          totalEntries: 5,
          status: ExportStatus.Processing,
          expiresAt,
        },
      });

      testExportId = exportRecord.id;
      expect(exportRecord.id).toBeDefined();
      expect(exportRecord.status).toBe(ExportStatus.Processing);
    });

    it('should complete export with file URL', async () => {
      const completed = await prisma.communicationExport.update({
        where: { id: testExportId },
        data: {
          status: ExportStatus.Completed,
          fileUrl: 'exports/test-firm/test-case/export-123.json',
          completedAt: new Date(),
        },
      });

      expect(completed.status).toBe(ExportStatus.Completed);
      expect(completed.fileUrl).toBeDefined();
    });

    it('should list exports for a case', async () => {
      const exports = await prisma.communicationExport.findMany({
        where: {
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(exports.length).toBeGreaterThan(0);
    });

    it('should filter exports by format', async () => {
      const jsonExports = await prisma.communicationExport.findMany({
        where: {
          caseId: TEST_CASE_ID,
          format: ExportFormat.JSON,
        },
      });

      expect(jsonExports.every((e) => e.format === ExportFormat.JSON)).toBe(true);
    });

    it('should mark export as expired', async () => {
      const expired = await prisma.communicationExport.update({
        where: { id: testExportId },
        data: {
          status: ExportStatus.Expired,
          fileUrl: null,
        },
      });

      expect(expired.status).toBe(ExportStatus.Expired);
      expect(expired.fileUrl).toBeNull();
    });
  });

  // ============================================================================
  // Privacy and Access Control Tests
  // ============================================================================

  describe('Privacy and Access Control', () => {
    it('should enforce AttorneyOnly visibility', async () => {
      // Create an AttorneyOnly entry
      const attorneyOnlyEntry = await prisma.communicationEntry.create({
        data: {
          firmId: TEST_FIRM_ID,
          caseId: TEST_CASE_ID,
          channelType: CommunicationChannel.InternalNote,
          direction: CommunicationDirection.Internal,
          body: 'Attorney eyes only - privileged information',
          senderId: TEST_USER_ID,
          senderName: 'Partner User',
          recipients: [],
          hasAttachments: false,
          isPrivate: true,
          privacyLevel: PrivacyLevel.AttorneyOnly,
          allowedViewers: [],
          sentAt: new Date(),
        },
      });

      expect(attorneyOnlyEntry.privacyLevel).toBe(PrivacyLevel.AttorneyOnly);

      // Query should exclude AttorneyOnly for paralegals (simulated filter)
      const entriesForParalegal = await prisma.communicationEntry.findMany({
        where: {
          caseId: TEST_CASE_ID,
          OR: [
            { privacyLevel: PrivacyLevel.Normal },
            { senderId: TEST_USER_ID_2 },
            { allowedViewers: { has: TEST_USER_ID_2 } },
          ],
        },
      });

      // AttorneyOnly entry should not be in paralegal results
      expect(entriesForParalegal.find((e) => e.id === attorneyOnlyEntry.id)).toBeUndefined();
    });

    it('should allow Confidential entries for allowed viewers', async () => {
      const confidentialEntry = await prisma.communicationEntry.create({
        data: {
          firmId: TEST_FIRM_ID,
          caseId: TEST_CASE_ID,
          channelType: CommunicationChannel.Email,
          direction: CommunicationDirection.Outbound,
          subject: 'Confidential - Limited Distribution',
          body: 'This information is for select viewers only.',
          senderId: TEST_USER_ID,
          senderName: 'Partner User',
          recipients: [],
          hasAttachments: false,
          isPrivate: true,
          privacyLevel: PrivacyLevel.Confidential,
          allowedViewers: [TEST_USER_ID_2],
          sentAt: new Date(),
        },
      });

      // Query for user in allowedViewers
      const entriesForAllowedViewer = await prisma.communicationEntry.findMany({
        where: {
          caseId: TEST_CASE_ID,
          OR: [
            { privacyLevel: PrivacyLevel.Normal },
            { allowedViewers: { has: TEST_USER_ID_2 } },
          ],
        },
      });

      // Should find the confidential entry
      expect(entriesForAllowedViewer.find((e) => e.id === confidentialEntry.id)).toBeDefined();
    });
  });

  // ============================================================================
  // Multi-Channel Query Tests
  // ============================================================================

  describe('Multi-Channel Queries', () => {
    it('should query entries across multiple channels', async () => {
      const multiChannelEntries = await prisma.communicationEntry.findMany({
        where: {
          caseId: TEST_CASE_ID,
          channelType: {
            in: [CommunicationChannel.Email, CommunicationChannel.InternalNote],
          },
        },
        orderBy: { sentAt: 'desc' },
      });

      expect(multiChannelEntries.length).toBeGreaterThan(0);
    });

    it('should count entries by channel type', async () => {
      const emailCount = await prisma.communicationEntry.count({
        where: {
          caseId: TEST_CASE_ID,
          channelType: CommunicationChannel.Email,
        },
      });

      const noteCount = await prisma.communicationEntry.count({
        where: {
          caseId: TEST_CASE_ID,
          channelType: CommunicationChannel.InternalNote,
        },
      });

      expect(typeof emailCount).toBe('number');
      expect(typeof noteCount).toBe('number');
    });

    it('should aggregate entries for unified timeline', async () => {
      const timelineEntries = await prisma.communicationEntry.findMany({
        where: {
          caseId: TEST_CASE_ID,
          firmId: TEST_FIRM_ID,
        },
        include: {
          attachments: {
            select: { id: true, fileName: true },
          },
        },
        orderBy: { sentAt: 'desc' },
        take: 20,
      });

      expect(Array.isArray(timelineEntries)).toBe(true);
      timelineEntries.forEach((entry) => {
        expect(entry.channelType).toBeDefined();
        expect(entry.direction).toBeDefined();
        expect(entry.sentAt).toBeDefined();
      });
    });
  });
});
