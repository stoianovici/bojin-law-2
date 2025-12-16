/**
 * Unit tests for Document Structure Preference Service
 * Story 5.6: AI Learning and Personalization (Task 41)
 */

import { DocumentStructurePreferenceService } from '../../src/services/document-structure-preference.service';
import { prisma } from '@legal-platform/database';

// Mock Prisma
jest.mock('@legal-platform/database', () => ({
  prisma: {
    documentStructurePreference: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('DocumentStructurePreferenceService', () => {
  let service: DocumentStructurePreferenceService;
  const userId = 'user-123';
  const firmId = 'firm-456';

  const mockHeaderStyle = {
    format: 'numbered' as const,
    numbering: 'decimal' as const,
    capitalization: 'uppercase' as const,
    bold: true,
    underline: false,
  };

  const mockPreference = {
    id: 'pref-1',
    firmId,
    userId,
    documentType: 'contract',
    preferredSections: [
      { name: 'Introduction', order: 1, required: true },
      { name: 'Terms', order: 2, required: true },
      { name: 'Signatures', order: 3, required: true },
    ],
    headerStyle: mockHeaderStyle,
    footerContent: 'Page {page} of {total}',
    marginPreferences: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5, unit: 'cm' },
    fontPreferences: { family: 'Times New Roman', size: 12, lineHeight: 1.5 },
    usageCount: 10,
    lastUsedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    service = new DocumentStructurePreferenceService();
    jest.clearAllMocks();
  });

  describe('createPreference', () => {
    it('should create a new preference successfully', async () => {
      (mockPrisma.documentStructurePreference.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.documentStructurePreference.create as jest.Mock).mockResolvedValue(
        mockPreference
      );

      const input = {
        documentType: 'contract',
        preferredSections: [
          { name: 'Introduction', order: 1, required: true },
          { name: 'Terms', order: 2, required: true },
        ],
        headerStyle: mockHeaderStyle,
      };

      const result = await service.createPreference(input, userId, firmId);

      expect(result.id).toBe('pref-1');
      expect(result.documentType).toBe('contract');
      expect(mockPrisma.documentStructurePreference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firmId,
          userId,
          documentType: 'contract',
          usageCount: 0,
        }),
      });
    });

    it('should throw error for duplicate document type', async () => {
      (mockPrisma.documentStructurePreference.findUnique as jest.Mock).mockResolvedValue(
        mockPreference
      );

      const input = {
        documentType: 'contract',
        preferredSections: [{ name: 'Section', order: 1, required: true }],
        headerStyle: mockHeaderStyle,
      };

      await expect(service.createPreference(input, userId, firmId)).rejects.toThrow(
        'Preferințele pentru tipul de document "contract" există deja'
      );
    });

    it('should throw error for empty sections', async () => {
      (mockPrisma.documentStructurePreference.findUnique as jest.Mock).mockResolvedValue(null);

      const input = {
        documentType: 'contract',
        preferredSections: [],
        headerStyle: mockHeaderStyle,
      };

      await expect(service.createPreference(input, userId, firmId)).rejects.toThrow(
        'Secțiunile sunt obligatorii'
      );
    });

    it('should throw error for invalid section name', async () => {
      (mockPrisma.documentStructurePreference.findUnique as jest.Mock).mockResolvedValue(null);

      const input = {
        documentType: 'contract',
        preferredSections: [{ name: '', order: 1, required: true }],
        headerStyle: mockHeaderStyle,
      };

      await expect(service.createPreference(input, userId, firmId)).rejects.toThrow(
        'Numele secțiunii este invalid'
      );
    });

    it('should throw error for duplicate section names', async () => {
      (mockPrisma.documentStructurePreference.findUnique as jest.Mock).mockResolvedValue(null);

      const input = {
        documentType: 'contract',
        preferredSections: [
          { name: 'Section', order: 1, required: true },
          { name: 'section', order: 2, required: false },
        ],
        headerStyle: mockHeaderStyle,
      };

      await expect(service.createPreference(input, userId, firmId)).rejects.toThrow(
        'Secțiunea "section" este duplicată'
      );
    });
  });

  describe('updatePreference', () => {
    it('should update preference successfully', async () => {
      (mockPrisma.documentStructurePreference.findFirst as jest.Mock).mockResolvedValue(
        mockPreference
      );
      (mockPrisma.documentStructurePreference.update as jest.Mock).mockResolvedValue({
        ...mockPreference,
        footerContent: 'Updated footer',
      });

      const result = await service.updatePreference(
        'pref-1',
        { footerContent: 'Updated footer' },
        userId
      );

      expect(result.footerContent).toBe('Updated footer');
      expect(mockPrisma.documentStructurePreference.update).toHaveBeenCalledWith({
        where: { id: 'pref-1' },
        data: { footerContent: 'Updated footer' },
      });
    });

    it('should throw error when preference not found', async () => {
      (mockPrisma.documentStructurePreference.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updatePreference('nonexistent', { footerContent: 'Test' }, userId)
      ).rejects.toThrow('Preferința nu a fost găsită');
    });

    it('should validate sections when updating', async () => {
      (mockPrisma.documentStructurePreference.findFirst as jest.Mock).mockResolvedValue(
        mockPreference
      );

      await expect(
        service.updatePreference('pref-1', { preferredSections: [] }, userId)
      ).rejects.toThrow('Secțiunile sunt obligatorii');
    });

    it('should allow null values for optional fields', async () => {
      (mockPrisma.documentStructurePreference.findFirst as jest.Mock).mockResolvedValue(
        mockPreference
      );
      (mockPrisma.documentStructurePreference.update as jest.Mock).mockResolvedValue({
        ...mockPreference,
        footerContent: null,
        marginPreferences: null,
      });

      await service.updatePreference(
        'pref-1',
        { footerContent: null, marginPreferences: null },
        userId
      );

      // Prisma uses special JsonNull value for nullable JSON fields
      expect(mockPrisma.documentStructurePreference.update).toHaveBeenCalledWith({
        where: { id: 'pref-1' },
        data: expect.objectContaining({
          footerContent: null,
        }),
      });
    });
  });

  describe('deletePreference', () => {
    it('should delete preference successfully', async () => {
      (mockPrisma.documentStructurePreference.findFirst as jest.Mock).mockResolvedValue(
        mockPreference
      );
      (mockPrisma.documentStructurePreference.delete as jest.Mock).mockResolvedValue(
        mockPreference
      );

      const result = await service.deletePreference('pref-1', userId);

      expect(result).toBe(true);
      expect(mockPrisma.documentStructurePreference.delete).toHaveBeenCalledWith({
        where: { id: 'pref-1' },
      });
    });

    it('should throw error when preference not found', async () => {
      (mockPrisma.documentStructurePreference.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.deletePreference('nonexistent', userId)).rejects.toThrow(
        'Preferința nu a fost găsită'
      );
    });
  });

  describe('getPreferenceById', () => {
    it('should return preference by ID', async () => {
      (mockPrisma.documentStructurePreference.findFirst as jest.Mock).mockResolvedValue(
        mockPreference
      );

      const result = await service.getPreferenceById('pref-1', userId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('pref-1');
    });

    it('should return null when not found', async () => {
      (mockPrisma.documentStructurePreference.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getPreferenceById('nonexistent', userId);

      expect(result).toBeNull();
    });
  });

  describe('getPreferenceByType', () => {
    it('should return preference by document type', async () => {
      (mockPrisma.documentStructurePreference.findUnique as jest.Mock).mockResolvedValue(
        mockPreference
      );

      const result = await service.getPreferenceByType('contract', userId);

      expect(result).not.toBeNull();
      expect(result!.documentType).toBe('contract');
      expect(mockPrisma.documentStructurePreference.findUnique).toHaveBeenCalledWith({
        where: {
          userId_documentType: {
            userId,
            documentType: 'contract',
          },
        },
      });
    });
  });

  describe('getUserPreferences', () => {
    it('should return all user preferences', async () => {
      (mockPrisma.documentStructurePreference.findMany as jest.Mock).mockResolvedValue([
        mockPreference,
      ]);

      const result = await service.getUserPreferences(userId);

      expect(result).toHaveLength(1);
      expect(mockPrisma.documentStructurePreference.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
      });
    });
  });

  describe('getConfiguredDocumentTypes', () => {
    it('should return list of configured document types', async () => {
      (mockPrisma.documentStructurePreference.findMany as jest.Mock).mockResolvedValue([
        { documentType: 'contract' },
        { documentType: 'letter' },
        { documentType: 'motion' },
      ]);

      const result = await service.getConfiguredDocumentTypes(userId);

      expect(result).toEqual(['contract', 'letter', 'motion']);
    });
  });

  describe('recordUsage', () => {
    it('should increment usage count', async () => {
      (mockPrisma.documentStructurePreference.findUnique as jest.Mock).mockResolvedValue(
        mockPreference
      );
      (mockPrisma.documentStructurePreference.update as jest.Mock).mockResolvedValue({
        ...mockPreference,
        usageCount: 11,
      });

      const result = await service.recordUsage('contract', userId);

      expect(result).not.toBeNull();
      expect(result!.usageCount).toBe(11);
      expect(mockPrisma.documentStructurePreference.update).toHaveBeenCalledWith({
        where: { id: 'pref-1' },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: expect.any(Date),
        },
      });
    });

    it('should return null when preference not found', async () => {
      (mockPrisma.documentStructurePreference.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.recordUsage('unknown', userId);

      expect(result).toBeNull();
    });
  });

  describe('learnFromDocument', () => {
    it('should create new preference when none exists', async () => {
      (mockPrisma.documentStructurePreference.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.documentStructurePreference.create as jest.Mock).mockResolvedValue(
        mockPreference
      );

      const sections = [{ name: 'Introduction', order: 1, required: true }];
      const headerStyle = mockHeaderStyle;

      await service.learnFromDocument('contract', sections, headerStyle, userId, firmId);

      expect(mockPrisma.documentStructurePreference.create).toHaveBeenCalled();
    });

    it('should merge sections when preference exists', async () => {
      (mockPrisma.documentStructurePreference.findUnique as jest.Mock).mockResolvedValue(
        mockPreference
      );
      (mockPrisma.documentStructurePreference.update as jest.Mock).mockResolvedValue({
        ...mockPreference,
        preferredSections: [
          { name: 'Introduction', order: 1, required: true },
          { name: 'Terms', order: 2, required: true },
          { name: 'Signatures', order: 3, required: true },
          { name: 'Appendix', order: 4, required: false },
        ],
      });

      const newSections = [
        { name: 'Introduction', order: 1, required: false },
        { name: 'Appendix', order: 4, required: false },
      ];
      const headerStyle = mockHeaderStyle;

      await service.learnFromDocument('contract', newSections, headerStyle, userId, firmId);

      expect(mockPrisma.documentStructurePreference.update).toHaveBeenCalledWith({
        where: { id: 'pref-1' },
        data: expect.objectContaining({
          usageCount: { increment: 1 },
          lastUsedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('reorderSections', () => {
    it('should reorder sections', async () => {
      (mockPrisma.documentStructurePreference.findFirst as jest.Mock).mockResolvedValue(
        mockPreference
      );
      (mockPrisma.documentStructurePreference.update as jest.Mock).mockResolvedValue({
        ...mockPreference,
        preferredSections: [
          { name: 'Terms', order: 1, required: true },
          { name: 'Introduction', order: 2, required: true },
          { name: 'Signatures', order: 3, required: true },
        ],
      });

      const newOrders = [
        { name: 'Terms', order: 1 },
        { name: 'Introduction', order: 2 },
      ];

      await service.reorderSections('pref-1', newOrders, userId);

      expect(mockPrisma.documentStructurePreference.update).toHaveBeenCalled();
    });

    it('should throw error when preference not found', async () => {
      (mockPrisma.documentStructurePreference.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.reorderSections('nonexistent', [{ name: 'Test', order: 1 }], userId)
      ).rejects.toThrow('Preferința nu a fost găsită');
    });
  });

  describe('getMostUsedDocumentType', () => {
    it('should return most used document type', async () => {
      (mockPrisma.documentStructurePreference.findFirst as jest.Mock).mockResolvedValue({
        documentType: 'contract',
      });

      const result = await service.getMostUsedDocumentType(userId);

      expect(result).toBe('contract');
      expect(mockPrisma.documentStructurePreference.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          usageCount: { gt: 0 },
        },
        orderBy: { usageCount: 'desc' },
        select: { documentType: true },
      });
    });

    it('should return null when no preferences exist', async () => {
      (mockPrisma.documentStructurePreference.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getMostUsedDocumentType(userId);

      expect(result).toBeNull();
    });
  });
});
