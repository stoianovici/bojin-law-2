/**
 * Unit tests for Draft Edit Tracker Service
 * Story 5.6: AI Learning and Personalization (Task 41)
 */

import { DraftEditTrackerService } from '../../src/services/draft-edit-tracker.service';
import { prisma } from '@legal-platform/database';

// Mock Prisma
jest.mock('@legal-platform/database', () => ({
  prisma: {
    emailDraft: {
      findFirst: jest.fn(),
    },
    draftEditHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('DraftEditTrackerService', () => {
  let service: DraftEditTrackerService;
  const userId = 'user-123';
  const firmId = 'firm-456';
  const draftId = 'draft-789';

  const mockEditRecord = {
    id: 'edit-1',
    firmId,
    userId,
    draftId,
    originalText: 'Original text',
    editedText: 'Edited text',
    editType: 'Replacement',
    editLocation: 'body',
    isStyleAnalyzed: false,
    createdAt: new Date(),
  };

  beforeEach(() => {
    service = new DraftEditTrackerService();
    jest.clearAllMocks();
  });

  describe('trackDraftEdit', () => {
    it('should create edit record for valid draft', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue({
        id: draftId,
        userId,
      });
      (mockPrisma.draftEditHistory.create as jest.Mock).mockResolvedValue(mockEditRecord);

      const input = {
        draftId,
        originalText: 'Original text',
        editedText: 'Edited text',
      };

      const result = await service.trackDraftEdit(input, userId, firmId);

      expect(result.id).toBe('edit-1');
      expect(result.editType).toBe('Replacement');
      expect(mockPrisma.draftEditHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firmId,
          userId,
          draftId,
          originalText: 'Original text',
          editedText: 'Edited text',
          isStyleAnalyzed: false,
        }),
      });
    });

    it('should throw error when draft not found', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(null);

      const input = {
        draftId: 'nonexistent',
        originalText: 'Original',
        editedText: 'Edited',
      };

      await expect(service.trackDraftEdit(input, userId, firmId)).rejects.toThrow(
        'Draft not found or access denied'
      );
    });

    it('should detect Addition edit type', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue({ id: draftId, userId });
      (mockPrisma.draftEditHistory.create as jest.Mock).mockResolvedValue({
        ...mockEditRecord,
        editType: 'Addition',
      });

      const input = {
        draftId,
        originalText: '',
        editedText: 'New content added',
      };

      await service.trackDraftEdit(input, userId, firmId);

      expect(mockPrisma.draftEditHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          editType: 'Addition',
        }),
      });
    });

    it('should detect Deletion edit type', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue({ id: draftId, userId });
      (mockPrisma.draftEditHistory.create as jest.Mock).mockResolvedValue({
        ...mockEditRecord,
        editType: 'Deletion',
      });

      const input = {
        draftId,
        originalText: 'Content to be removed',
        editedText: '',
      };

      await service.trackDraftEdit(input, userId, firmId);

      expect(mockPrisma.draftEditHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          editType: 'Deletion',
        }),
      });
    });

    it('should detect StyleChange edit type for same content different format', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue({ id: draftId, userId });
      (mockPrisma.draftEditHistory.create as jest.Mock).mockResolvedValue({
        ...mockEditRecord,
        editType: 'StyleChange',
      });

      // Same words but different formatting (case and punctuation only)
      const input = {
        draftId,
        originalText: 'this is some text',
        editedText: 'THIS IS SOME TEXT!',
      };

      await service.trackDraftEdit(input, userId, firmId);

      expect(mockPrisma.draftEditHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          editType: 'StyleChange',
        }),
      });
    });

    it('should detect greeting location', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue({ id: draftId, userId });
      (mockPrisma.draftEditHistory.create as jest.Mock).mockResolvedValue({
        ...mockEditRecord,
        editLocation: 'greeting',
      });

      const input = {
        draftId,
        originalText: 'Dear Mr. Smith,',
        editedText: 'Hello Mr. Smith,',
      };

      await service.trackDraftEdit(input, userId, firmId);

      expect(mockPrisma.draftEditHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          editLocation: 'greeting',
        }),
      });
    });

    it('should detect closing location', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue({ id: draftId, userId });
      (mockPrisma.draftEditHistory.create as jest.Mock).mockResolvedValue({
        ...mockEditRecord,
        editLocation: 'closing',
      });

      const input = {
        draftId,
        originalText: 'Sincerely,',
        editedText: 'Best regards,',
      };

      await service.trackDraftEdit(input, userId, firmId);

      expect(mockPrisma.draftEditHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          editLocation: 'closing',
        }),
      });
    });

    it('should use provided edit location', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue({ id: draftId, userId });
      (mockPrisma.draftEditHistory.create as jest.Mock).mockResolvedValue({
        ...mockEditRecord,
        editLocation: 'header',
      });

      const input = {
        draftId,
        originalText: 'Some text',
        editedText: 'Changed text',
        editLocation: 'header',
      };

      await service.trackDraftEdit(input, userId, firmId);

      expect(mockPrisma.draftEditHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          editLocation: 'header',
        }),
      });
    });
  });

  describe('getUnanalyzedEdits', () => {
    it('should return unanalyzed edits', async () => {
      (mockPrisma.draftEditHistory.findMany as jest.Mock).mockResolvedValue([mockEditRecord]);

      const result = await service.getUnanalyzedEdits(userId);

      expect(result).toHaveLength(1);
      expect(result[0].isStyleAnalyzed).toBe(false);
      expect(mockPrisma.draftEditHistory.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          isStyleAnalyzed: false,
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
    });

    it('should respect limit parameter', async () => {
      (mockPrisma.draftEditHistory.findMany as jest.Mock).mockResolvedValue([]);

      await service.getUnanalyzedEdits(userId, 10);

      expect(mockPrisma.draftEditHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });
  });

  describe('markAsAnalyzed', () => {
    it('should mark edits as analyzed', async () => {
      (mockPrisma.draftEditHistory.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const editIds = ['edit-1', 'edit-2', 'edit-3'];
      const result = await service.markAsAnalyzed(editIds);

      expect(result).toBe(3);
      expect(mockPrisma.draftEditHistory.updateMany).toHaveBeenCalledWith({
        where: { id: { in: editIds } },
        data: { isStyleAnalyzed: true },
      });
    });
  });

  describe('getDraftEditHistory', () => {
    it('should return edit history for a draft', async () => {
      (mockPrisma.draftEditHistory.findMany as jest.Mock).mockResolvedValue([mockEditRecord]);

      const result = await service.getDraftEditHistory(draftId, userId);

      expect(result).toHaveLength(1);
      expect(result[0].draftId).toBe(draftId);
      expect(mockPrisma.draftEditHistory.findMany).toHaveBeenCalledWith({
        where: { draftId, userId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getEditStats', () => {
    it('should calculate edit statistics', async () => {
      const edits = [
        { editType: 'Replacement', editLocation: 'body', isStyleAnalyzed: true },
        { editType: 'Replacement', editLocation: 'body', isStyleAnalyzed: false },
        { editType: 'Addition', editLocation: 'greeting', isStyleAnalyzed: true },
        { editType: 'StyleChange', editLocation: 'closing', isStyleAnalyzed: false },
      ];
      (mockPrisma.draftEditHistory.findMany as jest.Mock).mockResolvedValue(edits);

      const result = await service.getEditStats(userId);

      expect(result.totalEdits).toBe(4);
      expect(result.analyzedEdits).toBe(2);
      expect(result.editsByType).toEqual({
        Replacement: 2,
        Addition: 1,
        StyleChange: 1,
      });
      expect(result.editsByLocation).toEqual({
        body: 2,
        greeting: 1,
        closing: 1,
      });
    });

    it('should return empty stats when no edits', async () => {
      (mockPrisma.draftEditHistory.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getEditStats(userId);

      expect(result.totalEdits).toBe(0);
      expect(result.analyzedEdits).toBe(0);
      expect(result.editsByType).toEqual({});
      expect(result.editsByLocation).toEqual({});
    });
  });

  describe('cleanupOldEdits', () => {
    it('should delete old analyzed edits', async () => {
      (mockPrisma.draftEditHistory.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await service.cleanupOldEdits(userId, 90);

      expect(result).toBe(5);
      expect(mockPrisma.draftEditHistory.deleteMany).toHaveBeenCalledWith({
        where: {
          userId,
          isStyleAnalyzed: true,
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should use default 90 days when not specified', async () => {
      (mockPrisma.draftEditHistory.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

      await service.cleanupOldEdits(userId);

      const call = (mockPrisma.draftEditHistory.deleteMany as jest.Mock).mock.calls[0][0];
      const cutoffDate = call.where.createdAt.lt;
      const now = new Date();
      const daysDiff = Math.round((now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBeCloseTo(90, 0);
    });
  });
});
