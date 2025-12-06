/**
 * Communication Export Service Unit Tests
 * Story 5.5: Multi-Channel Communication Hub - Task 37 (AC: 5)
 *
 * Tests for communication export generation
 */

import { CommunicationExportService } from './communication-export.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    communicationExport: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    communicationEntry: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    case: {
      findFirst: jest.fn(),
    },
  },
  ExportFormat: {
    PDF: 'PDF',
    CSV: 'CSV',
    JSON: 'JSON',
    DOCX: 'DOCX',
  },
  ExportStatus: {
    Processing: 'Processing',
    Completed: 'Completed',
    Failed: 'Failed',
    Expired: 'Expired',
  },
  CommunicationChannel: {
    Email: 'Email',
    InternalNote: 'InternalNote',
  },
}));

// Mock R2 storage service
jest.mock('./r2-storage.service', () => ({
  r2StorageService: {
    uploadDocument: jest.fn().mockResolvedValue({ storagePath: 'exports/file.json' }),
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');

describe('CommunicationExportService', () => {
  let service: CommunicationExportService;

  const mockFirmId = 'firm-123';
  const mockUserId = 'user-789';
  const mockCaseId = 'case-456';

  const mockUserContext = {
    userId: mockUserId,
    firmId: mockFirmId,
  };

  const mockExport = {
    id: 'export-1',
    firmId: mockFirmId,
    caseId: mockCaseId,
    exportedBy: mockUserId,
    format: 'JSON',
    dateRangeFrom: null,
    dateRangeTo: null,
    channelTypes: [],
    includeAttachments: false,
    totalEntries: 10,
    fileUrl: 'exports/file.json',
    status: 'Completed',
    errorMessage: null,
    expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
    createdAt: new Date(),
    completedAt: new Date(),
  };

  const mockCommunicationEntry = {
    id: 'entry-1',
    channelType: 'Email',
    direction: 'Inbound',
    subject: 'Test Subject',
    body: 'Test body content',
    senderName: 'John Doe',
    sentAt: new Date(),
    recipients: [{ email: 'jane@example.com' }],
    attachments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommunicationExportService();
  });

  // ============================================================================
  // createExport Tests
  // ============================================================================

  describe('createExport', () => {
    it('should create a new export request', async () => {
      prisma.case.findFirst.mockResolvedValue({ id: mockCaseId });
      prisma.communicationEntry.count.mockResolvedValue(10);
      prisma.communicationExport.create.mockResolvedValue({
        ...mockExport,
        status: 'Processing',
      });
      prisma.communicationExport.findUnique.mockResolvedValue(mockExport);
      prisma.communicationEntry.findMany.mockResolvedValue([mockCommunicationEntry]);
      prisma.communicationExport.update.mockResolvedValue(mockExport);

      const result = await service.createExport(
        {
          caseId: mockCaseId,
          format: 'JSON' as any,
        },
        mockUserContext
      );

      expect(result.id).toBe('export-1');
      expect(prisma.communicationExport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firmId: mockFirmId,
            caseId: mockCaseId,
            exportedBy: mockUserId,
            status: 'Processing',
          }),
        })
      );
    });

    it('should throw error when case not found', async () => {
      prisma.case.findFirst.mockResolvedValue(null);

      await expect(
        service.createExport(
          { caseId: 'nonexistent', format: 'JSON' as any },
          mockUserContext
        )
      ).rejects.toThrow('Case not found');
    });

    it('should throw error when no entries match filter', async () => {
      prisma.case.findFirst.mockResolvedValue({ id: mockCaseId });
      prisma.communicationEntry.count.mockResolvedValue(0);

      await expect(
        service.createExport(
          { caseId: mockCaseId, format: 'JSON' as any },
          mockUserContext
        )
      ).rejects.toThrow('No communication entries match the filter criteria');
    });

    it('should set expiry 24 hours from creation', async () => {
      prisma.case.findFirst.mockResolvedValue({ id: mockCaseId });
      prisma.communicationEntry.count.mockResolvedValue(5);
      prisma.communicationExport.create.mockResolvedValue(mockExport);
      prisma.communicationExport.findUnique.mockResolvedValue(mockExport);
      prisma.communicationEntry.findMany.mockResolvedValue([]);
      prisma.communicationExport.update.mockResolvedValue(mockExport);

      await service.createExport(
        { caseId: mockCaseId, format: 'JSON' as any },
        mockUserContext
      );

      const createCall = prisma.communicationExport.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt;
      const now = new Date();
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeGreaterThan(23);
      expect(hoursDiff).toBeLessThanOrEqual(24);
    });

    it('should apply date range filter', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');
      prisma.case.findFirst.mockResolvedValue({ id: mockCaseId });
      prisma.communicationEntry.count.mockResolvedValue(5);
      prisma.communicationExport.create.mockResolvedValue(mockExport);
      prisma.communicationExport.findUnique.mockResolvedValue(mockExport);
      prisma.communicationEntry.findMany.mockResolvedValue([]);
      prisma.communicationExport.update.mockResolvedValue(mockExport);

      await service.createExport(
        {
          caseId: mockCaseId,
          format: 'JSON' as any,
          dateRangeFrom: dateFrom,
          dateRangeTo: dateTo,
        },
        mockUserContext
      );

      const countCall = prisma.communicationEntry.count.mock.calls[0][0];
      expect(countCall.where.sentAt).toEqual({ gte: dateFrom, lte: dateTo });
    });

    it('should apply channel type filter', async () => {
      prisma.case.findFirst.mockResolvedValue({ id: mockCaseId });
      prisma.communicationEntry.count.mockResolvedValue(5);
      prisma.communicationExport.create.mockResolvedValue(mockExport);
      prisma.communicationExport.findUnique.mockResolvedValue(mockExport);
      prisma.communicationEntry.findMany.mockResolvedValue([]);
      prisma.communicationExport.update.mockResolvedValue(mockExport);

      await service.createExport(
        {
          caseId: mockCaseId,
          format: 'JSON' as any,
          channelTypes: ['Email' as any, 'InternalNote' as any],
        },
        mockUserContext
      );

      const countCall = prisma.communicationEntry.count.mock.calls[0][0];
      expect(countCall.where.channelType).toEqual({ in: ['Email', 'InternalNote'] });
    });
  });

  // ============================================================================
  // getExport Tests
  // ============================================================================

  describe('getExport', () => {
    it('should return export by ID', async () => {
      prisma.communicationExport.findFirst.mockResolvedValue(mockExport);

      const result = await service.getExport('export-1', mockUserContext);

      expect(result).toBeDefined();
      expect(result?.id).toBe('export-1');
    });

    it('should return null when export not found', async () => {
      prisma.communicationExport.findFirst.mockResolvedValue(null);

      const result = await service.getExport('nonexistent', mockUserContext);

      expect(result).toBeNull();
    });

    it('should filter by firm ID', async () => {
      prisma.communicationExport.findFirst.mockResolvedValue(mockExport);

      await service.getExport('export-1', mockUserContext);

      const findFirstCall = prisma.communicationExport.findFirst.mock.calls[0][0];
      expect(findFirstCall.where.firmId).toBe(mockFirmId);
    });
  });

  // ============================================================================
  // getDownloadUrl Tests
  // ============================================================================

  describe('getDownloadUrl', () => {
    it('should return download URL for completed export', async () => {
      prisma.communicationExport.findFirst.mockResolvedValue(mockExport);

      const result = await service.getDownloadUrl('export-1', mockUserContext);

      expect(result).toBe('exports/file.json');
    });

    it('should return null when export not found', async () => {
      prisma.communicationExport.findFirst.mockResolvedValue(null);

      const result = await service.getDownloadUrl('nonexistent', mockUserContext);

      expect(result).toBeNull();
    });

    it('should throw error when export is not completed', async () => {
      prisma.communicationExport.findFirst.mockResolvedValue({
        ...mockExport,
        status: 'Processing',
      });

      await expect(
        service.getDownloadUrl('export-1', mockUserContext)
      ).rejects.toThrow('Export is not ready for download');
    });

    it('should throw error when export has expired', async () => {
      prisma.communicationExport.findFirst.mockResolvedValue({
        ...mockExport,
        expiresAt: new Date(Date.now() - 86400000), // 24 hours ago
      });

      await expect(
        service.getDownloadUrl('export-1', mockUserContext)
      ).rejects.toThrow('Export has expired');
    });
  });

  // ============================================================================
  // listExports Tests
  // ============================================================================

  describe('listExports', () => {
    it('should return list of exports for a case', async () => {
      prisma.communicationExport.findMany.mockResolvedValue([mockExport]);
      prisma.communicationExport.count.mockResolvedValue(1);

      const result = await service.listExports(mockCaseId, mockUserContext);

      expect(result.exports).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by case and firm', async () => {
      prisma.communicationExport.findMany.mockResolvedValue([]);
      prisma.communicationExport.count.mockResolvedValue(0);

      await service.listExports(mockCaseId, mockUserContext);

      const findManyCall = prisma.communicationExport.findMany.mock.calls[0][0];
      expect(findManyCall.where.caseId).toBe(mockCaseId);
      expect(findManyCall.where.firmId).toBe(mockFirmId);
    });

    it('should support pagination', async () => {
      prisma.communicationExport.findMany.mockResolvedValue([]);
      prisma.communicationExport.count.mockResolvedValue(50);

      await service.listExports(mockCaseId, mockUserContext, {
        limit: 10,
        offset: 20,
      });

      const findManyCall = prisma.communicationExport.findMany.mock.calls[0][0];
      expect(findManyCall.take).toBe(10);
      expect(findManyCall.skip).toBe(20);
    });

    it('should order by creation date descending', async () => {
      prisma.communicationExport.findMany.mockResolvedValue([]);
      prisma.communicationExport.count.mockResolvedValue(0);

      await service.listExports(mockCaseId, mockUserContext);

      const findManyCall = prisma.communicationExport.findMany.mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  // ============================================================================
  // deleteExport Tests
  // ============================================================================

  describe('deleteExport', () => {
    it('should delete an export', async () => {
      prisma.communicationExport.findFirst.mockResolvedValue(mockExport);
      prisma.communicationExport.delete.mockResolvedValue(mockExport);

      const result = await service.deleteExport('export-1', mockUserContext);

      expect(result).toBe(true);
      expect(prisma.communicationExport.delete).toHaveBeenCalledWith({
        where: { id: 'export-1' },
      });
    });

    it('should throw error when export not found', async () => {
      prisma.communicationExport.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteExport('nonexistent', mockUserContext)
      ).rejects.toThrow('Export not found');
    });
  });

  // ============================================================================
  // cleanupExpiredExports Tests
  // ============================================================================

  describe('cleanupExpiredExports', () => {
    it('should mark expired exports as expired', async () => {
      const expiredExports = [
        { ...mockExport, id: 'exp-1' },
        { ...mockExport, id: 'exp-2' },
      ];
      prisma.communicationExport.findMany.mockResolvedValue(expiredExports);
      prisma.communicationExport.update.mockResolvedValue({});

      const result = await service.cleanupExpiredExports();

      expect(result).toBe(2);
      expect(prisma.communicationExport.update).toHaveBeenCalledTimes(2);
    });

    it('should update status to Expired and clear fileUrl', async () => {
      prisma.communicationExport.findMany.mockResolvedValue([mockExport]);
      prisma.communicationExport.update.mockResolvedValue({});

      await service.cleanupExpiredExports();

      const updateCall = prisma.communicationExport.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('Expired');
      expect(updateCall.data.fileUrl).toBeNull();
    });

    it('should return 0 when no expired exports', async () => {
      prisma.communicationExport.findMany.mockResolvedValue([]);

      const result = await service.cleanupExpiredExports();

      expect(result).toBe(0);
    });

    it('should query for completed exports past expiry date', async () => {
      prisma.communicationExport.findMany.mockResolvedValue([]);

      await service.cleanupExpiredExports();

      const findManyCall = prisma.communicationExport.findMany.mock.calls[0][0];
      expect(findManyCall.where.expiresAt).toEqual({ lt: expect.any(Date) });
      expect(findManyCall.where.status).toBe('Completed');
    });
  });

  // ============================================================================
  // Export Format Tests
  // ============================================================================

  describe('Export Formats', () => {
    beforeEach(() => {
      prisma.case.findFirst.mockResolvedValue({ id: mockCaseId });
      prisma.communicationEntry.count.mockResolvedValue(5);
      prisma.communicationEntry.findMany.mockResolvedValue([mockCommunicationEntry]);
      prisma.communicationExport.update.mockResolvedValue(mockExport);
    });

    it('should handle JSON format', async () => {
      prisma.communicationExport.create.mockResolvedValue({
        ...mockExport,
        format: 'JSON',
        status: 'Processing',
      });
      prisma.communicationExport.findUnique.mockResolvedValue({
        ...mockExport,
        format: 'JSON',
      });

      const result = await service.createExport(
        { caseId: mockCaseId, format: 'JSON' as any },
        mockUserContext
      );

      expect(result.format).toBe('JSON');
    });

    it('should handle CSV format', async () => {
      prisma.communicationExport.create.mockResolvedValue({
        ...mockExport,
        format: 'CSV',
        status: 'Processing',
      });
      prisma.communicationExport.findUnique.mockResolvedValue({
        ...mockExport,
        format: 'CSV',
      });

      const result = await service.createExport(
        { caseId: mockCaseId, format: 'CSV' as any },
        mockUserContext
      );

      expect(result.format).toBe('CSV');
    });

    it('should handle PDF format', async () => {
      prisma.communicationExport.create.mockResolvedValue({
        ...mockExport,
        format: 'PDF',
        status: 'Processing',
      });
      prisma.communicationExport.findUnique.mockResolvedValue({
        ...mockExport,
        format: 'PDF',
      });

      const result = await service.createExport(
        { caseId: mockCaseId, format: 'PDF' as any },
        mockUserContext
      );

      expect(result.format).toBe('PDF');
    });

    it('should handle DOCX format', async () => {
      prisma.communicationExport.create.mockResolvedValue({
        ...mockExport,
        format: 'DOCX',
        status: 'Processing',
      });
      prisma.communicationExport.findUnique.mockResolvedValue({
        ...mockExport,
        format: 'DOCX',
      });

      const result = await service.createExport(
        { caseId: mockCaseId, format: 'DOCX' as any },
        mockUserContext
      );

      expect(result.format).toBe('DOCX');
    });
  });
});
